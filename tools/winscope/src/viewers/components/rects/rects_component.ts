/*
 * Copyright (C) 2022 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {CommonModule} from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  SimpleChange,
  SimpleChanges,
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {
  MatButtonToggleChange,
  MatButtonToggleModule,
} from '@angular/material/button-toggle';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MatSliderModule} from '@angular/material/slider';
import {MatTooltipModule} from '@angular/material/tooltip';
import {DomSanitizer} from '@angular/platform-browser';
import {assertDefined} from 'common/assert';
import {Distance} from 'common/geometry/distance';
import {PersistentStore} from 'common/store/persistent_store';
import {getRootUrl} from 'common/window';
import {Analytics} from 'logging/analytics';
import {TRACE_INFO} from 'trace_api/trace_info';
import {TraceType} from 'trace_api/trace_type';
import {DisplayIdentifier} from 'viewers/common/display_identifier';
import {UiHierarchyTreeNode} from 'viewers/common/ui_hierarchy_tree_node';
import {UserOptions} from 'viewers/common/user_options';
import {RectDblClickDetail, ViewerEvents} from 'viewers/common/viewer_events';
import {CollapsibleSectionTitleComponent} from 'viewers/components/collapsible_section_title_component';
import {RectSpec, TraceRectType} from 'viewers/components/rects/rect_spec';
import {UiRect} from 'viewers/components/rects/ui_rect';
import {iconDividerStyle} from 'viewers/components/styles/icon_divider.styles';
import {multlineTooltip} from 'viewers/components/styles/tooltip.styles';
import {viewerCardInnerStyle} from 'viewers/components/styles/viewer_card.styles';
import {UserOptionsComponent} from 'viewers/components/user_options_component';
import {Canvas} from './canvas';
import {Mapper3D} from './mapper3d';
import {ShadingMode} from './shading_mode';

interface CanColor {
  color: string | undefined;
}

@Component({
  selector: 'rects-view',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDividerModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    MatTooltipModule,
    CollapsibleSectionTitleComponent,
    UserOptionsComponent,
  ],
  template: `
    <div class="view-header">
      <div class="title-section">
        <collapsible-section-title
          [title]="title"
          (collapseButtonClicked)="collapseButtonClicked.emit()"></collapsible-section-title>
        <div class="right-btn-container">
          <button
            color="accent"
            class="shading-mode"
            (mouseenter)="onInteractionStart([shadingModeButton])"
            (mouseleave)="onInteractionEnd([shadingModeButton])"
            mat-icon-button
            [matTooltip]="getShadingMode()"
            [disabled]="shadingModes.length < 2"
            (click)="onShadingModeButtonClicked()" #shadingModeButton>
            @if (largeRectsMapper3d.isWireFrame()) {
              <mat-icon class="material-symbols-outlined" aria-hidden="true"> deployed_code </mat-icon>
            } @else if (largeRectsMapper3d.isShadedByGradient()) {
              <mat-icon svgIcon="cube_partial_shade"></mat-icon>
            } @else if (largeRectsMapper3d.isShadedByOpacity()) {
              <mat-icon svgIcon="cube_full_shade"></mat-icon>
            }
          </button>

          <div class="icon-divider"></div>

          <div class="slider-container">
            <mat-icon
              color="accent"
              matTooltip="Rotation"
              class="slider-icon icon-small"
              (mouseenter)="onInteractionStart([rotationSlider, rotationSliderIcon])"
              (mouseleave)="onInteractionEnd([rotationSlider, rotationSliderIcon])" #rotationSliderIcon> rotate_90_degrees_ccw </mat-icon>
            <mat-slider
              class="slider-rotation"
              aria-label="units"
              color="accent"
              [step]="0.02"
              [min]="0"
              [max]="1"
              (mousedown)="onInteractionStart([rotationSlider, rotationSliderIcon])"
              (mouseup)="onInteractionEnd([rotationSlider, rotationSliderIcon])"
              #rotationSlider>
              <input
                [value]="largeRectsMapper3d.getCameraRotationFactor()"
                (input)="onRotationSliderChange($event.target.value)"
                (focus)="$event.target.blur()"
                matSliderThumb>
            </mat-slider>
            <mat-icon
              color="accent"
              matTooltip="Spacing"
              class="slider-icon icon-small material-symbols-outlined"
              (mouseenter)="onInteractionStart([spacingSlider, spacingSliderIcon])"
              (mouseleave)="onInteractionEnd([spacingSlider, spacingSliderIcon])" #spacingSliderIcon> format_letter_spacing </mat-icon>
            <mat-slider
              class="slider-spacing"
              aria-label="units"
              color="accent"
              [step]="0.02"
              [min]="0.02"
              [max]="1"
              (mousedown)="onInteractionStart([spacingSlider, spacingSliderIcon])"
              (mouseup)="onInteractionEnd([spacingSlider, spacingSliderIcon])"
              #spacingSlider>
              <input
                [value]="getZSpacingFactor()"
                (input)="onSeparationSliderChange($event.target.value)"
                (focus)="$event.target.blur()"
                matSliderThumb>
            </mat-slider>
          </div>

          <div class="icon-divider"></div>

          <button
            color="accent"
            (mouseenter)="onInteractionStart([zoomInButton])"
            (mouseleave)="onInteractionEnd([zoomInButton])"
            mat-icon-button
            class="zoom-in-button"
            (click)="onZoomInClick()" #zoomInButton>
            <mat-icon aria-hidden="true"> zoom_in </mat-icon>
          </button>
          <button
            color="accent"
            (mouseenter)="onInteractionStart([zoomOutButton])"
            (mouseleave)="onInteractionEnd([zoomOutButton])"
            mat-icon-button
            class="zoom-out-button"
            (click)="onZoomOutClick()" #zoomOutButton>
            <mat-icon aria-hidden="true"> zoom_out </mat-icon>
          </button>

          <div class="icon-divider"></div>

          <button
            color="accent"
            (mouseenter)="onInteractionStart([resetZoomButton])"
            (mouseleave)="onInteractionEnd([resetZoomButton])"
            mat-icon-button
            matTooltip="Restore camera settings"
            class="reset-button"
            (click)="resetCamera()" #resetZoomButton>
            <mat-icon aria-hidden="true"> restore </mat-icon>
          </button>
        </div>
      </div>
      <div class="filter-controls view-controls">
        <user-options
          class="block-filter-controls"
          [userOptions]="userOptions"
          [eventType]="ViewerEvents.RectsUserOptionsChange"
          [traceType]="dependencies[0]"
          [logCallback]="Analytics.Navigation.logRectSettingsChanged">
        </user-options>

        <div class="displays-section">
          @if (allRectSpecs) {
            <mat-button-toggle-group
              [value]="rectSpec"
              (change)="onRectTypeButtonClicked($event)"
              appearance="legacy"
              class="rect-type-toggle"
              [hideSingleSelectionIndicator]="true">
              @for (spec of allRectSpecs; track $index) {
                <mat-button-toggle [value]="spec">
                  <mat-icon
                    [color]="spec === rectSpec ? 'primary' : 'accent'"
                    [matTooltip]="'Show ' + spec.type"
                    class="rect-type-icon material-symbols-outlined">{{spec.icon}}</mat-icon>
                </mat-button-toggle>
              }
            </mat-button-toggle-group>
          }
          <span class="mat-body-1">{{groupLabel}}:</span>
          <mat-form-field
            class="displays-select"
            subscriptSizing="dynamic"
            appearance="outline">
            <mat-select
              #displaySelect
              disableOptionCentering
              (selectionChange)="onDisplaySelectChange($event)"
              [value]="currentDisplays"
              [disabled]="internalDisplays.length === 1"
              panelWidth="340px"
              multiple>
              <mat-select-trigger>
                <span>
                  {{ getSelectTriggerValue() }}
                </span>
              </mat-select-trigger>
              @for (display of internalDisplays; track display.displayId) {
                <mat-option
                  [value]="display"
                  [matTooltip]="'Display Id: ' + display.displayId"
                  matTooltipPosition="right">
                  <div class="option-with-chip">
                    <button
                      mat-flat-button
                      class="option-only-button"
                      (click)="onOnlyButtonClick($event, display)">Only</button>
                    <span class="option-label-text text-no-overflow">{{ display.name }}</span>
                  </div>
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>
      </div>
    </div>
    <mat-divider></mat-divider>
    @if (showRectSpecWarning()) {
      <span
        class="mat-body-1 warning">
        <mat-icon class="warning-icon icon-small"> warning </mat-icon>
        <span class="warning-message text-no-overflow">
          Showing {{rectSpec.type}} - change rect type via toggle above
        </span>
      </span>
    }
    @if (rects.length===0) {
      <span class="mat-body-1 placeholder-text"> No rects found. </span>
    }
    @if (currentDisplays.length===0) {
      <span class="mat-body-1 placeholder-text"> No displays selected. </span>
    }
    <div class="rects-content">
      <div class="canvas-container">
        <canvas
          class="large-rects-canvas"
          (click)="onRectClick($event)"
          (dblclick)="onRectDblClick($event)"
          oncontextmenu="return false"></canvas>
        <div class="large-rects-labels"></div>
        <canvas
          class="mini-rects-canvas"
          (dblclick)="onMiniRectDblClick($event)"
          oncontextmenu="return false"></canvas>
      </div>
    </div>
    @if (rectSpec) {
      <span class="mat-body-1 rect-legend">
        <span class="shading-opts" [class.force-show-all]="legendExpanded" #shadingOpts>
          @for (opt of rectSpec.legend; track opt) {
            @if (!largeRectsMapper3d.isWireFrame() || opt.showInWireFrameMode) {
              <span
                class="shading-opt">
                @if (opt.fill === undefined) {
                  <mat-icon
                    [style.border-color]="opt.border"
                    class="square">question_mark</mat-icon>
                }
                @if (opt.fill !== undefined) {
                  <div
                    [style.background-color]="opt.fill"
                    [style.border-color]="opt.border"
                    class="square"></div>
                }
                <span class="mat-body-1 shading-opt-desc">{{opt.desc}}</span>
              </span>
            }
          }
        </span>
        @if (showExpandButton(shadingOpts)) {
          <button
            mat-icon-button
            class="rect-legend-expand-button"
            (click)="legendExpanded = !legendExpanded">
            <mat-icon class="material-symbols-outlined">{{legendExpanded ? 'expand_circle_down' : 'more_horiz'}}</mat-icon>
          </button>
        }
      </span>
    }
  `,
  styles: [
    `
      .view-header {
        display: flex;
        flex-direction: column;
      }
      .right-btn-container {
        display: flex;
        align-items: center;
      }
      .right-btn-container .mat-mdc-slider {
        min-width: 48px;
      }
      .right-btn-container .mdc-slider__input {
        padding: 0px !important;
        margin: 0 16px;
      }
      .icon-divider {
        height: 50%;
      }
      .slider-container {
        padding: 0 5px;
        display: flex;
        align-items: center;
      }
      .slider-icon {
        min-width: 18px;
      }
      .filter-controls {
        justify-content: space-between;
      }
      .block-filter-controls {
        display: flex;
        flex-direction: row;
        align-items: baseline;
        flex-shrink: 0;
      }
      .displays-section {
        display: flex;
        flex-direction: row;
        align-items: center;
        width: fit-content;
        flex-wrap: nowrap;
      }
      .displays-select {
        border-radius: 4px;
        margin-left: 5px;
        background-color: var(--disabled-color);
      }
      .rect-type-toggle {
        margin: 0 4px;
      }
      .rects-content {
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 0px 12px;
      }
      .canvas-container {
        height: 100%;
        width: 100%;
        position: relative;
      }
      .large-rects-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        cursor: pointer;
      }
      .large-rects-labels {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      }
      .mini-rects-canvas {
        cursor: pointer;
        width: 30%;
        height: 30%;
        top: 16px;
        display: block;
        position: absolute;
        z-index: 1000;
      }
      .option-with-chip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
      }
      .option-only-button {
        padding: 0 10px;
        border-radius: 10px;
        background-color: var(--disabled-color) !important;
        color: var(--default-text-color);
        min-width: fit-content;
        height: 18px;
        align-items: center;
        display: flex;
      }
      .rect-legend {
        display: flex;
        justify-content: space-between;
        background-color: var(--card-title-background-color);
      }
      .shading-opts {
        display: flex;
        flex-wrap: wrap;
        padding: 0 4px;
      }
      .shading-opts:not(.force-show-all) {
        max-height: 24px;
        overflow-y: hidden;
      }
      .shading-opt {
        display: flex;
        align-items: center;
        padding: 2px;
      }
      .square {
        width: 12px;
        height: 12px;
        line-height: 12px;
        font-size: 12px;
        border-style: solid;
        border-width: 1.5px;
      }
      .shading-opt-desc {
        padding-inline-start: 2px;
      }
      .rect-legend-expand-button {
        height: 24px;
        width: 24px;
        padding: 0px;
      }
    `,
    multlineTooltip,
    iconDividerStyle,
    viewerCardInnerStyle,
  ],
})
export class RectsComponent implements OnInit, OnDestroy {
  Analytics = Analytics;
  ViewerEvents = ViewerEvents;

  @Input() title = 'title';
  @Input() zoomFactor = 1;
  @Input() store?: PersistentStore;
  @Input() rects: UiRect[] = [];
  @Input() miniRects: UiRect[] | undefined;
  @Input() displays: DisplayIdentifier[] = [];
  @Input() highlightedItem = '';
  @Input() groupLabel = 'Displays';
  @Input() isStackBased = false;
  @Input() shadingModes: ShadingMode[] = [ShadingMode.GRADIENT];
  @Input() rectSpec: RectSpec | undefined;
  @Input() allRectSpecs: RectSpec[] | undefined;
  @Input() userOptions: UserOptions = {};
  @Input() dependencies: TraceType[] = [];
  @Input() pinnedItems: UiHierarchyTreeNode[] = [];
  @Input() isDarkMode = false;

  @Output() collapseButtonClicked = new EventEmitter();

  legendExpanded = false;
  private internalRects: UiRect[] = [];
  private internalMiniRects?: UiRect[];
  private storeKeyZSpacingFactor = '';
  private storeKeyShadingMode = '';
  private storeKeySelectedDisplays = '';
  private internalDisplays: DisplayIdentifier[] = [];
  private internalHighlightedItem = '';
  private currentDisplays: DisplayIdentifier[] = [];
  largeRectsMapper3d = new Mapper3D();
  private miniRectsMapper3d = new Mapper3D();
  private largeRectsCanvas?: Canvas;
  private miniRectsCanvas?: Canvas;
  private resizeObserver = new ResizeObserver((entries) => {
    this.updateLargeRectsPosition();
  });
  private largeRectsCanvasElement?: HTMLCanvasElement;
  private miniRectsCanvasElement?: HTMLCanvasElement;
  private largeRectsLabelsElement?: HTMLElement;
  private mouseMoveListener = (event: MouseEvent) => this.onMouseMove(event);
  private mouseUpListener = (event: MouseEvent) => this.onMouseUp(event);
  private panning = false;
  private defaultRectType: TraceRectType | undefined;

  private static readonly ZOOM_SCROLL_RATIO = 0.3;

  constructor(
    @Inject(ElementRef) private elementRef: ElementRef<HTMLElement>,
    @Inject(MatIconRegistry) private matIconRegistry: MatIconRegistry,
    @Inject(DomSanitizer) private domSanitizer: DomSanitizer,
  ) {
    this.matIconRegistry.addSvgIcon(
      'cube_full_shade',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        getRootUrl() + 'cube_full_shade.svg',
      ),
    );
    this.matIconRegistry.addSvgIcon(
      'cube_partial_shade',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        getRootUrl() + 'cube_partial_shade.svg',
      ),
    );
  }

  ngOnInit() {
    this.largeRectsMapper3d.setAllowedShadingModes(this.shadingModes);

    const canvasContainer = assertDefined(
      this.elementRef.nativeElement.querySelector<HTMLElement>(
        '.rects-content',
      ),
    );
    this.resizeObserver.observe(canvasContainer);

    this.largeRectsCanvasElement = assertDefined(
      canvasContainer.querySelector<HTMLCanvasElement>('.large-rects-canvas'),
    );
    this.largeRectsLabelsElement = assertDefined(
      canvasContainer.querySelector<HTMLElement>('.large-rects-labels'),
    );
    this.largeRectsCanvas = new Canvas(
      this.largeRectsCanvasElement,
      this.largeRectsLabelsElement,
      () => this.isDarkMode,
    );
    this.largeRectsCanvasElement.addEventListener('mousedown', (event) =>
      this.onCanvasMouseDown(event),
    );

    this.largeRectsMapper3d.increaseZoomFactor(this.zoomFactor - 1);

    if (this.store) {
      this.updateControlsFromStore();
    }

    this.redrawLargeRectsAndLabels();

    this.miniRectsCanvasElement = canvasContainer.querySelector(
      '.mini-rects-canvas',
    )! as HTMLCanvasElement;
    this.miniRectsCanvas = new Canvas(
      this.miniRectsCanvasElement,
      undefined,
      () => this.isDarkMode,
    );
    this.miniRectsMapper3d.setShadingMode(ShadingMode.GRADIENT);
    this.miniRectsMapper3d.resetToOrthogonalState();
    if (this.miniRects && this.miniRects.length > 0) {
      this.internalMiniRects = this.miniRects;
      this.drawMiniRects();
    }
    this.defaultRectType = this.rectSpec?.type;
  }

  ngOnChanges(simpleChanges: SimpleChanges) {
    this.handleLargeRectChanges(simpleChanges);
    if (
      simpleChanges['miniRects'] ||
      (this.miniRects && simpleChanges['isDarkMode'])
    ) {
      this.internalMiniRects = this.miniRects;
      this.drawMiniRects();
    }
  }

  private handleLargeRectChanges(simpleChanges: SimpleChanges) {
    let displayChange = false;
    if (simpleChanges['displays']) {
      const curr: DisplayIdentifier[] = simpleChanges['displays'].currentValue;
      const prev: DisplayIdentifier[] =
        simpleChanges['displays'].previousValue ?? [];
      displayChange =
        curr.length !== prev.length ||
        (curr.length > 0 &&
          !curr.every((d, index) => d.displayId === prev[index].displayId));
    }

    let redrawRects = false;
    let recolorRects = false;
    let recolorLabels = false;
    if (simpleChanges['pinnedItems']) {
      this.largeRectsMapper3d.setPinnedItems(this.pinnedItems);
      recolorRects = true;
    }
    if (simpleChanges['highlightedItem']) {
      this.internalHighlightedItem =
        simpleChanges['highlightedItem'].currentValue;
      this.largeRectsMapper3d.setHighlightedRectId(
        this.internalHighlightedItem,
      );
      recolorRects = true;
      recolorLabels = true;
    }
    if (simpleChanges['isDarkMode']) {
      recolorRects = true;
      recolorLabels = true;
    }
    if (simpleChanges['rects']) {
      this.internalRects = simpleChanges['rects'].currentValue;
      redrawRects = true;
    }

    if (displayChange) {
      this.onDisplaysChange(simpleChanges['displays']);
    } else if (redrawRects) {
      this.redrawLargeRectsAndLabels();
    } else if (recolorRects && recolorLabels) {
      this.updateLargeRectsAndLabelsColors();
    } else if (recolorRects) {
      this.updateLargeRectsColors();
    }
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.largeRectsCanvas?.onDestroy();
    this.miniRectsCanvas?.onDestroy();
    (this.largeRectsCanvasElement?.getContext('2d') as any)?.reset();
    (this.miniRectsCanvasElement?.getContext('2d') as any)?.reset();
  }

  onDisplaysChange(change: SimpleChange) {
    const displays = change.currentValue;
    this.internalDisplays = displays;
    const activeDisplay = this.getActiveDisplay(this.internalDisplays);

    if (displays.length === 0) {
      this.updateCurrentDisplays([], false);
      return;
    }

    if (change.firstChange) {
      this.updateCurrentDisplays([activeDisplay], false);
      return;
    }

    const curr = this.internalDisplays.filter((display) =>
      this.currentDisplays.some((curr) => curr.displayId === display.displayId),
    );
    if (curr.length > 0) {
      this.updateCurrentDisplays(curr);
      return;
    }

    const currGroupIds = this.largeRectsMapper3d.getCurrentGroupIds();
    const displaysWithCurrentGroupId = this.internalDisplays.filter((display) =>
      currGroupIds.some((curr) => curr === display.groupId),
    );
    if (displaysWithCurrentGroupId.length === 0) {
      this.updateCurrentDisplays([activeDisplay]);
      return;
    }

    this.updateCurrentDisplays([
      this.getActiveDisplay(displaysWithCurrentGroupId),
    ]);
    return;
  }

  updateControlsFromStore() {
    this.storeKeyZSpacingFactor = `rectsView.${this.title}.zSpacingFactor`;
    this.storeKeyShadingMode = `rectsView.${this.title}.shadingMode`;
    this.storeKeySelectedDisplays = `rectsView.${this.title}.selectedDisplayId`;

    const storedZSpacingFactor = assertDefined(this.store).get(
      this.storeKeyZSpacingFactor,
    );
    if (storedZSpacingFactor !== undefined) {
      this.largeRectsMapper3d.setZSpacingFactor(Number(storedZSpacingFactor));
    }

    const storedShadingMode = assertDefined(this.store).get(
      this.storeKeyShadingMode,
    );
    if (
      storedShadingMode !== undefined &&
      this.shadingModes.includes(storedShadingMode as ShadingMode)
    ) {
      this.largeRectsMapper3d.setShadingMode(storedShadingMode as ShadingMode);
    }

    const storedSelectedDisplays = assertDefined(this.store).get(
      this.storeKeySelectedDisplays,
    );
    if (storedSelectedDisplays !== undefined) {
      const storedIds: Array<number | string> = JSON.parse(
        storedSelectedDisplays,
      );
      const displays = this.internalDisplays.filter((display) => {
        return storedIds.some((id) => display.displayId === id);
      });
      if (displays.length > 0) {
        this.currentDisplays = displays;
        this.largeRectsMapper3d.setCurrentGroupIds(
          displays.map((d) => d.groupId),
        );
      }
    }
  }

  onSeparationSliderChange(factor: number) {
    Analytics.Navigation.logRectSettingsChanged(
      'z spacing',
      factor,
      TRACE_INFO[this.dependencies[0]].name,
    );
    this.store?.add(this.storeKeyZSpacingFactor, `${factor}`);
    this.largeRectsMapper3d.setZSpacingFactor(factor);
    this.redrawLargeRectsAndLabels();
  }

  onRotationSliderChange(factor: number) {
    this.largeRectsMapper3d.setCameraRotationFactor(factor);
    this.updateLargeRectsPositionAndLabels();
  }

  resetCamera() {
    Analytics.Navigation.logZoom('reset', 'rects');
    this.largeRectsMapper3d.resetCamera();
    this.redrawLargeRectsAndLabels(true);
  }

  @HostListener('wheel', ['$event'])
  onScroll(event: WheelEvent) {
    if ((event.target as HTMLElement).className === 'large-rects-canvas') {
      event.preventDefault();
      if (event.deltaY > 0) {
        Analytics.Navigation.logZoom('scroll', 'rects', 'out');
        this.doZoomOut(RectsComponent.ZOOM_SCROLL_RATIO);
      } else {
        Analytics.Navigation.logZoom('scroll', 'rects', 'in');
        this.doZoomIn(RectsComponent.ZOOM_SCROLL_RATIO);
      }
    }
  }

  onCanvasMouseDown(event: MouseEvent) {
    document.addEventListener('mousemove', this.mouseMoveListener);
    document.addEventListener('mouseup', this.mouseUpListener);
  }

  onMouseMove(event: MouseEvent) {
    this.panning = true;
    const distance: Distance = {dx: event.movementX, dy: event.movementY};
    this.largeRectsMapper3d.addPanScreenDistance(distance);
    this.updateLargeRectsPosition();
  }

  onMouseUp(event: MouseEvent) {
    document.removeEventListener('mousemove', this.mouseMoveListener);
    document.removeEventListener('mouseup', this.mouseUpListener);
  }

  onZoomInClick() {
    Analytics.Navigation.logZoom('button', 'rects', 'in');
    this.doZoomIn();
  }

  onZoomOutClick() {
    Analytics.Navigation.logZoom('button', 'rects', 'out');
    this.doZoomOut();
  }

  onDisplaySelectChange(event: MatSelectChange) {
    const selectedDisplays: DisplayIdentifier[] = event.value;
    this.updateCurrentDisplays(selectedDisplays);
  }

  getSelectTriggerValue(): string {
    return this.currentDisplays.map((d) => d.name).join(', ');
  }

  onOnlyButtonClick(event: MouseEvent, selected: DisplayIdentifier) {
    event.preventDefault();
    event.stopPropagation();
    this.updateCurrentDisplays([selected]);
  }

  onRectClick(event: MouseEvent) {
    if (this.panning) {
      this.panning = false;
      return;
    }
    event.preventDefault();

    const id = this.findClickedRectId(event);
    if (id !== undefined) {
      this.notifyHighlightedItem(id);
    }
  }

  onRectDblClick(event: MouseEvent) {
    event.preventDefault();

    const clickedRectId = this.findClickedRectId(event);
    if (clickedRectId === undefined) {
      return;
    }

    this.elementRef.nativeElement.dispatchEvent(
      new CustomEvent(ViewerEvents.RectsDblClick, {
        bubbles: true,
        detail: new RectDblClickDetail(clickedRectId),
      }),
    );
  }

  onMiniRectDblClick(event: MouseEvent) {
    event.preventDefault();

    this.elementRef.nativeElement.dispatchEvent(
      new CustomEvent(ViewerEvents.MiniRectsDblClick, {bubbles: true}),
    );
  }

  getZSpacingFactor(): number {
    return this.largeRectsMapper3d.getZSpacingFactor();
  }

  getShadingMode(): ShadingMode {
    return this.largeRectsMapper3d.getShadingMode();
  }

  onShadingModeButtonClicked() {
    this.largeRectsMapper3d.updateShadingMode();
    const newMode = this.largeRectsMapper3d.getShadingMode();
    Analytics.Navigation.logRectSettingsChanged(
      'shading mode',
      newMode,
      TRACE_INFO[this.dependencies[0]].name,
    );
    this.store?.add(this.storeKeyShadingMode, newMode);
    this.updateLargeRectsColors();
  }

  onInteractionStart(components: CanColor[]) {
    components.forEach((c) => (c.color = 'primary'));
  }

  onInteractionEnd(components: CanColor[]) {
    components.forEach((c) => (c.color = 'accent'));
  }

  onRectTypeButtonClicked(event: MatButtonToggleChange) {
    const spec: RectSpec = event.value;
    this.elementRef.nativeElement.dispatchEvent(
      new CustomEvent(ViewerEvents.RectTypeButtonClick, {
        bubbles: true,
        detail: {type: spec.type},
      }),
    );
  }

  showRectSpecWarning(): boolean {
    return (
      this.defaultRectType !== undefined &&
      this.defaultRectType !== this.rectSpec?.type
    );
  }

  showExpandButton(options: HTMLElement): boolean {
    return (
      options.scrollHeight > options.clientHeight ||
      (this.legendExpanded && options.scrollHeight > 24)
    );
  }

  private getActiveDisplay(displays: DisplayIdentifier[]): DisplayIdentifier {
    const displaysWithRects = displays.filter((display) =>
      this.internalRects.some(
        (rect) => !rect.isDisplay && rect.groupId === display.groupId,
      ),
    );
    return (
      displaysWithRects.find((display) => display.isActive) ??
      displaysWithRects.at(0) ?? // fallback if no active displays
      displays[0]
    );
  }

  private updateCurrentDisplays(
    displays: DisplayIdentifier[],
    storeChange = true,
  ) {
    if (storeChange) {
      this.store?.add(
        this.storeKeySelectedDisplays,
        JSON.stringify(displays.map((d) => d.displayId)),
      );
    }
    this.currentDisplays = displays;
    this.largeRectsMapper3d.setCurrentGroupIds(displays.map((d) => d.groupId));
    this.redrawLargeRectsAndLabels(true);
  }

  private findClickedRectId(event: MouseEvent): string | undefined {
    const canvas = event.target as Element;
    const canvasOffset = canvas.getBoundingClientRect();

    const x =
      ((event.clientX - canvasOffset.left) / canvas.clientWidth) * 2 - 1;
    const y =
      -((event.clientY - canvasOffset.top) / canvas.clientHeight) * 2 + 1;

    return this.largeRectsCanvas?.getClickedRectId(x, y);
  }

  private doZoomIn(ratio = 1) {
    this.largeRectsMapper3d.increaseZoomFactor(ratio);
    this.updateLargeRectsPositionAndLabels();
  }

  private doZoomOut(ratio = 1) {
    this.largeRectsMapper3d.decreaseZoomFactor(ratio);
    this.updateLargeRectsPositionAndLabels();
  }

  private redrawLargeRectsAndLabels(updateBoundingBox = false) {
    this.largeRectsMapper3d.setRects(this.internalRects);
    const scene = this.largeRectsMapper3d.computeScene(updateBoundingBox);
    this.largeRectsCanvas?.updateViewPosition(
      scene.camera,
      scene.boundingBox,
      scene.zDepth,
    );
    this.largeRectsCanvas?.updateRects(scene.rects);
    this.largeRectsCanvas?.updateLabels(scene.labels);
    this.largeRectsCanvas?.renderView();
  }

  private updateLargeRectsPosition() {
    const scene = this.largeRectsMapper3d.computeScene(false);
    this.largeRectsCanvas?.updateViewPosition(
      scene.camera,
      scene.boundingBox,
      scene.zDepth,
    );
    this.largeRectsCanvas?.renderView();
  }

  private updateLargeRectsPositionAndLabels() {
    const scene = this.largeRectsMapper3d.computeScene(false);
    this.largeRectsCanvas?.updateViewPosition(
      scene.camera,
      scene.boundingBox,
      scene.zDepth,
    );
    this.largeRectsCanvas?.updateLabels(scene.labels);
    this.largeRectsCanvas?.renderView();
  }

  private updateLargeRectsColors() {
    const scene = this.largeRectsMapper3d.computeScene(false);
    this.largeRectsCanvas?.updateRects(scene.rects);
    this.largeRectsCanvas?.renderView();
  }

  private updateLargeRectsAndLabelsColors() {
    const scene = this.largeRectsMapper3d.computeScene(false);
    this.largeRectsCanvas?.updateRects(scene.rects);
    this.largeRectsCanvas?.updateLabels(scene.labels);
    this.largeRectsCanvas?.renderView();
  }

  private drawMiniRects() {
    if (this.internalMiniRects && this.miniRectsCanvas) {
      this.miniRectsMapper3d.setShadingMode(ShadingMode.GRADIENT);
      this.miniRectsMapper3d.setCurrentGroupIds([
        this.internalMiniRects[0]?.groupId,
      ]);
      this.miniRectsMapper3d.resetToOrthogonalState();
      this.miniRectsMapper3d.setRects(this.internalMiniRects);

      const scene = this.miniRectsMapper3d.computeScene(true);
      this.miniRectsCanvas.updateViewPosition(
        scene.camera,
        scene.boundingBox,
        scene.zDepth,
      );
      this.miniRectsCanvas.updateRects(scene.rects);
      this.miniRectsCanvas.updateLabels(scene.labels);
      this.miniRectsCanvas.renderView();

      // Canvas internally sets these values to 100%. They need to be reset afterwards
      if (this.miniRectsCanvasElement) {
        this.miniRectsCanvasElement.style.width = '30%';
        this.miniRectsCanvasElement.style.height = '30%';
      }
    }
  }

  private notifyHighlightedItem(id: string) {
    const event: CustomEvent = new CustomEvent(
      ViewerEvents.HighlightedIdChange,
      {
        bubbles: true,
        detail: {id},
      },
    );
    this.elementRef.nativeElement.dispatchEvent(event);
  }
}

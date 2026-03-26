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
import {ChangeDetectorRef, Component, computed, effect, ElementRef, HostListener, Inject, input, OnDestroy, OnInit, output, signal,} from '@angular/core';
import {MatButtonModule, MatIconButton} from '@angular/material/button';
import {MatButtonToggleChange, MatButtonToggleModule,} from '@angular/material/button-toggle';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIcon, MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MatSlider, MatSliderModule} from '@angular/material/slider';
import {MatTooltipModule} from '@angular/material/tooltip';
import {DomSanitizer} from '@angular/platform-browser';
import {CollapsibleSectionTitleComponent} from '@app/shared/collapsible_sections/collapsible_section_title_component';
import {UserOptionsComponent} from '@app/shared/user_options/user_options_component';
import {assertDefined} from '@common/assert';
import {Distance} from '@common/geometry/distance';
import {Store} from '@common/store/store';
import {getRootUrl} from '@common/window';
import {Analytics} from '@logging/analytics';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {Canvas} from '@ui/shared/rects/canvas';
import {DisplayIdentifier} from '@ui/shared/rects/display_identifier';
import {Mapper3D} from '@ui/shared/rects/mapper3d';
import {RectSpec, TraceRectType} from '@ui/shared/rects/rect_spec';
import {ShadingMode} from '@ui/shared/rects/shading_mode';
import {UiRect} from '@ui/shared/rects/ui_rect';
import {UserOptions} from '@ui/shared/user_input/user_options';

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
  templateUrl: './rects_component.ng.html',
  styleUrls: ['./rects_component.scss'],
})
export class RectsComponent implements OnInit, OnDestroy {
  Analytics = Analytics;

  title = input.required<string>();
  rects = input.required<UiRect[]>();
  displays = input.required<DisplayIdentifier[]>();
  shadingModes = input.required<ShadingMode[]>();
  userOptions = input.required<UserOptions>();
  dependencies = input.required<TraceType[]>();

  zoomFactor = input(1);
  store = input<Store>();
  miniRects = input<UiRect[]>();
  highlightedItem = input('');
  groupLabel = input('Displays');
  isStackBased = input(false);
  rectSpec = input<RectSpec>();
  allRectSpecs = input<RectSpec[]>();
  pinnedIds = input<string[]>([]);
  isDarkMode = input(false);

  collapseButtonClicked = output();
  readonly rectsDblClick = output<string>();
  readonly miniRectsDblClick = output<void>();
  readonly rectTypeButtonClick = output<TraceRectType>();
  readonly highlightedIdChange = output<string>();
  readonly optionsChange = output<UserOptions>();

  legendExpanded = false;
  private internalRects: UiRect[] = [];
  private internalMiniRects?: UiRect[];
  private storeKeyZSpacingFactor = '';
  private storeKeyShadingMode = '';
  private storeKeySelectedDisplays = '';
  private internalDisplays: DisplayIdentifier[] | undefined;
  private internalHighlightedItem = '';
  currentDisplays: DisplayIdentifier[] = [];
  largeRectsMapper3d = new Mapper3D();
  private miniRectsMapper3d = new Mapper3D();
  private largeRectsCanvas?: Canvas;
  private miniRectsCanvas?: Canvas;
  private resizeObserver = new ResizeObserver((_) => {
    this.updateLargeRectsPosition();
  });
  private largeRectsCanvasElement?: HTMLCanvasElement;
  private miniRectsCanvasElement?: HTMLCanvasElement;
  private largeRectsLabelsElement?: HTMLElement;
  private mouseMoveListener = (event: MouseEvent) => this.onMouseMove(event);
  private mouseUpListener = () => this.onMouseUp();
  private panning = false;

  private readonly defaultRectType = signal<TraceRectType | undefined>(
    undefined,
  );

  readonly showRectSpecWarning = computed(() => {
    const defaultRectType = this.defaultRectType();
    return (
      defaultRectType !== undefined && defaultRectType !== this.rectSpec()?.type
    );
  });

  private static readonly ZOOM_SCROLL_RATIO = 0.3;

  constructor(
    @Inject(ElementRef) private elementRef: ElementRef<HTMLElement>,
    @Inject(MatIconRegistry) private matIconRegistry: MatIconRegistry,
    @Inject(DomSanitizer) private domSanitizer: DomSanitizer,
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
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

    const initialStoreKeysEffect = effect(() => {
      const title = this.title();
      this.storeKeySelectedDisplays = `rectsView.${title}.selectedDisplayId`;
      this.storeKeyZSpacingFactor = `rectsView.${title}.zSpacingFactor`;
      this.storeKeyShadingMode = `rectsView.${title}.shadingMode`;
      initialStoreKeysEffect.destroy();
    });

    effect(() => {
      const rects = this.rects();
      const rectsChanged = this.internalRects !== rects;
      const shouldUpdateBoundingBox =
        this.internalRects.length === 0 && rects.length > 0;
      if (rectsChanged) {
        this.internalRects = rects;
        this.largeRectsMapper3d.setRects(this.internalRects);
      }

      const displays = this.displays();
      const displaysChanged =
        !this.internalDisplays ||
        this.internalDisplays.length !== displays.length ||
        (displays.length > 0 &&
          !displays.every(
            (d, index) =>
              d.displayId === this.internalDisplays?.[index].displayId,
          ));

      if (displaysChanged) {
        this.onDisplaysChange(displays);
      }

      this.redrawLargeRectsAndLabels(shouldUpdateBoundingBox);
    });

    effect(() => {
      const highlightedItem = this.highlightedItem();
      if (this.internalHighlightedItem !== highlightedItem) {
        this.internalHighlightedItem = highlightedItem;
        this.largeRectsMapper3d.setHighlightedRectId(
          this.internalHighlightedItem,
        );
        this.updateLargeRectsAndLabelsColors();
      }
    });

    effect(() => {
      this.isDarkMode();
      this.updateLargeRectsAndLabelsColors();
    });

    effect(() => {
      const pinnedIds = this.pinnedIds();
      this.largeRectsMapper3d.setPinnedIds(pinnedIds);
      this.updateLargeRectsColors();
    });

    effect(() => {
      const miniRects = this.miniRects();
      const isDarkMode = this.isDarkMode();
      if (miniRects && (miniRects.length > 0 || isDarkMode)) {
        this.internalMiniRects = miniRects;
        this.drawMiniRects();
      }
    });

    const defaultRectTypeEffect = effect(() => {
      this.defaultRectType.set(this.rectSpec()?.type);
      defaultRectTypeEffect.destroy();
    });

    const allowedShadingModesEffect = effect(() => {
      this.largeRectsMapper3d.setAllowedShadingModes(this.shadingModes());
      allowedShadingModesEffect.destroy();
    });

    const initialDrawingParamsFromStoreEffect = effect(() => {
      const store = this.store();
      if (store) {
        const redraw = this.updateDrawingParamsFromStore(store);
        if (redraw) {
          this.redrawLargeRectsAndLabels(true);
        }
      }
      initialDrawingParamsFromStoreEffect.destroy();
    });

    const initialDisplaysFromStoreEffect = effect(() => {
      if (this.displays().length === 0) {
        return;
      }
      const store = this.store();
      if (store) {
        const redraw = this.updateDisplaysFromStore(store);
        if (redraw) {
          this.redrawLargeRectsAndLabels(true);
        }
      }
      initialDisplaysFromStoreEffect.destroy();
    });
  }

  ngOnInit() {
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
      () => this.isDarkMode(),
      (id) => this.highlightedIdChange.emit(id),
    );
    this.largeRectsCanvasElement.addEventListener('mousedown', () =>
      this.onCanvasMouseDown(),
    );

    this.largeRectsMapper3d.increaseZoomFactor(this.zoomFactor() - 1);

    this.miniRectsCanvasElement = canvasContainer.querySelector(
      '.mini-rects-canvas',
    )! as HTMLCanvasElement;
    this.miniRectsCanvas = new Canvas(
      this.miniRectsCanvasElement,
      undefined,
      () => this.isDarkMode(),
    );
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
    this.largeRectsCanvas?.onDestroy();
    this.miniRectsCanvas?.onDestroy();
    this.largeRectsCanvasElement?.getContext('2d')?.reset();
    this.miniRectsCanvasElement?.getContext('2d')?.reset();
  }

  private onDisplaysChange(displays: DisplayIdentifier[]) {
    const firstChange = !this.internalDisplays;

    this.internalDisplays = displays;

    if (displays.length === 0) {
      this.updateCurrentDisplays([], false);
      return;
    }

    const activeDisplay = this.getActiveDisplay(this.internalDisplays);
    if (firstChange) {
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

  private updateDrawingParamsFromStore(store: Store): boolean {
    let redraw = false;

    const storedZSpacingFactor = store.get(this.storeKeyZSpacingFactor);
    if (storedZSpacingFactor !== undefined) {
      this.largeRectsMapper3d.setZSpacingFactor(Number(storedZSpacingFactor));
      redraw = true;
    }

    const storedShadingMode = store.get(this.storeKeyShadingMode);
    if (
      storedShadingMode !== undefined &&
      this.shadingModes().includes(storedShadingMode as ShadingMode)
    ) {
      this.largeRectsMapper3d.setShadingMode(storedShadingMode as ShadingMode);
      redraw = true;
    }

    return redraw;
  }

  private updateDisplaysFromStore(store: Store): boolean {
    const storedSelectedDisplays = store.get(this.storeKeySelectedDisplays);
    if (storedSelectedDisplays !== undefined) {
      const storedIds: Array<number | string> = JSON.parse(
        storedSelectedDisplays,
      );
      const displays = assertDefined(this.internalDisplays).filter(
        (display) => {
          return storedIds.some((id) => display.displayId === id);
        },
      );
      if (displays.length > 0) {
        this.updateCurrentDisplays(displays, false);
        return true;
      }
    }
    return false;
  }

  onSeparationSliderChange(factor: number) {
    Analytics.Navigation.logRectSettingsChanged(
      'z spacing',
      factor,
      TRACE_INFO[this.dependencies()[0]].name,
    );
    this.store()?.add(this.storeKeyZSpacingFactor, `${factor}`);
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

  onCanvasMouseDown() {
    document.addEventListener('mousemove', this.mouseMoveListener);
    document.addEventListener('mouseup', this.mouseUpListener);
  }

  onMouseMove(event: MouseEvent) {
    this.panning = true;
    const distance: Distance = {dx: event.movementX, dy: event.movementY};
    this.largeRectsMapper3d.addPanScreenDistance(distance);
    this.updateLargeRectsPosition();
  }

  onMouseUp() {
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
    this.redrawLargeRectsAndLabels(true);
  }

  getSelectTriggerValue(): string {
    return this.currentDisplays.map((d) => d.name).join(', ');
  }

  onOnlyButtonClick(event: MouseEvent, selected: DisplayIdentifier) {
    event.preventDefault();
    event.stopPropagation();
    this.updateCurrentDisplays([selected]);
    this.redrawLargeRectsAndLabels(true);
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

    this.rectsDblClick.emit(clickedRectId);
  }

  onMiniRectDblClick(event: MouseEvent) {
    event.preventDefault();

    this.miniRectsDblClick.emit();
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
      TRACE_INFO[this.dependencies()[0]].name,
    );
    this.store()?.add(this.storeKeyShadingMode, newMode);
    this.updateLargeRectsColors();
    this.changeDetectorRef.detectChanges();
  }

  onInteractionStart(components: Array<MatIconButton | MatSlider | MatIcon>) {
    components.forEach((c) => (c.color = 'primary'));
  }

  onInteractionEnd(components: Array<MatIconButton | MatSlider | MatIcon>) {
    components.forEach((c) => (c.color = 'accent'));
  }

  onRectTypeButtonClicked(event: MatButtonToggleChange) {
    const spec: RectSpec = event.value;
    this.rectTypeButtonClick.emit(spec.type);
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
      assertDefined(displays.at(0)) // assume displays is non-empty
    );
  }

  private updateCurrentDisplays(
    displays: DisplayIdentifier[],
    storeChange = true,
  ) {
    if (storeChange) {
      this.store()?.add(
        this.storeKeySelectedDisplays,
        JSON.stringify(displays.map((d) => d.displayId)),
      );
    }
    this.currentDisplays = displays;
    const groupIds = displays.map((d) => d.groupId);
    this.largeRectsMapper3d.setCurrentGroupIds(groupIds);
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
    this.highlightedIdChange.emit(id);
  }
}

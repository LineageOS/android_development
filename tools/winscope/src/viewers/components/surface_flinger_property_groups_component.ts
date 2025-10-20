/*
 * Copyright (C) 2024 The Android Open Source Project
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
  Inject,
  Input,
  Output,
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatTooltipModule} from '@angular/material/tooltip';
import {assertDefined} from 'common/assert';
import {SfCuratedProperties} from 'viewers/common/curated_properties';
import {UiPropertyTreeNode} from 'viewers/common/ui_property_tree_node';
import {ViewerEvents} from 'viewers/common/viewer_events';
import {CollapsibleSectionTitleComponent} from './collapsible_section_title_component';
import {inlineButtonStyle} from './styles/clickable_property.styles';
import {viewerCardInnerStyle} from './styles/viewer_card.styles';
import {TransformMatrixComponent} from './transform_matrix_component';

@Component({
  selector: 'surface-flinger-property-groups',
  standalone: true,
  imports: [
    CommonModule,
    MatDividerModule,
    MatButtonModule,
    MatTooltipModule,
    CollapsibleSectionTitleComponent,
    TransformMatrixComponent,
  ],
  template: `
    <div class="title-section">
      <collapsible-section-title
        title="PROPERTIES"
        (collapseButtonClicked)="collapseButtonClicked.emit()"></collapsible-section-title>
    </div>

    @if (!properties) {
      <span class="mat-body-1 placeholder-text"> Layer not selected. </span>
    } @else {
      <div class="property-groups-content">
        <div class="group">
          <h3 class="group-header mat-subtitle-1">Visibility</h3>
          <div class="left-column">
            <p class="mat-body-2 flags">
              <span class="mat-body-1">Flags:</span>
              &ngsp;
              {{ properties.flags }}
            </p>
            @for (summaryProperty of properties.summary; track summaryProperty.key) {
              <span class="mat-body-2 summary inline">
                <span class="mat-body-1" [matTooltip]="summaryProperty.desc" [matTooltipShowDelay]="400">{{ summaryProperty.key }}:</span>
                @if (summaryProperty.simpleValue) {
                  {{ summaryProperty.simpleValue }}
                }
                @if (summaryProperty.layerValues) {
                  &ngsp;
                  @for (layer of summaryProperty.layerValues; track layer.nodeId; let i = $index) {
                    <button
                      mat-button
                      color="primary"
                      [matTooltip]="layer.name"
                      (click)="onIdClicked(layer.nodeId)">
                      {{ layer.layerId }}
                    </button>
                    {{(i === summaryProperty.layerValues.length - 1) ? '' : ', '}}
                  }
                }
              </span>
            }
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="group geometry">
          <h3 class="group-header mat-subtitle-1">Geometry</h3>
          <div class="left-column">
            <p class="column-header mat-small">Calculated</p>
            <p
              class="property mat-body-1"
              matTooltip="Requested transform multiplied by any parent transforms.
                  Used on calculated crop to generate final bounds.">Transform:</p>
            @if (properties.calcTransform?.getAllChildren().length > 0) {
              <transform-matrix
                [matTooltip]="getTransformType(properties.calcTransform)"
                [matrix]="getTransformMatrix(properties.calcTransform)"></transform-matrix>
            }
            <p class="mat-body-2 crop">
              <span
                class="mat-body-1"
                matTooltip="Raw value read from proto.bounds. This is the buffer size or
                    requested crop, cropped by parent bounds.">Crop:</span>
              &ngsp;
              {{ properties.calcCrop }}
            </p>

            <p class="mat-body-2 final-bounds">
              <span
                class="mat-body-1"
                matTooltip="Raw value read from proto.screenBounds. This is the calculated crop
                    transformed by calculated transform."
                >Final Bounds:</span
              >
              &ngsp;
              {{ properties.finalBounds }}
            </p>
          </div>
          <div class="right-column">
            <p class="column-header mat-small">Requested</p>
            <p
              class="property mat-body-1"
              matTooltip="Transform requested for this layer, not accounting for parent transforms.">Transform:</p>
            @if (properties.reqTransform?.getAllChildren().length > 0) {
              <transform-matrix
                [matTooltip]="getTransformType(properties.reqTransform)"
                [matrix]="getTransformMatrix(properties.reqTransform)"></transform-matrix>
            }
            <p class="mat-body-2 crop">
              <span
                class="mat-body-1"
                matTooltip="Requested crop">Crop:</span>
              &ngsp;
              {{ properties.reqCrop }}
            </p>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="group buffer">
          <h3 class="group-header mat-subtitle-1">Buffer</h3>
          <div class="left-column">
            <p
              class="mat-body-2 size"
              matTooltip="Width, height, stride and format of active buffer, if available.">
              <span class="mat-body-1">Size:</span>
              &ngsp;
              {{ properties.bufferSize }}
            </p>
            <p class="mat-body-2 frame-number">
              <span class="mat-body-1">Frame Number:</span>
              &ngsp;
              {{ properties.frameNumber }}
            </p>
            <p class="mat-body-2 transform">
              <span
                class="mat-body-1"
                matTooltip="Rotates or flips the buffer in place. Used with display transform
                    hint to cancel out any buffer transformation when sending to
                    HWC."
                >Transform:</span
              >
              &ngsp;
              {{ properties.bufferTransformType }}
            </p>
          </div>
          <div class="right-column">
            <p class="mat-body-2 dest-frame">
              <span
                class="mat-body-1"
                matTooltip="Scales buffer to the frame by overriding the requested transform
                    for this item.">Destination Frame:</span>
              &ngsp;
              {{ properties.destinationFrame }}
            </p>
            @if (properties.ignoreDestinationFrame) {
              <p class="mat-body-2 ignore-frame">
                Destination Frame ignored because item has eIgnoreDestinationFrame flag set.
              </p>
            }
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="group hierarchy-info">
          <h3 class="group-header mat-subtitle-1">Hierarchy</h3>
          <div class="left-column">
            <p class="mat-body-2 z-order">
              <span class="mat-body-1">Z-order:</span>
              &ngsp;
              {{ properties.z }}
            </p>
            <p class="mat-body-2 rel-parent inline">
              <span
                class="mat-body-1"
                matTooltip="Item is z-ordered relative to its relative parents but its bounds
                    and other properties are inherited from its parents."
                >Relative Parent:</span>
              &ngsp;
              @if (!properties.relativeParent.nodeId) {
                {{ properties.relativeParent }}
              } @else {
                <button
                  mat-button
                  color="primary"
                  [matTooltip]="properties.relativeParent.name"
                  (click)="onIdClicked(properties.relativeParent.nodeId)">
                  {{ properties.relativeParent.layerId }}
                </button>
              }
            </p>
            <span class="mat-body-2 rel-children inline">
              <span class="mat-body-1">Relative Children:</span>
              &ngsp;
              @if (properties.relativeChildren.length === 0) {
                none
              } @else {
                @for (layer of properties.relativeChildren; track layer.nodeId; let i = $index) {
                  <button
                    mat-button
                    color="primary"
                    [matTooltip]="layer.name"
                    (click)="onIdClicked(layer.nodeId)">
                    {{ layer.layerId }}
                  </button>
                  {{(i === properties.relativeChildren.length - 1) ? '' : ', '}}
                }
              }
            </span>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="group effects">
          <h3 class="group-header mat-subtitle-1">Effects</h3>
          <div class="left-column">
            <p class="column-header mat-small">Calculated</p>
            <p class="mat-body-2 color">
              <span
                class="mat-body-1"
                matTooltip="Final color - alpha may be inherited from a parent layer.">Color:</span>
              &ngsp;
              {{ properties.calcColor }}
            </p>
            <p class="mat-body-2 corner-radius">
              <span
                class="mat-body-1"
                matTooltip="Final corner radii (<TL>, <TR>, <BL>, <BR>) - may be affected by parent corner radii.">Corner Radii:</span>
              &ngsp;
              {{ properties.calcCornerRadii }}
            </p>
            <p class="mat-body-2 shadow">
              <span class="mat-body-1">Shadow Radius:</span>
              &ngsp;
              {{ properties.calcShadowRadius }}
            </p>
            <p class="mat-body-2">
              <span
                class="mat-body-1"
                matTooltip="Crop used to define the bounds of the corner radii. If the bounds
                    are greater than the item bounds then the rounded corner will not
                    be visible."
                >Corner Radius Crop:</span
              >
              &ngsp;
              {{ properties.calcCornerRadiusCrop }}
            </p>
            <p class="mat-body-2 blur">
              <span class="mat-body-1">Blur Radius:</span>
              &ngsp;
              {{ properties.backgroundBlurRadius }}
            </p>
          </div>
          <div class="right-column">
            <p class="column-header mat-small">Requested</p>
            <p class="mat-body-2">
              <span
                class="mat-body-1"
                matTooltip="Requested color and alpha for this layer.">Color:</span>
              &ngsp;
              {{ properties.reqColor }}
            </p>
            <p class="mat-body-2 corner-radius">
              <span
                class="mat-body-1"
                matTooltip="Requested corner radii (<TL>, <TR>, <BL>, <BR>) not accounting for any parent values.">Corner Radii:</span>
              &ngsp;
              {{ properties.reqCornerRadii }}
            </p>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="group inputs">
          <h3 class="group-header mat-subtitle-1">Input</h3>
          @if (properties.hasInputChannel) {
            <div class="left-column">
              <p class="property mat-body-1">To Display Transform:</p>
              @if (properties.inputTransform?.getAllChildren().length > 0) {
                <transform-matrix
                  [matTooltip]="getTransformType(properties.inputTransform)"
                  [matrix]="getTransformMatrix(properties.inputTransform)"></transform-matrix>
              }
              <p class="mat-body-2">
                <span class="mat-body-1">Touchable Region:</span>
                &ngsp;
                {{ properties.inputRegion }}
              </p>
            </div>
            <div class="right-column">
              <p class="column-header mat-small">Config</p>
              <p class="mat-body-2 focusable">
                <span class="mat-body-1">Focusable:</span>
                &ngsp;
                {{ properties.focusable }}
              </p>
              <p class="mat-body-2 crop-touch-region">
                <span class="mat-body-1">Crop touch region with item:</span>
                &ngsp;
                {{ properties.cropTouchRegionWithItem }}
              </p>
              <p class="mat-body-2 replace-touch-region">
                <span class="mat-body-1">Replace touch region with crop:</span>
                &ngsp;
                {{ properties.replaceTouchRegionWithCrop }}
              </p>
              <p class="mat-body-2 input-config">
                <span class="mat-body-1">Input Config:</span>
                &ngsp;
                {{ properties.inputConfig }}
              </p>
            </div>
          } @else {
            <div class="left-column">
              <p class="mat-body-2">
                <span class="mat-body-1">Input Channel:</span>
                &ngsp; not set
              </p>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .placeholder-text {
        padding: 8px 12px;
      }

      .property-groups-content {
        overflow-y: auto;
        padding: 0px 12px;
      }

      .group {
        display: flex;
        flex-direction: row;
        padding: 8px;
      }

      .group-header {
        width: 80px;
        color: gray;
      }

      .left-column {
        flex: 1;
        padding: 0 5px;
      }

      .right-column {
        flex: 1;
        border: 1px solid var(--border-color);
        border-left-width: 5px;
        padding: 0 5px;
      }

      .column-header {
        color: gray;
      }

      .summary {
        display: block;
      }
    `,
    inlineButtonStyle,
    viewerCardInnerStyle,
  ],
})
export class SurfaceFlingerPropertyGroupsComponent {
  @Input() properties: SfCuratedProperties | undefined;

  @Output() collapseButtonClicked = new EventEmitter();

  constructor(@Inject(ElementRef) private elementRef: ElementRef) {}

  getTransformType(transformNode: UiPropertyTreeNode): string {
    const typeFlags = transformNode.formattedValue();
    return typeFlags !== 'null' ? typeFlags : 'IDENTITY';
  }

  getTransformMatrix(transformNode: UiPropertyTreeNode): UiPropertyTreeNode {
    return assertDefined(transformNode.getChildByName('matrix'));
  }

  onIdClicked(layerNodeId: string) {
    const event = new CustomEvent(ViewerEvents.HighlightedIdChange, {
      bubbles: true,
      detail: {id: layerNodeId},
    });
    this.elementRef.nativeElement.dispatchEvent(event);
  }
}

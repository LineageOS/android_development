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
import {assertDefined} from '@common/assert';
import {SfCuratedProperties} from '@viewers/common/curated_properties';
import {UiPropertyTreeNode} from '@viewers/common/ui_property_tree_node';
import {ViewerEvents} from '@viewers/common/viewer_events';
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
  templateUrl: './surface_flinger_property_groups_component.ng.html',
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

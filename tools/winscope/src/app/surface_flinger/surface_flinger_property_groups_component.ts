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
import {Component, ElementRef, Inject, input, output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatTooltipModule} from '@angular/material/tooltip';
import {CollapsibleSectionTitleComponent} from '@app/shared/collapsible_sections/collapsible_section_title_component';
import {assertDefined} from '@common/assert';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {SfCuratedProperties, SfLayerSummary,} from '@ui/shared/properties/curated_properties';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';

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
  styleUrls: ['./surface_flinger_property_groups_component.scss'],
})
export class SurfaceFlingerPropertyGroupsComponent {
  properties = input<SfCuratedProperties>();

  collapseButtonClicked = output<void>();
  readonly highlightedIdChange = output<string>();

  constructor(
    @Inject(ElementRef) readonly elementRef: ElementRef<HTMLElement>,
  ) {}

  getTransformType(transformNode: PropertyTreeNode | undefined): string {
    const typeFlags = transformNode?.formattedValue() ?? 'null';
    return typeFlags !== 'null' ? typeFlags : 'IDENTITY';
  }

  getTransformMatrix(
    transformNode: PropertyTreeNode | undefined,
  ): UiPropertyTreeNode {
    return UiPropertyTreeNode.from(
      assertDefined(transformNode?.getChildByName('matrix')),
    );
  }

  onIdClicked(layerNodeId: string) {
    this.highlightedIdChange.emit(layerNodeId);
  }

  isSfLayerSummary(
    relativeParent: string | SfLayerSummary,
  ): relativeParent is SfLayerSummary {
    return typeof relativeParent !== 'string';
  }
}

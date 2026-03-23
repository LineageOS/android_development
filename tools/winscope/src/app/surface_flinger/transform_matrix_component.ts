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
import {Component, computed, input} from '@angular/core';
import {MatTooltipModule} from '@angular/material/tooltip';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';

@Component({
  selector: 'transform-matrix',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './transform_matrix_component.ng.html',
  styleUrls: ['transform_matrix_component.scss'],
})
export class TransformMatrixComponent {
  matrix = input.required<UiPropertyTreeNode>();

  readonly dsdx = computed(() => {
    return this.getVal(this.matrix().getChildByName('dsdx'));
  });
  readonly dtdx = computed(() => {
    return this.getVal(this.matrix().getChildByName('dtdx'));
  });
  readonly tx = computed(() => {
    return this.getVal(this.matrix().getChildByName('tx'));
  });
  readonly dtdy = computed(() => {
    return this.getVal(this.matrix().getChildByName('dtdy'));
  });
  readonly dsdy = computed(() => {
    return this.getVal(this.matrix().getChildByName('dsdy'));
  });
  readonly ty = computed(() => {
    return this.getVal(this.matrix().getChildByName('ty'));
  });

  private getVal(node: UiPropertyTreeNode | undefined): string {
    return node?.formattedValue() ?? 'null';
  }
}

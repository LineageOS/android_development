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
import {Component, input} from '@angular/core';
import {MatTooltipModule} from '@angular/material/tooltip';
import {UiPropertyTreeNode} from '@viewers/common/ui_property_tree_node';

@Component({
  selector: 'transform-matrix',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './transform_matrix_component.ng.html',
  styleUrls: ['transform_matrix_component.css'],
})
export class TransformMatrixComponent {
  matrix = input<UiPropertyTreeNode>();

  getVal(name: string): string {
    return this.matrix()?.getChildByName(name)?.formattedValue() ?? 'null';
  }
}

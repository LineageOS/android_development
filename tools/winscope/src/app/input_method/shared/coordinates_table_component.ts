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
import {PropertyTreeNode} from '@tree_node/property_tree_node';

@Component({
  selector: 'coordinates-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coordinates_table_component.ng.html',
  styleUrls: ['coordinates_table_component.scss'],
})
export class CoordinatesTableComponent {
  coordinates = input<PropertyTreeNode>();

  readonly hasCoordinates = computed(() => {
    const coordinates = this.coordinates();
    return (
      coordinates?.getChildByName('left') ||
      coordinates?.getChildByName('right') ||
      coordinates?.getChildByName('top') ||
      coordinates?.getChildByName('bottom')
    );
  });
}

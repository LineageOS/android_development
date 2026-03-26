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
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {Chip} from '@ui/shared/user_input/chip';

@Component({
  selector: 'hierarchy-tree-node-data-view',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './hierarchy_tree_node_data_view_component.ng.html',
  styleUrls: ['hierarchy_tree_node_data_view_component.scss'],
})
export class HierarchyTreeNodeDataViewComponent {
  readonly node = input.required<UiHierarchyTreeNode>();

  readonly nameTooltip = computed<string | undefined>(() => {
    const n = this.node();
    if (n.name !== n.getDisplayName()) {
      return n.name;
    }
    return undefined;
  });

  chipClass(chip: Chip) {
    return [
      'tree-view-internal-chip',
      'tree-view-chip',
      'tree-view-chip' + '-' + (chip.type.toString() || 'default'),
    ];
  }
}

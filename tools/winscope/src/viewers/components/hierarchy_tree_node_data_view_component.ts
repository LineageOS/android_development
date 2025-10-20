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
import {Component, Input} from '@angular/core';
import {MatTooltipModule} from '@angular/material/tooltip';
import {Chip} from 'viewers/common/chip';
import {UiHierarchyTreeNode} from 'viewers/common/ui_hierarchy_tree_node';
import {hierarchyTreeNodeDataViewStyles} from 'viewers/components/styles/tree_node_data_view.styles';

@Component({
  selector: 'hierarchy-tree-node-data-view',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  template: `
    @if (node) {
      <span class="mat-body-1">
        @if (node.heading()) {
          <span class="mat-body-2">{{ node.heading() }}</span>
        }
        @if (node.heading()) {
          &ngsp;-&ngsp;
        }
        <span class="display-name" [matTooltip]="getNameTooltip()" [matTooltipShowDelay]="300">{{ node.getDisplayName() }}</span>
        @for (chip of node.getChips(); track chip.short) {
          <div [class]="chipClass(chip)" [matTooltip]="chip.long">
            {{ chip.short }}
          </div>
        }
      </span>
    }
  `,
  styles: [hierarchyTreeNodeDataViewStyles],
})
export class HierarchyTreeNodeDataViewComponent {
  @Input() node?: UiHierarchyTreeNode;

  getNameTooltip(): string | undefined {
    if (this.node?.name !== this.node?.getDisplayName()) {
      return this.node?.name;
    }
    return undefined;
  }

  chipClass(chip: Chip) {
    return [
      'tree-view-internal-chip',
      'tree-view-chip',
      'tree-view-chip' + '-' + (chip.type.toString() || 'default'),
    ];
  }
}

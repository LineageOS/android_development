/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {TreeNodeHeightPredictor} from '@app/shared/tree/tree_node_height_predictor';
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';

export class HierarchyNodeHeightPredictor extends TreeNodeHeightPredictor<UiHierarchyTreeNode> {
  private readonly chipPaddingWidth = 30;

  protected override getRowWidth(
    nodeRow: FlattenedTreeRow<UiHierarchyTreeNode>,
    fullWidth: number,
  ): number {
    // subtract leaf/chevron icon + depth indicator
    let rowWidth = fullWidth - (1 + nodeRow.depth) * this.nodeIconWidth;
    if (!nodeRow.node.isRoot()) {
      // subtract pin icon
      rowWidth -= this.nodeIconWidth;
    }
    return rowWidth;
  }

  protected override getTextWidths(node: UiHierarchyTreeNode): number[] {
    let textWidth = node.getDisplayName().length * this.charWidth;
    const heading = node.heading();
    if (heading !== undefined) {
      // "<heading> - " precedes display name
      textWidth += (heading.length + 3) * this.charWidth;
    }
    node.getChips().forEach((chip) => {
      textWidth += chip.short.length * this.charWidth + this.chipPaddingWidth;
    });
    return [textWidth];
  }
}

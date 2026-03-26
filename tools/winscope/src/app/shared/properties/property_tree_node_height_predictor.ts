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
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {DiffType} from '@ui/shared/tree/diff_type';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';

export class PropertyNodeHeightPredictor extends TreeNodeHeightPredictor<UiPropertyTreeNode> {
  protected override getRowWidth(
    nodeRow: FlattenedTreeRow<UiPropertyTreeNode>,
    fullWidth: number,
  ): number {
    // leaf/chevron icon + copy icon + depth indicator
    const iconWidths = (2 + nodeRow.depth) * this.nodeIconWidth;
    const keyWidth = this.getKeyWidth(nodeRow.node);
    const maxRowWidth = fullWidth - iconWidths - keyWidth;

    // in case of key overflow, 1 char per text row is shown
    return Math.max(this.charWidth, maxRowWidth);
  }

  protected override getTextWidths(node: UiPropertyTreeNode): number[] {
    const widths: number[] = [];
    const propertyWidth = node.formattedValue().length * this.charWidth;
    widths.push(propertyWidth);
    if (node.getDiff() === DiffType.MODIFIED) {
      const oldValueWidth = node.getOldValue().length * this.charWidth;
      widths.push(oldValueWidth);
    }
    return widths;
  }

  private getKeyWidth(node: UiPropertyTreeNode): number {
    let keyLength = node.getDisplayName().length;
    if (node.formattedValue()) {
      // node with formatted value shown as "<display_name>: <value>"
      keyLength += 2;
    }
    return keyLength * this.charWidth;
  }
}

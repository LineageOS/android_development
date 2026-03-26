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

import {TreeNode} from '@tree_node/tree_node';

import {FlattenedTreeRow} from './flattened_tree_row';
import {UiTreeNode} from './ui_tree_node';

export type TreeNodeFilter = (node: TreeNode) => boolean;

/**
 * Checks if an item is highlighted.
 *
 * @param item The item to check.
 * @param highlighted The highlighted item's id.
 * @return True if the item is highlighted, false otherwise.
 */
export function isHighlighted(item: TreeNode, highlighted: string): boolean {
  return highlighted === item.id;
}

/**
 * Flattens trees in DFS order to an array of FlattenedTreeRows, so we only have to
 * render the subset of rows that is visible in the viewport.
 *
 * @param trees The trees to flatten.
 * @param processDepth Whether the depth parameter should be set or not - false for
 * user-flattened hierarchies.
 * @param addGutter Whether a gutter should be added to the offset styles - used
 * for rect show state controls in the UI.
 * @param highlightedId The current highlighted item id, used to determine highlight
 * depths to render vertical depth lines in the UI.
 * @return An array of FlattenedTreeRows in DFS order.
 */
export function flattenNodesToRows<T extends UiTreeNode>(
  trees: T[],
  processDepth: boolean,
  addGutter: boolean,
  highlightedId: string,
): Array<FlattenedTreeRow<T>> {
  const rowsDfs: Array<FlattenedTreeRow<T>> = [];

  const processNode = (node: UiTreeNode, depth: number) => {
    const storeKey = `${node.id}.collapsedState`;
    const offsetStyle = getNodeOffsetStyle(addGutter);
    const row: FlattenedTreeRow<T> = {
      node: node as T,
      storeKey,
      depth: processDepth ? depth : 0,
      originalIndex: rowsDfs.length,
      localExpandedState: true,
      isHiddenByCollapsedParent: false,
      offsetStyle,
      parentHighlightDepth: undefined,
      childHighlightDepth: undefined,
    };
    rowsDfs.push(row);
  };

  const skipChildren = (node: UiTreeNode) => {
    return node.isLeaf();
  };

  trees.forEach((tree) => {
    tree.forEachNodeDfs(processNode, false, 0, skipChildren);
  });

  const index = rowsDfs.findIndex((r) => r.node.id === highlightedId);

  if (index !== -1) {
    const highlightedNode = rowsDfs[index];
    const highlightedNodeDepth = highlightedNode.depth;
    const parentDepth = highlightedNodeDepth - 1;

    let childrenComplete = false;
    for (let i = index + 1; i < rowsDfs.length; i++) {
      const row = rowsDfs[i];
      if (!childrenComplete && row.depth > highlightedNodeDepth) {
        row.childHighlightDepth = highlightedNodeDepth;
      }
      if (row.depth === highlightedNodeDepth) {
        childrenComplete = true;
      }
      if (row.depth <= parentDepth) {
        break;
      }
      row.parentHighlightDepth = parentDepth;
    }

    for (let i = index - 1; i >= 0; i--) {
      const row = rowsDfs[i];
      if (row.depth <= parentDepth) {
        break;
      }
      row.parentHighlightDepth = parentDepth;
    }
  }

  return rowsDfs;
}

function getNodeOffsetStyle(addGutter: boolean): object | undefined {
  if (!addGutter) {
    return undefined;
  }
  const padding = 12;
  return {
    paddingLeft: padding + 'px',
    width: `calc(100% - ${padding}px)`,
  };
}

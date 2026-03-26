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
import {DiffType} from '@ui/shared/tree/diff_type';

import {UiHierarchyTreeNode} from './ui_hierarchy_tree_node';

export type TreeNodeFilter = (node: TreeNode) => boolean;

/**
 * Checks if a node is visible.
 *
 * @param node The node to check.
 * @return True if the node is visible, false otherwise.
 */
export const isVisible: (node: TreeNode) => boolean = (node: TreeNode) => {
  if (!(node instanceof UiHierarchyTreeNode)) {
    return false;
  }
  const isComputedVisible = node
    .getEagerPropertyByName('isComputedVisible')
    ?.getValue<boolean>();
  if (isComputedVisible !== undefined) {
    return isComputedVisible;
  }
  return node.getEagerPropertyByName('isVisible')?.getValue<boolean>() ?? false;
};

/**
 * Checks if a node should have its properties fetched.
 *
 * @param node The node to check.
 * @return True if the node should have its properties fetched, false otherwise.
 */
export function shouldGetProperties(node: UiHierarchyTreeNode): boolean {
  return !node.isOldNode() || node.getDiff() === DiffType.DELETED;
}

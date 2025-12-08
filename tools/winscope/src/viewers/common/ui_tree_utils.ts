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

import {PropertySource, PropertyTreeNode} from 'tree_node/property_tree_node';
import {TreeNode} from 'tree_node/tree_node';
import {StringFilterPredicate} from 'viewers/common/string_filter_predicate';
import {DiffType} from './diff_type';
import {UiHierarchyTreeNode} from './ui_hierarchy_tree_node';
import {UiPropertyTreeNode} from './ui_property_tree_node';

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
 * Creates a filter that removes default properties, unless they are in the allow list.
 *
 * @param allowList The list of properties to allow.
 * @return A filter function.
 */
export function makeIsNotDefaultFilter(
  allowList: string[],
): (node: TreeNode) => boolean {
  return (node: TreeNode) => {
    return (
      node instanceof UiPropertyTreeNode &&
      (node.source !== PropertySource.DEFAULT || allowList.includes(node.name))
    );
  };
}

/**
 * A filter that removes calculated properties.
 *
 * @param node The node to check.
 * @return True if the node is not calculated, false otherwise.
 */
export const isNotCalculated: (node: TreeNode) => boolean = (
  node: TreeNode,
) => {
  return (
    node instanceof UiPropertyTreeNode &&
    node.source !== PropertySource.CALCULATED
  );
};

/**
 * A filter that removes properties from the trace processor.
 *
 * @param node The node to check.
 * @return True if the node is not from the trace processor, false otherwise.
 */
export const isNotFromTP: (node: TreeNode) => boolean = (node: TreeNode) => {
  return (
    node instanceof UiPropertyTreeNode && node.source !== PropertySource.TP
  );
};

/**
 * Creates a filter that checks if a node's id or formatted value matches a predicate.
 *
 * @param predicate The predicate to use.
 * @return A filter function.
 */
export function makeNodeFilter(
  predicate: StringFilterPredicate,
): (node: TreeNode) => boolean {
  return (node: TreeNode) => {
    return (
      predicate(node.id) ||
      (node instanceof PropertyTreeNode && predicate(node.formattedValue()))
    );
  };
}

/**
 * Creates a filter that checks if a node's id matches a target id.
 *
 * @param targetId The target id to match.
 * @return A filter function.
 */
export function makeIdMatchFilter(
  targetId: string,
): (node: TreeNode) => boolean {
  return (node: TreeNode) => node.id === targetId;
}

/**
 * Creates a filter that removes nodes whose name is in a denylist.
 *
 * @param denylist The list of names to deny.
 * @return A filter function.
 */
export function makeDenyListFilterByName(
  denylist: string[],
): (node: TreeNode) => boolean {
  return (node: TreeNode) => !denylist.includes(node.name);
}

/**
 * Checks if a node should have its properties fetched.
 *
 * @param node The node to check.
 * @return True if the node should have its properties fetched, false otherwise.
 */
export function shouldGetProperties(node: UiHierarchyTreeNode): boolean {
  return !node.isOldNode() || node.getDiff() === DiffType.DELETED;
}

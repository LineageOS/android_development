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

import {StringFilterPredicate} from '@common/string_filter_predicate';

import {PropertyTreeNode} from './property_tree_node';
import {TreeNode} from './tree_node';

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

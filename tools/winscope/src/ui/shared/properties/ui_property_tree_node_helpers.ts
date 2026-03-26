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

import {PropertySource} from '@tree_node/property_tree_node';
import {TreeNode} from '@tree_node/tree_node';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';

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

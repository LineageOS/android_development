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
import {testTreeNodes as baseTestTreeNodes} from '@tree_node/testing/tree_node_test_helpers';
import {TreeNode} from '@tree_node/tree_node';
import {UiTreeNode} from '@ui/shared/tree/ui_tree_node';

/**
 * Custom equality tester for tree nodes in Jasmine tests.
 *
 * @param first The first tree node to compare.
 * @param second The second tree node to compare.
 * @return True if the nodes are equal, false otherwise.
 */
export function treeNodeEqualityTester(
  first: unknown,
  second: unknown,
): boolean | undefined {
  if (first instanceof TreeNode && second instanceof TreeNode) {
    return testTreeNodes(first, second);
  }
  return undefined;
}

export function testTreeNodes(node: TreeNode, expectedNode: TreeNode): boolean {
  if ((node as UiTreeNode).getDiff && (expectedNode as UiTreeNode).getDiff) {
    if (
      (node as UiTreeNode).getDiff() !== (expectedNode as UiTreeNode).getDiff()
    ) {
      return false;
    }
  }
  return baseTestTreeNodes(node, expectedNode);
}

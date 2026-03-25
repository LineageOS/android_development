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

import {makeHierarchyNode} from '@tree_node/testing/tree_node_test_helpers';
import {TreeNode} from '@tree_node/tree_node';
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {testTreeNodes as baseTestTreeNodes} from '@ui/shared/tree/testing/ui_tree_node_test_helpers';

/**
 * Creates a UI hierarchy tree node for tests.
 *
 * @param proto The node's properties.
 * @return The constructed UI hierarchy tree node.
 */
export function makeUiHierarchyNode(proto: object): UiHierarchyTreeNode {
  return UiHierarchyTreeNode.from(makeHierarchyNode(proto));
}

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

function testTreeNodes(node: TreeNode, expectedNode: TreeNode): boolean {
  if (
    node instanceof UiHierarchyTreeNode &&
    expectedNode instanceof UiHierarchyTreeNode
  ) {
    if (node.heading() !== expectedNode.heading()) {
      return false;
    }
    if (node.getDisplayName() !== expectedNode.getDisplayName()) {
      return false;
    }
    const chips = node.getChips();
    const expChips = expectedNode.getChips();
    if (
      chips.length !== expChips.length ||
      !chips.every((chip, i) => chip === expChips[i])
    ) {
      return false;
    }
  }

  return baseTestTreeNodes(node, expectedNode);
}

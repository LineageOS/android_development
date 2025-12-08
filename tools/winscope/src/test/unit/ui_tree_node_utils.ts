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

import {TreeNode} from 'tree_node/tree_node';
import {DiffNode} from 'viewers/common/diff_node';
import {UiHierarchyTreeNode} from 'viewers/common/ui_hierarchy_tree_node';
import {UiPropertyTreeNode} from 'viewers/common/ui_property_tree_node';
import {makeHierarchyNode, makePropertyNode} from './tree_node_test_helpers';

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
 * Creates a UI property tree node for tests.
 *
 * @param rootId The node's identifier.
 * @param name The node's name.
 * @param value The node's value.
 * @return The constructed UI property tree node.
 */
export function makeUiPropertyNode(
  rootId: string,
  name: string,
  value: any,
): UiPropertyTreeNode {
  return UiPropertyTreeNode.from(makePropertyNode(rootId, name, value));
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
  if (node.id !== expectedNode.id) return false;
  if (node.name !== expectedNode.name) return false;

  if ((node as DiffNode).getDiff && (expectedNode as DiffNode).getDiff) {
    if ((node as DiffNode).getDiff() !== (expectedNode as DiffNode).getDiff()) {
      return false;
    }
  }

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

  const nodeChildren = node.getAllChildren();
  const expectedChildren = expectedNode.getAllChildren();
  if (nodeChildren.length !== expectedChildren.length) return false;

  for (let i = 0; i < nodeChildren.length; i++) {
    const nodeChild = nodeChildren[i];
    const expectedChild = expectedChildren[i];

    if (!testTreeNodes(nodeChild, expectedChild)) {
      return false;
    }
  }
  return true;
}

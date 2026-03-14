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

import {TransformTypeFlags} from '@common/geometry/transform';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertyTreeNode, PropertyValue} from '@tree_node/property_tree_node';
import {DEFAULT_PROPERTY_TREE_NODE_FACTORY} from '@tree_node/property_tree_node_factory';
import {TreeNode} from '@tree_node/tree_node';

import {ChildHierarchy, HierarchyTreeBuilder} from './hierarchy_tree_builder';
import {PropertyTreeBuilder} from './property_tree_builder';

/**
 * Creates a rectangle property tree node for tests.
 *
 * @param left Left coordinate of the rectangle.
 * @param top Top coordinate of the rectangle.
 * @param right Right coordinate of the rectangle.
 * @param bottom Bottom coordinate of the rectangle.
 * @param id The node's identifier.
 * @return The constructed property tree node.
 */
export function makeRectNode(
  left: number | undefined,
  top: number | undefined,
  right: number | undefined,
  bottom: number | undefined,
  id = 'test node',
): PropertyTreeNode {
  const children = [];
  if (left !== undefined) children.push({name: 'left', value: left});
  if (top !== undefined) children.push({name: 'top', value: top});
  if (right !== undefined) children.push({name: 'right', value: right});
  if (bottom !== undefined) children.push({name: 'bottom', value: bottom});

  return new PropertyTreeBuilder()
    .setRootId(id)
    .setName('rect')
    .setChildren(children)
    .build();
}

/**
 * Creates a color property tree node for tests.
 *
 * @param r Red component of the color.
 * @param g Green component of the color.
 * @param b Blue component of the color.
 * @param a Alpha component of the color.
 * @return The constructed property tree node.
 */
export function makeColorNode(
  r: number | undefined,
  g: number | undefined,
  b: number | undefined,
  a: number | undefined,
): PropertyTreeNode {
  const children = [];
  if (r !== undefined) children.push({name: 'r', value: r});
  if (g !== undefined) children.push({name: 'g', value: g});
  if (b !== undefined) children.push({name: 'b', value: b});
  if (a !== undefined) children.push({name: 'a', value: a});

  return new PropertyTreeBuilder()
    .setRootId('test node')
    .setName('color')
    .setChildren(children)
    .build();
}

/**
 * Creates a buffer property tree node for tests.
 *
 * @return The constructed property tree node.
 */
export function makeBufferNode(): PropertyTreeNode {
  return new PropertyTreeBuilder()
    .setRootId('test node')
    .setName('buffer')
    .setChildren([
      {name: 'height', value: 0},
      {name: 'width', value: 1},
      {name: 'stride', value: 0},
      {name: 'format', value: 1},
    ])
    .build();
}

/**
 * Creates a matrix property tree node for tests.
 *
 * @param dsdx
 * @param dtdx
 * @param dtdy
 * @param dsdy
 * @return The constructed property tree node.
 */
export function makeMatrixNode(
  dsdx: number,
  dtdx: number,
  dtdy: number,
  dsdy: number,
): PropertyTreeNode {
  return new PropertyTreeBuilder()
    .setRootId('test node')
    .setName('matrix')
    .setChildren([
      {name: 'dsdx', value: dsdx},
      {name: 'dtdx', value: dtdx},
      {name: 'dtdy', value: dtdy},
      {name: 'dsdy', value: dsdy},
    ])
    .build();
}

/**
 * Creates a transform property tree node for tests.
 *
 * @param type The transform type.
 * @return The constructed property tree node.
 */
export function makeTransformNode(type: TransformTypeFlags): PropertyTreeNode {
  return new PropertyTreeBuilder()
    .setRootId('test node')
    .setName('transform')
    .setChildren([{name: 'type', value: type}])
    .build();
}

/**
 * Creates a size property tree node for tests.
 *
 * @param w Width.
 * @param h Height.
 * @return The constructed property tree node.
 */
export function makeSizeNode(
  w: number | undefined,
  h: number | undefined,
): PropertyTreeNode {
  return new PropertyTreeBuilder()
    .setRootId('test node')
    .setName('size')
    .setChildren([
      {name: 'w', value: w},
      {name: 'h', value: h},
    ])
    .build();
}

/**
 * Creates a position property tree node for tests.
 *
 * @param x X coordinate.
 * @param y Y coordinate.
 * @return The constructed property tree node.
 */
export function makePositionNode(
  x: number | undefined,
  y: number | undefined,
): PropertyTreeNode {
  return new PropertyTreeBuilder()
    .setRootId('test node')
    .setName('pos')
    .setChildren([
      {name: 'x', value: x},
      {name: 'y', value: y},
    ])
    .build();
}

/**
 * Creates a hierarchy tree node for tests.
 *
 * @param proto The node's properties.
 * @param children The node's children.
 * @return The constructed hierarchy tree node.
 */
export function makeHierarchyNode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proto: any,
  children: ChildHierarchy[] = [],
): HierarchyTreeNode {
  return new HierarchyTreeBuilder()
    .setId(`${proto.id}`)
    .setName(proto.name)
    .setProperties(proto)
    .setChildren(children)
    .build();
}

/**
 * Creates a property tree node for tests.
 *
 * @param rootId The node's identifier.
 * @param name The node's name.
 * @param value The node's value.
 * @return The constructed property tree node.
 */
export function makePropertyNode(
  rootId: string,
  name: string,
  value: PropertyValue | undefined,
): PropertyTreeNode {
  return DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeProtoProperty(
    rootId,
    name,
    value,
  );
}

/**
 * Creates a property tree node with a calculated value for tests.
 *
 * @param rootId The node's identifier.
 * @param name The node's name.
 * @param value The node's value.
 * @return The constructed property tree node.
 */
export function makeCalculatedPropertyNode(
  rootId: string,
  name: string,
  value: PropertyValue | undefined,
): PropertyTreeNode {
  return DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeCalculatedProperty(
    rootId,
    name,
    value,
  );
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

/**
 * Recursively compares two `TreeNode` objects for equality.
 *
 * This function checks if two tree nodes have the same ID, name, and
 * an identical structure of children. It's used as a helper for
 * `treeNodeEqualityTester` to provide deep equality checks for tree nodes
 * within Jasmine tests. This ensures that test assertions on tree structures
 * correctly validate the entire tree content, not just the root node.
 *
 * @param node The first tree node to compare.
 * @param expectedNode The second tree node to compare against.
 * @return True if the nodes and their descendants are equal, false otherwise.
 */
export function testTreeNodes(node: TreeNode, expectedNode: TreeNode): boolean {
  if (node.id !== expectedNode.id) return false;
  if (node.name !== expectedNode.name) return false;

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

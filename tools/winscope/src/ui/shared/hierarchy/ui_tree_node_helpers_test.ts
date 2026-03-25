/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {RECT_FORMATTER} from '@trace/formatters';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {makeRectNode} from '@tree_node/testing/tree_node_test_helpers';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';

import {UiHierarchyTreeNode} from './ui_hierarchy_tree_node';
import {UiTreeNode} from './ui_tree_node';
import {flattenNodesToRows} from './ui_tree_node_helpers';

describe('ui_tree_node_helpers', () => {
  describe('flattenNodesToRow', () => {
    it('flattens single tree in DFS order', () => {
      const tree = UiHierarchyTreeNode.from(
        new HierarchyTreeBuilder()
          .setId('Root')
          .setName('Node')
          .setChildren([
            {id: '1', name: 'c1', children: [{id: '2', name: 'c2'}]},
            {id: '3', name: 'c3'},
          ])
          .build(),
      );
      const rows = flattenNodesToRows([tree], false, false, '');

      const dfsNodes: UiHierarchyTreeNode[] = [];
      tree.forEachNodeDfs((node) => dfsNodes.push(node));
      expect(rows).toEqual(
        dfsNodes.map((node, index) => {
          return makeExpectedRow(node, index);
        }),
      );
    });

    it('flattens multiple trees sequentially', () => {
      const tree1 = UiHierarchyTreeNode.from(
        new HierarchyTreeBuilder()
          .setId('Root')
          .setName('Node')
          .setChildren([
            {id: '1', name: 'c1', children: [{id: '2', name: 'c2'}]},
          ])
          .build(),
      );
      const tree2 = UiHierarchyTreeNode.from(
        new HierarchyTreeBuilder().setId('Root2').setName('Node2').build(),
      );
      const rows = flattenNodesToRows([tree1, tree2], false, false, '');

      const dfsNodes: UiHierarchyTreeNode[] = [];
      tree1.forEachNodeDfs((node) => dfsNodes.push(node));
      dfsNodes.push(tree2);
      expect(rows).toEqual(
        dfsNodes.map((node, index) => {
          return makeExpectedRow(node, index);
        }),
      );
    });

    it('flattens trees processing depth', () => {
      const tree1 = UiHierarchyTreeNode.from(
        new HierarchyTreeBuilder()
          .setId('Root')
          .setName('Node')
          .setChildren([
            {id: '1', name: 'c1', children: [{id: '2', name: 'c2'}]},
          ])
          .build(),
      );
      const tree2 = UiHierarchyTreeNode.from(
        new HierarchyTreeBuilder()
          .setId('Root2')
          .setName('Node2')
          .setChildren([{id: '3', name: 'c3'}])
          .build(),
      );
      const rows = flattenNodesToRows([tree1, tree2], true, false, '');

      const dfsNodes: UiHierarchyTreeNode[] = [];
      tree1.forEachNodeDfs((node) => dfsNodes.push(node));
      tree2.forEachNodeDfs((node) => dfsNodes.push(node));
      const expectedDepths = [0, 1, 2, 0, 1];
      expect(rows).toEqual(
        dfsNodes.map((node, index) => {
          return makeExpectedRow(node, index, expectedDepths[index]);
        }),
      );
    });

    it('skips children of leaf UiPropertyTreeNodes', () => {
      const tree = UiPropertyTreeNode.from(makeRectNode(0, 0, 1, 1));
      tree.setFormatter(RECT_FORMATTER);
      const rows = flattenNodesToRows([tree], false, false, '');
      expect(rows).toEqual([makeExpectedRow(tree, 0)]);
    });

    it('flattens tree and adds gutter', () => {
      const tree = UiHierarchyTreeNode.from(
        new HierarchyTreeBuilder()
          .setId('Root')
          .setName('Node')
          .setChildren([
            {id: '1', name: 'c1', children: [{id: '2', name: 'c2'}]},
          ])
          .build(),
      );
      const rows = flattenNodesToRows([tree], false, true, '');

      const dfsNodes: UiHierarchyTreeNode[] = [];
      tree.forEachNodeDfs((node) => dfsNodes.push(node));
      const offsetStyle = {
        paddingLeft: '12px',
        width: 'calc(100% - 12px)',
      };
      expect(rows).toEqual(
        dfsNodes.map((node, index) => {
          return makeExpectedRow(node, index, undefined, offsetStyle);
        }),
      );
    });

    it('flattens tree with highlighted depths', () => {
      const tree = UiHierarchyTreeNode.from(
        new HierarchyTreeBuilder()
          .setId('Root')
          .setName('Node')
          .setChildren([
            {id: '1', name: 'c1', children: [{id: '2', name: 'c2'}]},
            {id: '3', name: 'c3'},
          ])
          .build(),
      );
      const rows = flattenNodesToRows([tree], true, false, '1 c1');

      const dfsNodes: UiHierarchyTreeNode[] = [];
      tree.forEachNodeDfs((node) => dfsNodes.push(node));
      const depths = [0, 1, 2, 1];
      const parentDepths = [undefined, undefined, 0, 0];
      const childDepths = [undefined, undefined, 1];
      expect(rows).toEqual(
        dfsNodes.map((node, index) => {
          return makeExpectedRow(
            node,
            index,
            depths[index],
            undefined,
            parentDepths[index],
            childDepths[index],
          );
        }),
      );
    });

    function makeExpectedRow<T extends UiTreeNode>(
      node: T,
      originalIndex: number,
      depth = 0,
      offsetStyle?: object,
      parentHighlightDepth?: number,
      childHighlightDepth?: number,
    ) {
      return {
        node,
        storeKey: node.id + '.collapsedState',
        depth,
        originalIndex,
        localExpandedState: true,
        isHiddenByCollapsedParent: false,
        offsetStyle,
        parentHighlightDepth,
        childHighlightDepth,
      };
    }
  });
});

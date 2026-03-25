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
import {treeNodeEqualityTester} from '@ui/shared/tree/testing/ui_tree_node_test_helpers';

import {Filter} from './filter';
import {MockUiTreeBuilder} from './testing/mock_ui_tree_builder';
import {MockUiTreeNode} from './testing/mock_ui_tree_node';

describe('Filter', () => {
  let treeRoot: MockUiTreeNode;
  let operation: Filter<MockUiTreeNode>;

  describe('keeping parents and children', () => {
    beforeEach(() => {
      jasmine.addCustomEqualityTester(treeNodeEqualityTester);
      const filter = (item: TreeNode | undefined) => {
        if (item) {
          return item.name === 'keep';
        }
        return false;
      };
      operation = new Filter<MockUiTreeNode>([filter], true);
    });

    it('discards leaf that does not match filter', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([{id: 'node', name: 'discard'}])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });

    it('keeps leaf that matches filter', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([{id: 'node', name: 'keep'}])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([{id: 'node', name: 'keep'}])
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });

    it('discards node with children if node and children do not match filter', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'discard',
            children: [
              {
                id: 'node',
                name: 'discard',
              },
            ],
          },
        ])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });

    it('keeps leaf that matches filter and its non-matching parent', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'discard',
            children: [
              {
                id: 'child',
                name: 'keep',
              },
            ],
          },
        ])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'discard',
            children: [
              {
                id: 'child',
                name: 'keep',
              },
            ],
          },
        ])
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });

    it('keeps parent that matches filter and its non-matching children', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'keep',
            children: [
              {
                id: 'child',
                name: 'discard',
              },
            ],
          },
        ])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'keep',
            children: [
              {
                id: 'child',
                name: 'discard',
              },
            ],
          },
        ])
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });

    it('keeps parent that matches filter and its matching children', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'keep',
            children: [
              {
                id: 'child',
                name: 'keep',
              },
            ],
          },
        ])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'keep',
            children: [
              {
                id: 'child',
                name: 'keep',
              },
            ],
          },
        ])
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });

    it('applies filter to children even if root matches', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('keep')
        .setChildren([{id: 'node', name: 'discard'}])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('keep')
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });
  });

  describe('without keeping parents and children', () => {
    beforeEach(() => {
      jasmine.addCustomEqualityTester(treeNodeEqualityTester);
      const filter = (item: TreeNode | undefined) => {
        if (item) {
          return item.name === 'keep';
        }
        return false;
      };
      operation = new Filter<MockUiTreeNode>([filter], false);
    });

    it('discards leaf that does not match filter', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([{id: 'node', name: 'discard'}])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });

    it('keeps leaf that matches filter', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([{id: 'node', name: 'keep'}])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([{id: 'node', name: 'keep'}])
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });

    it('discards node with children if node and children do not match filter', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'discard',
            children: [
              {
                id: 'child',
                name: 'discard',
              },
            ],
          },
        ])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });

    it('discards leaf that matches filter but has non-matching parent', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'discard',
            children: [
              {
                id: 'child',
                name: 'keep',
              },
            ],
          },
        ])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });

    it('keeps parent that matches filter and discards its non-matching children', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'keep',
            children: [
              {
                id: 'child',
                name: 'keep',
              },
              {
                id: 'child',
                name: 'discard',
              },
            ],
          },
        ])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'keep',
            children: [
              {
                id: 'child',
                name: 'keep',
              },
            ],
          },
        ])
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });

    it('keeps parent that matches filter and its matching children', () => {
      treeRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'keep',
            children: [
              {
                id: 'child',
                name: 'keep',
              },
            ],
          },
        ])
        .build();

      const expectedRoot = new MockUiTreeBuilder()
        .setId('test')
        .setName('root')
        .setChildren([
          {
            id: 'parent',
            name: 'keep',
            children: [
              {
                id: 'child',
                name: 'keep',
              },
            ],
          },
        ])
        .build();

      operation.apply(treeRoot);
      expect(treeRoot).toEqual(expectedRoot);
    });
  });
});

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

import {DEFAULT_PROPERTY_FORMATTER} from '@trace/formatters';
import {TreeNode} from '@tree_node/tree_node';
import {AbstractAddDiffsTest} from '@ui/shared/tree/abstract_add_diffs_test';
import {AddDiffs} from '@ui/shared/tree/add_diffs';
import {DiffType} from '@ui/shared/tree/diff_type';

import {AddDiffsPropertiesTree} from './add_diffs_properties_tree';
import {makeUiPropertyNode} from './testing/ui_property_tree_node_test_helpers';
import {UiPropertyTreeNode} from './ui_property_tree_node';

class AddDiffsPropertiesTreeTest extends AbstractAddDiffsTest<UiPropertyTreeNode> {
  override makeAddDiffsOperation(): AddDiffs<UiPropertyTreeNode> {
    const isModified = async (
      newTree: TreeNode | undefined,
      oldTree: TreeNode | undefined,
    ) => {
      return (
        (newTree as UiPropertyTreeNode)?.getValue() !==
        (oldTree as UiPropertyTreeNode)?.getValue()
      );
    };
    return new AddDiffsPropertiesTree(isModified, []);
  }

  makeRoot(value = 'value'): UiPropertyTreeNode {
    const root = makeUiPropertyNode('test', 'root', value);
    root.setIsRoot(true);
    return root;
  }

  makeChildAndAddToRoot(
    rootNode: UiPropertyTreeNode,
    value = 'value',
    name = 'child',
  ): UiPropertyTreeNode {
    const child = makeUiPropertyNode('test node', name, value);
    rootNode.addOrReplaceChild(child);
    return child;
  }

  override executeSpecializedTests(): void {
    describe('Specialized tests', () => {
      let newRoot: UiPropertyTreeNode;
      let oldRoot: UiPropertyTreeNode;
      let expectedRoot: UiPropertyTreeNode;
      let addDiffs: AddDiffs<UiPropertyTreeNode>;

      beforeAll(() => {
        addDiffs = this.makeAddDiffsOperation();
      });

      beforeEach(() => {
        jasmine.addCustomEqualityTester(this.treeEqualityTester);
        newRoot = this.makeRoot();
        oldRoot = this.makeRoot();
        expectedRoot = this.makeRoot();
      });

      it('does not add MODIFIED to property tree root', async () => {
        oldRoot = this.makeRoot('oldValue');
        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
      });

      it('does not add any diffs to property tree that has no old tree', async () => {
        await addDiffs.executeInPlace(newRoot, undefined);
        expect(newRoot).toEqual(expectedRoot);
      });

      it('processes MODIFIED node by setting old value to null', async () => {
        this.makeChildAndAddToRoot(newRoot, 'new');
        this.makeChildAndAddToRoot(oldRoot, 'old');
        const expectedChild = this.makeChildAndAddToRoot(expectedRoot);
        expectedChild.setDiff(DiffType.MODIFIED);

        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
        expect(newRoot.getChildByName('child')?.getOldValue()).toBe('null');
      });

      it('processes MODIFIED node by setting old value to old formatted value', async () => {
        this.makeChildAndAddToRoot(newRoot, 'new');
        const oldChild = this.makeChildAndAddToRoot(oldRoot, 'old');
        oldChild.setFormatter(DEFAULT_PROPERTY_FORMATTER);
        const expectedChild = this.makeChildAndAddToRoot(expectedRoot);
        expectedChild.setDiff(DiffType.MODIFIED);

        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
        expect(newRoot.getChildByName('child')?.getOldValue()).toBe('old');
      });

      it('processes MODIFIED flag values into diff value parts', async () => {
        const newValue = 'flag1 | flag2 | flag3 | flag4 | flag6';
        const newChild = this.makeChildAndAddToRoot(newRoot, newValue);
        const oldValue = 'flag1 | flag4 | flag5';
        const oldChild = this.makeChildAndAddToRoot(oldRoot, oldValue);
        const expectedChild = this.makeChildAndAddToRoot(expectedRoot);
        await checkModifiedWithDiffValueParts(
          newChild,
          oldChild,
          expectedChild,
        );
      });

      it('processes MODIFIED flag values ignoring raw values', async () => {
        const newValue = 'flag1 | flag2 | flag3 | flag4 | flag6 (0x100)';
        const newChild = this.makeChildAndAddToRoot(newRoot, newValue);
        const oldValue = 'flag1 | flag4 | flag5 (0x80)';
        const oldChild = this.makeChildAndAddToRoot(oldRoot, oldValue);
        const expectedChild = this.makeChildAndAddToRoot(expectedRoot);
        await checkModifiedWithDiffValueParts(
          newChild,
          oldChild,
          expectedChild,
        );
      });

      async function checkModifiedWithDiffValueParts(
        newChild: UiPropertyTreeNode,
        oldChild: UiPropertyTreeNode,
        expectedChild: UiPropertyTreeNode,
      ) {
        newChild.setFormatter(DEFAULT_PROPERTY_FORMATTER);
        oldChild.setFormatter(DEFAULT_PROPERTY_FORMATTER);
        expectedChild.setDiff(DiffType.MODIFIED);

        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
        expect(newRoot.getChildByName('child')?.getDiffValueParts()).toEqual([
          {isOld: false, isNew: false, value: 'flag1'},
          {isOld: false, isNew: true, value: 'flag2'},
          {isOld: false, isNew: true, value: 'flag3'},
          {isOld: false, isNew: false, value: 'flag4'},
          {isOld: false, isNew: true, value: 'flag6'},
          {isOld: true, isNew: false, value: 'flag5'},
        ]);
      }
    });
  }
}

describe('AddDiffsPropertiesTree', () => {
  new AddDiffsPropertiesTreeTest().execute();
});

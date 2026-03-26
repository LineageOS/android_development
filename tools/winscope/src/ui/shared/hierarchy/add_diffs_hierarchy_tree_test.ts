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
import {makeUiHierarchyNode, treeNodeEqualityTester,} from '@ui/shared/hierarchy/testing/ui_hierarchy_tree_node_test_helpers';
import {AbstractAddDiffsTest} from '@ui/shared/tree/abstract_add_diffs_test';
import {AddDiffs} from '@ui/shared/tree/add_diffs';
import {DiffType} from '@ui/shared/tree/diff_type';

import {AddDiffsHierarchyTree} from './add_diffs_hierarchy_tree';
import {UiHierarchyTreeNode} from './ui_hierarchy_tree_node';

class AddDiffsHierarchyTreeTest extends AbstractAddDiffsTest<UiHierarchyTreeNode> {
  protected override readonly treeEqualityTester = treeNodeEqualityTester;

  override makeAddDiffsOperation(): AddDiffs<UiHierarchyTreeNode> {
    const isModified = async (
      newTree: TreeNode | undefined,
      oldTree: TreeNode | undefined,
    ) => {
      return (
        (newTree as UiHierarchyTreeNode)
          .getEagerPropertyByName('exampleProperty')
          ?.getValue() !==
        (oldTree as UiHierarchyTreeNode)
          .getEagerPropertyByName('exampleProperty')
          ?.getValue()
      );
    };
    return new AddDiffsHierarchyTree(isModified, []);
  }

  override makeRoot(value = 'value'): UiHierarchyTreeNode {
    return makeUiHierarchyNode({
      id: 'test',
      name: 'root',
      exampleProperty: value,
    });
  }

  override makeChildAndAddToRoot(
    rootNode: UiHierarchyTreeNode,
    value = 'value',
    name = 'child',
  ): UiHierarchyTreeNode {
    const child = makeUiHierarchyNode({
      id: 'test node',
      name,
      exampleProperty: value,
    });
    rootNode.addOrReplaceChild(child);
    child.setParent(rootNode);
    return child;
  }

  override executeSpecializedTests(): void {
    describe('Specialized tests', () => {
      let newRoot: UiHierarchyTreeNode;
      let oldRoot: UiHierarchyTreeNode;
      let expectedRoot: UiHierarchyTreeNode;
      let addDiffs: AddDiffs<UiHierarchyTreeNode>;

      beforeAll(() => {
        addDiffs = this.makeAddDiffsOperation();
      });

      beforeEach(() => {
        jasmine.addCustomEqualityTester(this.treeEqualityTester);
        newRoot = this.makeRoot();
        oldRoot = this.makeRoot();
        expectedRoot = this.makeRoot();
      });

      it('adds ADDED_MOVE and DELETED_MOVE', async () => {
        const newParent = this.makeParentAndAddToRoot(newRoot);
        this.makeChildAndAddToRoot(newParent);
        this.makeParentAndAddToRoot(oldRoot);
        this.makeChildAndAddToRoot(oldRoot);

        const expectedParent = this.makeParentAndAddToRoot(expectedRoot);

        const expectedNewChild = this.makeChildAndAddToRoot(expectedParent);
        expectedNewChild.setDiff(DiffType.ADDED_MOVE);

        const expectedOldChild = this.makeChildAndAddToRoot(expectedRoot);
        expectedOldChild.setDiff(DiffType.DELETED_MOVE);

        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
      });

      it('adds ADDED, ADDED_MOVE and DELETED_MOVE', async () => {
        const newParent = this.makeParentAndAddToRoot(newRoot);
        this.makeChildAndAddToRoot(newParent);
        this.makeChildAndAddToRoot(oldRoot);

        const expectedOldChild = this.makeChildAndAddToRoot(expectedRoot);
        expectedOldChild.setDiff(DiffType.DELETED_MOVE);

        const expectedParent = this.makeParentAndAddToRoot(expectedRoot);
        expectedParent.setDiff(DiffType.ADDED);

        const expectedNewChild = this.makeChildAndAddToRoot(expectedParent);
        expectedNewChild.setDiff(DiffType.ADDED_MOVE);

        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
      });
    });
  }

  private makeParentAndAddToRoot(
    rootNode: UiHierarchyTreeNode,
  ): UiHierarchyTreeNode {
    const parent = makeUiHierarchyNode({
      id: 'test node',
      name: 'parent',
      exampleProperty: 'value',
    });
    rootNode.addOrReplaceChild(parent);
    parent.setParent(rootNode);
    return parent;
  }
}

describe('AddDiffsHierarchyTree', () => {
  new AddDiffsHierarchyTreeTest().execute();
});

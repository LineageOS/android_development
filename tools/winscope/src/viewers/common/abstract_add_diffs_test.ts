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

import {treeNodeEqualityTester} from 'test/unit/ui_tree_node_utils';
import {DiffType} from 'viewers/common/diff_type';
import {AddDiffs} from './add_diffs';
import {DiffNode} from './diff_node';

export abstract class AbstractAddDiffsTest<T extends DiffNode> {
  execute() {
    describe('AddDiffs', () => {
      let newRoot: T;
      let oldRoot: T;
      let expectedRoot: T;
      let addDiffs: AddDiffs<T>;

      beforeAll(() => {
        addDiffs = this.makeAddDiffsOperation();
      });

      beforeEach(() => {
        jasmine.addCustomEqualityTester(treeNodeEqualityTester);
        newRoot = this.makeRoot();
        oldRoot = this.makeRoot();
        expectedRoot = this.makeRoot();
      });

      it('handles two identical trees', async () => {
        await addDiffs.executeInPlace(newRoot, newRoot);
        expect(newRoot).toEqual(expectedRoot);
      });

      it('adds MODIFIED', async () => {
        this.makeChildAndAddToRoot(newRoot);
        this.makeChildAndAddToRoot(oldRoot, 'oldValue');

        const expectedChild = this.makeChildAndAddToRoot(expectedRoot);
        expectedChild.setDiff(DiffType.MODIFIED);

        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
      });

      it('adds MODIFIED if old node comes before new node in siblings', async () => {
        this.makeChildAndAddToRoot(newRoot, 'value', 'child1');
        this.makeChildAndAddToRoot(newRoot, 'newValue', 'child2');

        this.makeChildAndAddToRoot(oldRoot, 'oldValue', 'child2');

        const expectedChild1 = this.makeChildAndAddToRoot(
          expectedRoot,
          'value',
          'child1',
        );
        expectedChild1.setDiff(DiffType.ADDED);
        const expectedChild2 = this.makeChildAndAddToRoot(
          expectedRoot,
          'newValue',
          'child2',
        );
        expectedChild2.setDiff(DiffType.MODIFIED);

        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
      });

      it('adds MODIFIED if old node comes after new node in siblings', async () => {
        this.makeChildAndAddToRoot(newRoot, 'newValue', 'child2');

        this.makeChildAndAddToRoot(oldRoot, 'value', 'child1');
        this.makeChildAndAddToRoot(oldRoot, 'oldValue', 'child2');

        const expectedChild1 = this.makeChildAndAddToRoot(
          expectedRoot,
          'value',
          'child1',
        );
        expectedChild1.setDiff(DiffType.DELETED);
        const expectedChild2 = this.makeChildAndAddToRoot(
          expectedRoot,
          'newValue',
          'child2',
        );
        expectedChild2.setDiff(DiffType.MODIFIED);

        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
      });

      it('does not add MODIFIED to root', async () => {
        oldRoot = this.makeRoot('oldValue');
        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
      });

      it('adds ADDED', async () => {
        this.makeChildAndAddToRoot(newRoot);

        const expectedChild = this.makeChildAndAddToRoot(expectedRoot);
        expectedChild.setDiff(DiffType.ADDED);

        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
      });

      it('adds DELETED', async () => {
        const oldChild1 = this.makeChildAndAddToRoot(
          oldRoot,
          undefined,
          'child1',
        );
        this.makeChildAndAddToRoot(oldChild1, undefined, 'child2');

        const expectedChild1 = this.makeChildAndAddToRoot(
          expectedRoot,
          undefined,
          'child1',
        );
        const expectedChild2 = this.makeChildAndAddToRoot(
          expectedChild1,
          undefined,
          'child2',
        );
        expectedChild1.setDiff(DiffType.DELETED);
        expectedChild2.setDiff(DiffType.DELETED);

        await addDiffs.executeInPlace(newRoot, oldRoot);
        expect(newRoot).toEqual(expectedRoot);
      });

      this.executeSpecializedTests();
    });
  }

  abstract makeAddDiffsOperation(): AddDiffs<T>;
  abstract makeRoot(value?: string): T;
  abstract makeChildAndAddToRoot(rootNode: T, value?: string, name?: string): T;
  abstract executeSpecializedTests(): void;
}

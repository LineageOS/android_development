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

import {MockTreeNode} from '@tree_node/testing/mock_tree_node';
import {DiffType} from '@ui/shared/tree/diff_type';
import {UiTreeNode} from '@ui/shared/tree/ui_tree_node';

/** Shared interface for any tree node used for UI rendering. */

export class MockUiTreeNode extends MockTreeNode implements UiTreeNode {
  private diff: DiffType = DiffType.NONE;
  private nodeHasShowState = true;
  private nodeCanBePinned = true;
  private copyText: string | undefined = undefined;

  isLeaf(): boolean {
    return this.children.length === 0;
  }

  getDisplayName(): string {
    return this.name;
  }

  getDiff(): DiffType {
    return this.diff;
  }

  setDiff(value: DiffType): void {
    this.diff = value;
  }

  hasShowState(): boolean {
    return this.nodeHasShowState;
  }

  setHasShowState(value: boolean) {
    this.nodeHasShowState = value;
  }

  getCopyText(): string | undefined {
    return this.copyText;
  }

  setCopyText(value: string) {
    this.copyText = value;
  }

  canBePinned(): boolean {
    return this.nodeCanBePinned;
  }

  setCanBePinned(value: boolean) {
    this.nodeCanBePinned = value;
  }
}

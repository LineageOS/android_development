/*
 * Copyright (C) 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertDefined} from '@common/assert';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {DiffType} from '@ui/shared/tree/diff_type';
import {UiTreeNode} from '@ui/shared/tree/ui_tree_node';

export interface DiffValuePart {
  isOld: boolean;
  isNew: boolean;
  value: string;
}

export class UiPropertyTreeNode extends PropertyTreeNode implements UiTreeNode {
  private diff: DiffType = DiffType.NONE;
  private displayName: string = this.name;
  private oldValue = 'null';
  private propagate = false;
  private diffValueParts: DiffValuePart[] | undefined;

  static from(node: PropertyTreeNode): UiPropertyTreeNode {
    const displayNode = new UiPropertyTreeNode(
      node.id,
      node.name,
      node.source,
      (node as UiPropertyTreeNode).value,
    );
    if ((node as UiPropertyTreeNode).formatter) {
      displayNode.setFormatter(
        assertDefined((node as UiPropertyTreeNode).formatter),
      );
    }

    displayNode.setIsRoot(node.isRoot());

    const children = [...node.getAllChildren()].sort((a, b) =>
      a.name < b.name ? -1 : 1,
    );

    children.forEach((child) => {
      displayNode.addOrReplaceChild(UiPropertyTreeNode.from(child));
    });
    return displayNode;
  }

  setDiff(diff: DiffType) {
    this.diff = diff;
  }

  getDiff(): DiffType {
    return this.diff;
  }

  setDisplayName(name: string) {
    this.displayName = name;
  }

  getDisplayName(): string {
    return this.displayName;
  }

  setOldValue(value: string) {
    this.oldValue = value;
  }

  getOldValue(): string {
    return this.oldValue;
  }

  canPropagate(): boolean {
    return this.propagate;
  }

  setCanPropagate(value: boolean) {
    this.propagate = value;
  }

  hasDiffValueParts(): boolean {
    return this.diffValueParts !== undefined;
  }

  setDiffValueParts(value: DiffValuePart[]) {
    this.diffValueParts = value;
  }

  getDiffValueParts(): DiffValuePart[] {
    return assertDefined(this.diffValueParts);
  }

  isLeaf(): boolean {
    return this.children.length === 0 || this.formattedValue().length > 0;
  }

  hasShowState(): boolean {
    return false;
  }

  getCopyText(): string | undefined {
    const formattedValue = this.formattedValue();
    if (!formattedValue) {
      return this.name;
    }
    return `${this.name}: ${formattedValue}`;
  }

  canBePinned(): boolean {
    return false;
  }
}

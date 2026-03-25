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

import {Warning} from '@common/warning';
import {DataHierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {TraceRect} from '@tree_node/trace_rect';
import {DiffType} from '@ui/shared/tree/diff_type';
import {UiTreeNode} from '@ui/shared/tree/ui_tree_node';
import {Chip} from '@ui/shared/user_input/chip';

export class UiHierarchyTreeNode
  extends DataHierarchyTreeNode
  implements UiTreeNode
{
  private readonly node: DataHierarchyTreeNode;
  private parent: this | undefined;
  private chips: Chip[] = [];
  private diff: DiffType = DiffType.NONE;
  private displayName: string;
  private isOldNodeInternal = false;
  private showHeading = true;

  constructor(node: DataHierarchyTreeNode) {
    super(node.id, node.name);
    this.node = node;
    this.displayName = node.name;
  }

  static from(
    node: DataHierarchyTreeNode,
    parent?: UiHierarchyTreeNode,
  ): UiHierarchyTreeNode {
    const displayNode = new UiHierarchyTreeNode(node);

    if (parent) displayNode.setParent(parent);

    node.getAllChildren().forEach((child) => {
      displayNode.addOrReplaceChild(
        UiHierarchyTreeNode.from(child, displayNode),
      );
    });

    return displayNode;
  }

  override async getAllProperties(): Promise<PropertyTreeNode> {
    return await this.node.getAllProperties();
  }

  override getEagerPropertyByName(name: string): PropertyTreeNode | undefined {
    return this.node.getEagerPropertyByName(name);
  }

  override getRects(): TraceRect[] {
    return this.node.getRects();
  }

  override getSecondaryRects(): TraceRect[] {
    return this.node.getSecondaryRects();
  }

  override setParent(parent: this): void {
    this.parent = parent;
  }

  override getParent(): this | undefined {
    return this.parent;
  }

  override getZParent(): DataHierarchyTreeNode | undefined {
    return this.node.getZParent();
  }

  override getRelativeChildren(): DataHierarchyTreeNode[] {
    return this.node.getRelativeChildren();
  }

  override isRoot(): boolean {
    return !this.parent;
  }

  override getWarnings(): Warning[] {
    return this.node.getWarnings();
  }

  setDiff(diff: DiffType) {
    this.diff = diff;
  }

  getDiff(): DiffType {
    return this.diff;
  }

  heading(): string | undefined {
    return this.showHeading ? this.id.split(' ')[0].split('.')[0] : undefined;
  }

  setShowHeading(value: boolean) {
    this.showHeading = value;
  }

  setDisplayName(name: string) {
    this.displayName = name;
  }

  getDisplayName(): string {
    return this.displayName;
  }

  addChip(chip: Chip) {
    this.chips.push(chip);
  }

  getChips(): Chip[] {
    return this.chips;
  }

  setIsOldNode(value: boolean) {
    this.isOldNodeInternal = value;
  }

  isOldNode(): boolean {
    return this.isOldNodeInternal;
  }

  isLeaf(): boolean {
    return this.children.length === 0;
  }

  hasShowState(): boolean {
    return true;
  }

  getCopyText(): string | undefined {
    return undefined;
  }

  canBePinned(): boolean {
    return true;
  }
}

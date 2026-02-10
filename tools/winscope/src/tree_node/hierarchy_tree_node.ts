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

import {Warning} from '@common/warning';

import {PropertiesProvider} from './properties_provider';
import {PropertyTreeNode} from './property_tree_node';
import {TraceRect} from './trace_rect';
import {TreeNode} from './tree_node';

export abstract class DataHierarchyTreeNode extends TreeNode {
  abstract getAllProperties(): Promise<PropertyTreeNode>;
  abstract getEagerPropertyByName(name: string): PropertyTreeNode | undefined;
  abstract getRects(): TraceRect[];
  abstract getSecondaryRects(): TraceRect[];
  abstract getZParent(): DataHierarchyTreeNode | undefined;
  abstract setParent(parent: DataHierarchyTreeNode): void;
  abstract getParent(): DataHierarchyTreeNode | undefined;
  abstract getRelativeChildren(): DataHierarchyTreeNode[];
  abstract getWarnings(): Warning[];
}

/**
 * A node in a hierarchy tree.
 */
export class HierarchyTreeNode extends DataHierarchyTreeNode {
  private rects: TraceRect[] = [];
  private secondaryRects: TraceRect[] = [];
  private zParent: HierarchyTreeNode | undefined;
  private parent: this | undefined;
  private readonly relativeChildren: HierarchyTreeNode[] = [];
  private readonly warnings: Warning[] = [];

  constructor(
    id: string,
    name: string,
    private readonly propertiesProvider: PropertiesProvider,
  ) {
    super(id, name);
  }

  override async getAllProperties(): Promise<PropertyTreeNode> {
    return await this.propertiesProvider.getAll();
  }

  override getEagerPropertyByName(name: string): PropertyTreeNode | undefined {
    return this.propertiesProvider.getEagerProperties().getChildByName(name);
  }

  setRects(value: TraceRect[]) {
    this.rects = value;
  }

  override getRects(): TraceRect[] {
    return this.rects;
  }

  setSecondaryRects(value: TraceRect[]) {
    this.secondaryRects = value;
  }

  override getSecondaryRects(): TraceRect[] {
    return this.secondaryRects;
  }

  setZParent(value: HierarchyTreeNode): void {
    this.zParent = value;
  }

  override getZParent(): HierarchyTreeNode | undefined {
    return this.zParent ?? this.parent;
  }

  override setParent(parent: this): void {
    this.parent = parent;
  }

  override getParent(): this | undefined {
    return this.parent;
  }

  addRelativeChild(value: HierarchyTreeNode): void {
    this.relativeChildren.push(value);
  }

  override getRelativeChildren(): HierarchyTreeNode[] {
    return this.relativeChildren;
  }

  override isRoot(): boolean {
    return !this.parent;
  }

  findAncestor(targetNodeFilter: (node: this) => boolean): this | undefined {
    let ancestor = this.getParent();

    while (ancestor && !targetNodeFilter(ancestor)) {
      ancestor = ancestor.getParent();
    }

    return ancestor;
  }

  override getWarnings(): Warning[] {
    return this.warnings;
  }

  addWarning(warning: Warning) {
    this.warnings.push(warning);
  }
}

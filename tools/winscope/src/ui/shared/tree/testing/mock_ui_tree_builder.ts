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

import {assertDefined} from '@common/assert';
import {AbstractTreeBuilder} from '@tree_node/testing/abstract_tree_builder';

import {MockUiTreeNode} from './mock_ui_tree_node';

/**
 * Builder for a mock tree.
 *
 * The builder is not reusable, it should only be used to build one tree.
 */
export class MockUiTreeBuilder extends AbstractTreeBuilder<
  MockUiTreeNode,
  ChildTreeNode
> {
  setId(value: string): this {
    this.id = value;
    return this;
  }

  protected override makeRootNode(): MockUiTreeNode {
    const rootId = this.makeNodeId();
    const root = new MockUiTreeNode(rootId, assertDefined(this.name));
    root.setIsRoot(true);
    return root;
  }

  protected override addOrReplaceChildNode(
    rootNode: MockUiTreeNode,
    child: ChildTreeNode,
  ): void {
    const childNode = new MockUiTreeBuilder()
      .setId(child.id)
      .setName(child.name)
      .setChildren(child.children ?? [])
      .build();
    childNode.setIsRoot(false);
    rootNode.addOrReplaceChild(childNode);
  }

  private makeNodeId() {
    return `${this.id} ${this.name}`;
  }
}

/**
 * A child in a mock tree.
 */
export declare interface ChildTreeNode {
  id: string;
  name: string;
  children?: ChildTreeNode[];
}

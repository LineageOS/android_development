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

import {assertDefined} from '@common/assert';

import {AbstractTreeBuilder} from './abstract_tree_builder';
import {MockTreeNode} from './mock_tree_node';

/**
 * Builder for a mock tree.
 *
 * The builder is not reusable, it should only be used to build one tree.
 */
export class MockTreeBuilder extends AbstractTreeBuilder<
  MockTreeNode,
  ChildTreeNode
> {
  setId(value: string): this {
    this.id = value;
    return this;
  }

  protected override makeRootNode(): MockTreeNode {
    const rootId = this.makeNodeId();
    return new MockTreeNode(rootId, assertDefined(this.name));
  }

  protected override addOrReplaceChildNode(
    rootNode: MockTreeNode,
    child: ChildTreeNode,
  ): void {
    const childNode = new MockTreeBuilder()
      .setId(child.id)
      .setName(child.name)
      .setChildren(child.children ?? [])
      .build();
    rootNode.addOrReplaceChild(childNode);
  }

  private makeNodeId() {
    return `${this.id} ${this.name}`;
  }
}

/**
 * A child in a hierarchy tree.
 */
export declare interface ChildTreeNode {
  id: string;
  name: string;
  children?: ChildTreeNode[];
}

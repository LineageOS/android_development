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

import {TraceProcessor} from '@trace_processor/trace_processor';

import {OperationChain} from './operation_chain';
import {PropertySource, PropertyTreeNode} from './property_tree_node';
import {DEFAULT_PROPERTY_TREE_NODE_FACTORY} from './property_tree_node_factory';

/**
 * Type for a function that asynchronously provides a `PropertyTreeNode`.
 * This is used to fetch properties that are not eagerly loaded.
 */
export type LazyPropertiesStrategyType = (
  tp?: TraceProcessor,
  argSetId?: bigint,
) => Promise<PropertyTreeNode>;

/**
 * A provider for properties of a tree node.
 */
export class PropertiesProvider {
  private lazyPropertiesRoot: PropertyTreeNode | undefined;
  private allPropertiesRoot: PropertyTreeNode | undefined;

  constructor(
    private readonly eagerPropertiesRoot: PropertyTreeNode,
    private lazyPropertiesStrategy: LazyPropertiesStrategyType | undefined,
    private tp: TraceProcessor | undefined,
    private readonly commonOperations: OperationChain<PropertyTreeNode>,
    private readonly eagerOperations: OperationChain<PropertyTreeNode>,
    private readonly lazyOperations: OperationChain<PropertyTreeNode>,
  ) {
    this.eagerPropertiesRoot = this.commonOperations.apply(
      this.eagerOperations.apply(eagerPropertiesRoot),
    );
  }

  getEagerProperties(): PropertyTreeNode {
    return this.eagerPropertiesRoot;
  }

  addEagerProperty(property: PropertyTreeNode) {
    this.eagerPropertiesRoot.addOrReplaceChild(property);
  }

  async getAll(): Promise<PropertyTreeNode> {
    if (this.allPropertiesRoot) return this.allPropertiesRoot;

    const root = DEFAULT_PROPERTY_TREE_NODE_FACTORY.makePropertyRoot(
      this.eagerPropertiesRoot.id,
      this.eagerPropertiesRoot.name,
      PropertySource.PROTO,
      undefined,
    );
    const children = [...this.eagerPropertiesRoot.getAllChildren()];

    // all eager properties have already had operations applied so no need to reapply
    if (!this.lazyPropertiesRoot && this.lazyPropertiesStrategy !== undefined) {
      const argSetId = this.eagerPropertiesRoot
        .getChildByName('argSetId')
        ?.getValue<bigint>();
      const lazyProperties = await this.lazyPropertiesStrategy(
        this.tp,
        argSetId,
      );
      this.lazyPropertiesRoot = this.commonOperations.apply(
        this.lazyOperations.apply(lazyProperties),
      );
    }
    if (this.lazyPropertiesRoot) {
      children.push(...this.lazyPropertiesRoot.getAllChildren());
    }

    children.forEach((child) => {
      root.addOrReplaceChild(child);
    });

    root.setIsRoot(true);

    this.allPropertiesRoot = root;
    return this.allPropertiesRoot;
  }
}

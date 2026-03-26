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
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {Operation} from '@tree_node/operation';
import {OperationChain} from '@tree_node/operation_chain';
import {PropertiesProvider} from '@tree_node/properties_provider';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {PropertyTreeNodeFactory} from '@tree_node/property_tree_node_factory';
import {TraceRect} from '@tree_node/trace_rect';

import {AbstractTreeBuilder} from './abstract_tree_builder';
import {ChildProperty, PropertyTreeBuilder} from './property_tree_builder';

/**
 * Builder for a hierarchy tree.
 *
 * The builder is not reusable, it should only be used to build one tree.
 */
export class HierarchyTreeBuilder extends AbstractTreeBuilder<
  HierarchyTreeNode,
  ChildHierarchy
> {
  private properties: object | undefined;
  private readonly additionalProperties: ChildProperty[] = [];
  private rootNodeFormatter?: Operation<PropertyTreeNode>;

  setId(value: string | number | undefined): this {
    this.id = value;
    return this;
  }

  setProperties(value: object | undefined): this {
    this.properties = value;
    return this;
  }

  setRootNodeFormatter(value: Operation<PropertyTreeNode> | undefined): this {
    this.rootNodeFormatter = value;
    return this;
  }

  addChildProperty(value: ChildProperty): this {
    this.additionalProperties.push(value);
    return this;
  }

  protected override makeRootNode(): HierarchyTreeNode {
    const rootId = this.makeHierarchyNodeId();

    const propertiesTree = new PropertyTreeNodeFactory().makeProtoProperty(
      rootId,
      '',
      this.properties,
    );
    this.additionalProperties.forEach((property) => {
      const childNode = new PropertyTreeBuilder()
        .setRootId(propertiesTree.id)
        .setName(property.name)
        .setSource(property.source ?? propertiesTree.source)
        .setValue(property.value)
        .setChildren(property.children ?? [])
        .build();
      propertiesTree.addOrReplaceChild(childNode);
    });

    if (this.rootNodeFormatter) {
      this.rootNodeFormatter.apply(propertiesTree);
    }
    const provider = new PropertiesProvider(
      propertiesTree,
      async () => propertiesTree,
      undefined,
      OperationChain.emptyChain<PropertyTreeNode>(),
      OperationChain.emptyChain<PropertyTreeNode>(),
      OperationChain.emptyChain<PropertyTreeNode>(),
    );

    return new HierarchyTreeNode(rootId, assertDefined(this.name), provider);
  }

  protected override addOrReplaceChildNode(
    rootNode: HierarchyTreeNode,
    child: ChildHierarchy,
  ): void {
    const childNode = new HierarchyTreeBuilder()
      .setId(child.id)
      .setName(child.name)
      .setProperties(child.properties)
      .setChildren(child.children ?? [])
      .setRootNodeFormatter(this.rootNodeFormatter)
      .build();
    rootNode.addOrReplaceChild(childNode);
    childNode.setParent(rootNode);
    if (child.rects !== undefined) {
      childNode.setRects(child.rects);
    }
    if (child.secondaryRects !== undefined) {
      childNode.setSecondaryRects(child.secondaryRects);
    }
  }

  private makeHierarchyNodeId() {
    return `${this.id} ${this.name}`;
  }
}

/**
 * A child in a hierarchy tree.
 */
export declare interface ChildHierarchy {
  id: string | number;
  name: string;
  properties?: object;
  children?: ChildHierarchy[];
  rects?: TraceRect[];
  secondaryRects?: TraceRect[];
}

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

import {assertDefined} from '@common/assert';
import {PropertyTreeBuilderFromArgs} from '@parsers/helpers/property_tree_builder_from_args';
import {QueryResult} from '@trace_processor/query_result';
import {TamperedProtoField} from '@trace/proto_utils/tampered_message_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertiesProviderBuilder} from '@tree_node/properties_provider_builder';
import {PropertyTreeNode} from '@tree_node/property_tree_node';

import {CHILD_DENYLIST_PROPERTIES} from './child_denylist_properties';
import {HierarchyTreeBuilderInputMethod} from './hierarchy_tree_builder_input_method';
import {OperationLists} from './operation_lists';

export class HierarchyTreeFactory {
  constructor(
    private readonly entryField: TamperedProtoField,
    private readonly childField: TamperedProtoField,
    private readonly operations: OperationLists,
  ) {}

  makeHierarchyTree(argsData: QueryResult): HierarchyTreeNode {
    const fieldParts = this.entryField.type.split('.');
    const rootId = fieldParts[fieldParts.length - 1];

    const entryProps = this.makeEntryPropertiesTree(argsData, rootId);
    const entry = new PropertiesProviderBuilder()
      .setEagerProperties(entryProps)
      .setLazyPropertiesStrategy(async () => entryProps)
      .setEagerOperations(this.operations.entryEager)
      .setCommonOperations(this.operations.entryCommon)
      .setLazyOperations(this.operations.entryLazy)
      .build();

    const childProps = this.makeChildPropertiesTree(argsData, rootId);
    const hasChild = (childProps?.getAllChildren().length ?? 0) > 0;
    const child = hasChild
      ? new PropertiesProviderBuilder()
          .setEagerProperties(assertDefined(childProps))
          .setLazyPropertiesStrategy(async () => assertDefined(childProps))
          .setEagerOperations(this.operations.childEager)
          .setCommonOperations(this.operations.childCommon)
          .setLazyOperations(this.operations.childLazy)
          .build()
      : undefined;

    return new HierarchyTreeBuilderInputMethod()
      .setRoot(entry)
      .setChildren(child ? [child] : [])
      .build();
  }

  private makeEntryPropertiesTree(
    argsData: QueryResult,
    rootId: string,
  ): PropertyTreeNode {
    return new PropertyTreeBuilderFromArgs()
      .setData(argsData.iter({}))
      .setRootId(rootId)
      .setRootName('entry')
      .setDenyList([assertDefined(this.childField.name)])
      .setRootMessageType(assertDefined(this.entryField.resolve()))
      .build();
  }

  private makeChildPropertiesTree(
    argsData: QueryResult,
    rootId: string,
  ): PropertyTreeNode | undefined {
    const tree = new PropertyTreeBuilderFromArgs()
      .setData(argsData.iter({}))
      .setRootId(rootId)
      .setRootName('entry')
      .setDenyList(CHILD_DENYLIST_PROPERTIES)
      .setRootMessageType(assertDefined(this.entryField.resolve()))
      .build();
    return tree.getChildByName(assertDefined(this.childField.name));
  }
}

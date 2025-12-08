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

import {convertSnakeToCamelCase} from 'common/string_helpers';
import {ColumnType, RowIterator} from 'trace_processor/query_result';
import {PropertySource, PropertyTreeNode} from 'tree_node/property_tree_node';
import {PropertyTreeNodeFactory} from 'tree_node/property_tree_node_factory';
import {AbstractPropertyTreeBuilder} from './abstract_property_tree_builder';

/**
 * A builder for creating a property tree from a query row.
 */
export class PropertyTreeBuilderFromQueryRow extends AbstractPropertyTreeBuilder<RowIterator> {
  private columns: string[] | undefined;
  private booleanColumns: string[] = [];

  setColumns(value: string[]): this {
    this.columns = value;
    return this;
  }

  setConvertColumnToBoolean(column: string): this {
    this.booleanColumns.push(column);
    return this;
  }

  protected override buildPropertiesTree(rootNodeId: string): PropertyTreeNode {
    if (this.columns === undefined) {
      throw new Error('columns not set');
    }
    const factory = new PropertyTreeNodeFactory();

    const rootNode = factory.makePropertyRoot(
      rootNodeId,
      rootNodeId.split(' ').slice(1).join(' '),
      PropertySource.TP,
      undefined,
    );

    for (const col of this.columns) {
      let val: ColumnType | boolean | undefined =
        this.data?.get(col) ?? undefined;
      if (val !== undefined) {
        const colCamelCase = convertSnakeToCamelCase(col);
        if (this.booleanColumns.includes(col)) {
          val = Boolean(val);
        }
        const node = factory.makeTpProperty(rootNodeId, colCamelCase, val);
        rootNode.addOrReplaceChild(node);
      }
    }

    return rootNode;
  }
}

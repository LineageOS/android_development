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

import {MakeTimestampStrategyType} from 'common/time/time';
import {HierarchyTreeBuilderLog} from 'parsers/hierarchy_tree_builder_log';
import {TransformToTimestamp} from 'parsers/operations/transform_to_timestamp';
import {AbstractParser} from 'parsers/perfetto/abstract_parser';
import {getDistinctValues} from 'parsers/perfetto/utils';
import {PropertyTreeBuilderFromQueryRow} from 'parsers/property_tree_builder_from_query_row';
import {ProtologColumnType} from 'trace/protolog/protolog_column_type';
import {
  CustomQueryParamTypeMap,
  CustomQueryParserResultTypeMap,
  CustomQueryType,
  VisitableParserCustomQuery,
} from 'trace_api/custom_query';
import {EntriesRange} from 'trace_api/index_types';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {PropertiesProviderBuilder} from 'tree_node/properties_provider_builder';
import {SetFormatters} from 'viewers/operations/set_formatters';

export class ParserProtolog extends AbstractParser<HierarchyTreeNode> {
  override getTraceType(): TraceType {
    return TraceType.PROTO_LOG;
  }

  override async getEntry(index: number): Promise<HierarchyTreeNode> {
    const sql = `SELECT
        ${Object.values(ProtologColumnType).join(', ')}
      FROM
        ${this.getTableName()} AS tbl
      WHERE tbl.id = ${this.entryIndexToRowIdMap[index]};`;

    return this.makeHierarchyTrees(sql).then((trees) => trees[0]);
  }

  override async getAllEntries(): Promise<HierarchyTreeNode[]> {
    const sql = `SELECT
        ${Object.values(ProtologColumnType).join(', ')}
      FROM
        ${this.getTableName()} AS tbl
      ORDER BY tbl.id`;

    return this.makeHierarchyTrees(sql);
  }

  override async customQuery<Q extends CustomQueryType>(
    type: Q,
    entriesRange: EntriesRange,
    param?: CustomQueryParamTypeMap[Q],
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    return new VisitableParserCustomQuery(type)
      .visit(CustomQueryType.LOG_TABLE_FILTER_VALUES, async () => {
        let column: string;
        switch (param) {
          case ProtologColumnType.TAG:
            column = 'tag';
            break;

          case ProtologColumnType.LEVEL:
            column = 'level';
            break;

          case ProtologColumnType.LOCATION:
            column = 'location';
            break;

          default:
            throw new Error('unexpected protolog column type requested');
        }
        const values = await getDistinctValues(
          this.traceProcessor,
          this.getTableName(),
          [column],
          param === ProtologColumnType.LOCATION ? '<NO_LOC>' : undefined,
        );

        if (param !== ProtologColumnType.LOCATION) {
          return values;
        }

        return Array.from(
          new Set(
            values.map((value) => {
              const startOfLineNumber = value.lastIndexOf(':');
              return startOfLineNumber === -1
                ? value
                : value.slice(0, startOfLineNumber);
            }),
          ),
        );
      })
      .getResult();
  }

  protected override getTableName(): string {
    return 'protolog';
  }

  private async makeHierarchyTrees(sql: string): Promise<HierarchyTreeNode[]> {
    const queryResult = await this.traceProcessor.query(sql);

    const trees: HierarchyTreeNode[] = [];

    for (const it = queryResult.iter({}); it.valid(); it.next()) {
      const properties = new PropertyTreeBuilderFromQueryRow()
        .setData(it)
        .setColumns(['ts', 'tag', 'level', 'location', 'message'])
        .setRootId('ProtoLogTrace')
        .setRootName('entry')
        .build();

      const strategy: MakeTimestampStrategyType = (valueNs: bigint) => {
        return this.timestampConverter.makeTimestampFromBootTimeNs(valueNs);
      };

      const provider = new PropertiesProviderBuilder()
        .setEagerProperties(properties)
        .setEagerOperations([
          new TransformToTimestamp(['ts'], strategy),
          new SetFormatters(),
        ])
        .build();

      const tree = new HierarchyTreeBuilderLog()
        .setRoot(provider)
        .setChildren([])
        .build();

      trees.push(tree);
    }

    return trees;
  }
}

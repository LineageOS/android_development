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

import {NOT_IMPLEMENTED_ERROR} from 'common/errors';
import {MakeTimestampStrategyType} from 'common/time/time';
import {HierarchyTreeBuilderLog} from 'parsers/hierarchy_tree_builder_log';
import {TransformToTimestamp} from 'parsers/operations/transform_to_timestamp';
import {AbstractParser} from 'parsers/perfetto/abstract_parser';
import {PropertyTreeBuilderFromQueryRow} from 'parsers/property_tree_builder_from_query_row';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {PropertiesProviderBuilder} from 'tree_node/properties_provider_builder';
import {SetFormatters} from 'viewers/operations/set_formatters';

export class ParserCujs extends AbstractParser<HierarchyTreeNode> {
  override getTraceType(): TraceType {
    return TraceType.CUJS;
  }

  protected override async preProcessTrace() {
    const sql = `SELECT RUN_METRIC('android/android_jank_cuj.sql');
    CREATE PERFETTO TABLE ${this.getTableName()} AS
      SELECT
        ROW_NUMBER() OVER (ORDER BY ts) - 1 AS id,
        cuj_id,
        upid,
        process_name,
        cuj_name,
        ts,
        dur,
        ts_end,
        state,
        layer_id,
        cuj_slice_name
      FROM android_jank_cuj
    `;
    await this.traceProcessor.query(sql);
  }

  override async getEntry(): Promise<HierarchyTreeNode> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  override async getAllEntries(): Promise<HierarchyTreeNode[]> {
    const sql = `
      SELECT
        cuj.cuj_id,
        cuj.upid,
        cuj.cuj_name AS full_cuj_name,
        cuj.state as status,
        CASE
          WHEN cuj.cuj_name LIKE '%:%' THEN SUBSTR(cuj.cuj_name, 1, INSTR(cuj.cuj_name, ':') - 1)
          ELSE cuj.cuj_name
        END AS cuj_type,
        ts,
        ts_end as end_timestamp,
        CASE
          WHEN cuj.cuj_name LIKE '%:%' THEN SUBSTR(cuj.cuj_name, INSTR(cuj.cuj_name, ':') + 1)
          ELSE NULL
        END AS cuj_tag,
        EXISTS (
          SELECT 1
          FROM slice AS cuj_state_marker
          JOIN track marker_track ON marker_track.id = cuj_state_marker.track_id
          WHERE
            cuj_state_marker.ts >= cuj.ts AND cuj_state_marker.ts + cuj_state_marker.dur <= cuj.ts + cuj.dur
            AND process.upid = cuj.upid
            AND (
              cuj_state_marker.name GLOB (cuj.cuj_slice_name || '#FT#cancel*')
              OR
              (marker_track.name = cuj.cuj_slice_name AND cuj_state_marker.name GLOB 'FT#cancel*')
            )
        ) AS canceled
      FROM ${this.getTableName()} AS cuj
      LEFT JOIN process ON cuj.upid = process.upid;`;

    return this.makeHierarchyTrees(sql);
  }

  protected override getTableName(): string {
    return 'android_jank_cuj_with_index';
  }

  private async makeHierarchyTrees(sql: string): Promise<HierarchyTreeNode[]> {
    const queryResult = await this.traceProcessor.query(sql);

    const trees: HierarchyTreeNode[] = [];

    for (const it = queryResult.iter({}); it.valid(); it.next()) {
      const properties = new PropertyTreeBuilderFromQueryRow()
        .setData(it)
        .setColumns(['cuj_type', 'ts', 'end_timestamp', 'canceled', 'cuj_tag'])
        .setConvertColumnToBoolean('canceled')
        .setRootId('CujTrace')
        .setRootName('cuj')
        .build();

      const strategy: MakeTimestampStrategyType = (valueNs: bigint) => {
        return this.timestampConverter.makeTimestampFromBootTimeNs(valueNs);
      };

      const provider = new PropertiesProviderBuilder()
        .setEagerProperties(properties)
        .setEagerOperations([
          new TransformToTimestamp(['ts', 'endTimestamp'], strategy),
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

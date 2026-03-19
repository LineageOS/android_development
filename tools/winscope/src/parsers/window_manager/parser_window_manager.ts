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

import {assertBigIntOrUndefined, assertStringOrUndefined} from '@common/assert';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {AbstractParser} from '@parsers/perfetto/abstract_parser';
import {CustomQueryParserResultTypeMap, CustomQueryType, VisitableParserCustomQuery,} from '@trace_api/custom_query';
import {EntriesRange} from '@trace_api/index_types';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';
import {QueryResult, QueryResults, RowIterator,} from '@trace_processor/query_result';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {RectsForTrace} from '@tree_node/rect_extractor_result';

import {makeEntryHierarchyTrees, makeTreeNodeId, makeTreeNodeName,} from './entry_hierarchy_tree_factory';
import {extractAllRects} from './rect_extractor';

/**
 * Parser for WindowManager Perfetto traces.
 */
export class ParserWindowManager extends AbstractParser<HierarchyTreeNode> {
  protected override readonly checkInvalidTs = true;
  private visibleAndDisplayRects: RectsForTrace | undefined;

  static async createInstance(
    traceFile: TraceFile,
    traceProcessor: TraceProcessor,
    timestampConverter: ParserTimestampConverter,
    traceGeometryData: TraceGeometryData,
  ): Promise<Array<AbstractParser<HierarchyTreeNode>>> {
    return [
      new ParserWindowManager(
        traceFile,
        traceProcessor,
        timestampConverter,
        traceGeometryData,
      ),
    ];
  }

  override async getRectsMap() {
    if (!this.visibleAndDisplayRects) {
      this.visibleAndDisplayRects = await this.fetchAllVisibleAndDisplayRects();
    }
    return this.visibleAndDisplayRects;
  }

  override getTraceType(): TraceType {
    return TraceType.WINDOW_MANAGER;
  }

  override async getEntry(index: number): Promise<HierarchyTreeNode> {
    return this.getEntryFromRange(index);
  }

  override async getRangeOfEntries(
    range: EntriesRange,
  ): Promise<HierarchyTreeNode[]> {
    // assuming the entryIndex monotically increases, true for WindowManager
    const snapshotStart = this.entryIndexToRowIdMap[range.start];
    const snapshotEnd = snapshotStart + range.end - range.start;
    const containersResult = await this.queryRangeContainersAndRects(
      snapshotStart,
      snapshotEnd,
      false,
    );
    const visibleAndDisplayRects = await this.fetchAllVisibleAndDisplayRects();
    return makeEntryHierarchyTrees(
      containersResult,
      visibleAndDisplayRects,
      this.traceProcessor,
      this.traceGeometryData,
    );
  }

  override async getQueryResults(
    entriesRange: EntriesRange,
    queryRawData: boolean,
  ): Promise<QueryResults<QueryResult>> {
    const snapshotStart = this.entryIndexToRowIdMap[entriesRange.start];
    const snapshotEnd = snapshotStart + entriesRange.end - entriesRange.start;
    const containersResult = await this.queryRangeContainersAndRects(
      snapshotStart,
      snapshotEnd,
      queryRawData,
    );
    const visibleRects = await this.queryAllVisibleAndDisplayRects();
    return {
      snapshotRange: undefined,
      nodeRange: containersResult,
      allVisibleRects: visibleRects,
      allSnapshots: undefined,
    };
  }

  override customQuery<Q extends CustomQueryType>(
    type: Q,
    _: EntriesRange,
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    return new VisitableParserCustomQuery(type)
      .visit(CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE, async () => {
        const sql = `SELECT DISTINCT token, title FROM android_windowmanager_windowcontainer;`;
        const queryResult = await this.traceProcessor.query(sql);
        const result: CustomQueryParserResultTypeMap[CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE] =
          [];
        for (const it = queryResult.iter({}); it.valid(); it.next()) {
          const token = assertBigIntOrUndefined(it.get('token') ?? undefined);
          const title = assertStringOrUndefined(it.get('title') ?? undefined);
          if (token !== undefined && title !== undefined) {
            result.push({token: Number(token), title});
          }
        }
        return result;
      })
      .getResult();
  }

  protected override getTableName(): string {
    return 'android_windowmanager';
  }

  protected override getStdLibModuleName(): string {
    return 'android.winscope.windowmanager';
  }

  private async fetchAllVisibleAndDisplayRects(): Promise<RectsForTrace> {
    if (this.visibleAndDisplayRects === undefined) {
      const visibleRectsResult = await this.queryAllVisibleAndDisplayRects();
      this.visibleAndDisplayRects = extractAllRects(
        visibleRectsResult.iter({}),
        this.traceGeometryData,
        (row: RowIterator) => makeTreeNodeId(row),
        (row: RowIterator) => makeTreeNodeName(row),
      );
    }
    return this.visibleAndDisplayRects;
  }

  private async queryAllVisibleAndDisplayRects(): Promise<QueryResult> {
    const visibleRectsDisplayQuery = `
      SELECT
        snapshot.focused_display_id,
        wc.snapshot_id,
        wc.title,
        wc.token,
        wc.container_type,
        wc.name_override,
        wc.is_visible,
        tr.group_id,
        tr.depth,
        tr.opacity,
        tr.rect_id
      FROM android_windowmanager AS snapshot
      INNER JOIN android_windowmanager_windowcontainer AS wc
        ON snapshot.id = wc.snapshot_id
      INNER JOIN android_winscope_trace_rect AS tr
        ON wc.window_rect_id = tr.id
        WHERE (wc.is_visible = 1 OR wc.container_type = 'DisplayContent')
        ORDER BY wc.id;
    `;
    return this.traceProcessor.query(visibleRectsDisplayQuery);
  }

  private async queryRangeContainersAndRects(
    start: number,
    end: number,
    queryRawData: boolean,
  ): Promise<QueryResult> {
    const query = `
      SELECT
        snapshot.arg_set_id as snapshot_arg_set_id,
        snapshot.focused_display_id,
        wc.snapshot_id,
        wc.arg_set_id,
        wc.token,
        wc.title,
        wc.container_type,
        wc.name_override,
        wc.is_visible,
        wc.parent_token,
        tr.group_id,
        tr.depth,
        tr.opacity,
        tr.rect_id
      FROM android_windowmanager AS snapshot
      INNER JOIN android_windowmanager_windowcontainer AS wc
        ON snapshot.id = wc.snapshot_id
      LEFT JOIN android_winscope_trace_rect AS tr
        ON wc.window_rect_id = tr.id
      WHERE wc.snapshot_id >= ${start} AND wc.snapshot_id < ${end}
        ORDER BY wc.id`;
    if (queryRawData) {
      return await this.traceProcessor.rawQuery(query);
    } else {
      return await this.traceProcessor.query(query);
    }
  }
}

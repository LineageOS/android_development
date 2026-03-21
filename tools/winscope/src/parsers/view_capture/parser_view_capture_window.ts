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
 * A parser for a single window in a Perfetto ViewCapture trace.
 */
export class ParserViewCaptureWindow extends AbstractParser<HierarchyTreeNode> {
  private visibleRects: RectsForTrace | undefined;
  private readonly packageName: string;
  private readonly windowName: string;

  constructor(
    traceFile: TraceFile,
    traceProcessor: TraceProcessor,
    timestampConverter: ParserTimestampConverter,
    traceGeometryData: TraceGeometryData,
    packageName: string,
    windowName: string,
  ) {
    super(traceFile, traceProcessor, timestampConverter, traceGeometryData);
    this.packageName = packageName;
    this.windowName = windowName;
  }

  override async getRectsMap() {
    if (!this.visibleRects) {
      this.visibleRects = await this.fetchAllVisibleRects();
    }
    return this.visibleRects;
  }

  override getTraceType(): TraceType {
    return TraceType.VIEW_CAPTURE;
  }

  override getDescriptors(): string[] {
    return [this.windowName, ...super.getDescriptors()];
  }

  override async getEntry(index: number): Promise<HierarchyTreeNode> {
    return this.getEntryFromRange(index);
  }

  override async getRangeOfEntries(
    range: EntriesRange,
  ): Promise<HierarchyTreeNode[]> {
    // assuming the entryIndex monotically increases, true for ViewCapture
    const snapshotStart = this.entryIndexToRowIdMap[range.start];
    const snapshotEnd = snapshotStart + range.end - range.start;
    const viewsResult = await this.queryRangeViewsAndRects(
      snapshotStart,
      snapshotEnd,
    );
    const visibleRects = await this.fetchAllVisibleRects();
    return makeEntryHierarchyTrees(
      viewsResult,
      visibleRects,
      this.traceProcessor,
      this.traceGeometryData,
      this.windowName,
    );
  }

  override async getQueryResults(
    entriesRange: EntriesRange,
    queryRawData: boolean,
  ): Promise<QueryResults<QueryResult>> {
    const snapshotStart = this.entryIndexToRowIdMap[entriesRange.start];
    const snapshotEnd = snapshotStart + entriesRange.end - entriesRange.start;
    const viewsResult = await this.queryRangeViewsAndRects(
      snapshotStart,
      snapshotEnd,
      queryRawData,
    );
    const visibleRects = await this.queryAllVisibleRects();
    return {
      snapshotRange: undefined,
      nodeRange: viewsResult,
      allVisibleRects: visibleRects,
      allSnapshots: undefined,
    };
  }

  override customQuery<Q extends CustomQueryType>(
    type: Q,
    _: EntriesRange,
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    return new VisitableParserCustomQuery(type)
      .visit(CustomQueryType.VIEW_CAPTURE_METADATA, async () => {
        const metadata = {
          packageName: this.packageName,
          windowName: this.windowName,
        };
        return Promise.resolve(metadata);
      })
      .getResult();
  }

  protected override getStdLibModuleName(): string | undefined {
    return 'android.winscope.viewcapture';
  }

  protected override getTableName(): string {
    return 'android_viewcapture';
  }

  override async buildEntryIndexToRowIdMap(): Promise<number[]> {
    const sqlRowIdAndTimestamp = `
        SELECT vc.id as id, vc.ts as ts
        FROM ${this.getTableName()} AS vc
        WHERE
          vc.window_name = '${this.windowName}' and vc.package_name = '${
            this.packageName
          }'
        ORDER BY vc.ts;
    `;
    const result = await this.traceProcessor.query(sqlRowIdAndTimestamp);
    const entryIndexToRowId: number[] = [];
    for (const it = result.iter({}); it.valid(); it.next()) {
      const rowId = Number(it.get('id'));
      entryIndexToRowId.push(rowId);
    }
    return entryIndexToRowId;
  }

  private async fetchAllVisibleRects(): Promise<RectsForTrace> {
    if (this.visibleRects === undefined) {
      const visibleRectsResult = await this.queryAllVisibleRects();
      this.visibleRects = extractAllRects(
        visibleRectsResult.iter({}),
        this.traceGeometryData,
        (row: RowIterator) => makeTreeNodeId(row, this.windowName),
        (row: RowIterator) => makeTreeNodeName(row),
      );
    }
    return this.visibleRects;
  }

  private async queryAllVisibleRects(): Promise<QueryResult> {
    const visibleRectsDisplayQuery = `
      SELECT
        vcv.snapshot_id,
        vcv.node_id,
        vcv.class_name,
        vcv.hashcode,
        vcv.is_visible,
        tr.group_id,
        tr.depth,
        tr.opacity,
        tr.rect_id
      FROM android_viewcapture_view AS vcv
      LEFT JOIN android_winscope_trace_rect AS tr
        ON vcv.trace_rect_id = tr.id
        WHERE vcv.is_visible = true
        ORDER BY vcv.id;
    `;
    return this.traceProcessor.query(visibleRectsDisplayQuery);
  }

  private async queryRangeViewsAndRects(
    start: number,
    end: number,
    queryRawData = false,
  ): Promise<QueryResult> {
    const query = `
      SELECT
        vcv.snapshot_id,
        vcv.arg_set_id,
        vcv.node_id,
        vcv.class_name,
        vcv.hashcode,
        vcv.is_visible,
        vcv.parent_id,
        vcv.view_id,
        tr.group_id,
        tr.depth,
        tr.opacity,
        tr.rect_id
      FROM android_viewcapture_view AS vcv
      LEFT JOIN android_winscope_trace_rect AS tr
        ON vcv.trace_rect_id = tr.id
      WHERE vcv.snapshot_id >= ${start} AND vcv.snapshot_id < ${end}
        ORDER BY vcv.id`;
    if (queryRawData) {
      return await this.traceProcessor.rawQuery(query);
    } else {
      return await this.traceProcessor.query(query);
    }
  }
}

/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {
  assertBigIntOrUndefined,
  assertDefined,
  assertStringOrUndefined,
} from 'common/assert';
import {AbstractParser} from 'parsers/perfetto/abstract_parser';
import {queryVsyncId} from 'parsers/perfetto/utils';
import {EntryHierarchyTreeFactory} from 'parsers/surface_flinger/entry_hierarchy_tree_factory';
import {
  RectExtractor,
  SnapshotRects,
} from 'parsers/surface_flinger/rect_extractor';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {
  CustomQueryParserResultTypeMap,
  CustomQueryType,
  VisitableParserCustomQuery,
} from 'trace_api/custom_query';
import {EntriesRange} from 'trace_api/index_types';
import {TraceType} from 'trace_api/trace_type';
import {QueryResult} from 'trace_processor/query_result';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';

export class ParserSurfaceFlinger extends AbstractParser<HierarchyTreeNode> {
  private readonly factory = new EntryHierarchyTreeFactory();
  private visibleAndDisplayRects: Map<bigint, SnapshotRects> | undefined;

  override getTraceType(): TraceType {
    return TraceType.SURFACE_FLINGER;
  }

  override async getEntry(index: number): Promise<HierarchyTreeNode> {
    const range: EntriesRange = {
      start: index,
      end: index + 1,
    };
    return this.getRangeOfEntries(range).then((trees) => {
      const entry = trees[0];
      if (entry === undefined) {
        throw new Error(
          `Entry at index ${index} not found or could not be parsed.`,
        );
      }
      return entry;
    });
  }

  override async getRangeOfEntries(
    entriesRange: EntriesRange,
  ): Promise<Array<HierarchyTreeNode | undefined>> {
    // assuming the entryIndex monotically increases, true for SurfaceFlinger
    const entriesSnapshotRangeStart =
      this.entryIndexToRowIdMap[entriesRange.start];
    const entriesSnapshotRangeEnd =
      entriesSnapshotRangeStart + entriesRange.end - entriesRange.start;
    const snapshotResult = await this.queryRangeSnapshots(
      entriesSnapshotRangeStart,
      entriesSnapshotRangeEnd,
    );
    const layersResult = await this.queryRangeLayersAndRects(
      entriesSnapshotRangeStart,
      entriesSnapshotRangeEnd,
    );
    const traceGeometryData = assertDefined(this.traceGeometryData);
    await this.fetchAllRects(traceGeometryData);
    return this.factory.makeEntryHierarchyTrees(
      snapshotResult,
      layersResult,
      assertDefined(this.visibleAndDisplayRects),
      this.traceProcessor,
      traceGeometryData,
    );
  }

  override async customQuery<Q extends CustomQueryType>(
    type: Q,
    entriesRange: EntriesRange,
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    return new VisitableParserCustomQuery(type)
      .visit(CustomQueryType.VSYNCID, async () => {
        return queryVsyncId(
          this.traceProcessor,
          this.getTableName(),
          this.entryIndexToRowIdMap,
          entriesRange,
        );
      })
      .visit(CustomQueryType.SF_LAYERS_ID_AND_NAME, async () => {
        const sql = `
        SELECT DISTINCT layer_id, layer_name FROM surfaceflinger_layer;
      `;
        const queryResult = await this.traceProcessor.query(sql);
        const result: CustomQueryParserResultTypeMap[CustomQueryType.SF_LAYERS_ID_AND_NAME] =
          [];
        for (const it = queryResult.iter({}); it.valid(); it.next()) {
          const id = assertBigIntOrUndefined(it.get('layer_id') ?? undefined);
          const name = assertStringOrUndefined(
            it.get('layer_name') ?? undefined,
          );
          if (id !== undefined && name !== undefined) {
            result.push({id: Number(id), name});
          }
        }
        return result;
      })
      .getResult();
  }

  protected override getTableName(): string {
    return 'surfaceflinger_layers_snapshot';
  }

  protected override getStdLibModuleName(): string {
    return 'android.winscope.surfaceflinger';
  }

  private async fetchAllRects(traceGeometryData: TraceGeometryData) {
    if (this.visibleAndDisplayRects === undefined) {
      const visibleRectsResult = await this.queryAllVisibleAndDisplayRects();
      const allSnapshotsResults = await this.queryRangeSnapshots(
        0,
        this.getLengthEntries(),
      );
      this.visibleAndDisplayRects =
        RectExtractor.extractAllVisibleAndDisplayRects(
          allSnapshotsResults,
          visibleRectsResult,
          traceGeometryData,
        );
    }
  }

  private async queryRangeSnapshots(
    start: number,
    end: number,
  ): Promise<QueryResult> {
    const snapshotQuery = `
  SELECT
          sfs.id,
          sfs.arg_set_id,
          display.is_on,
          display.is_virtual,
          display.display_id,
          display.display_name,
          trace_rect.rect_id,
          trace_rect.group_id,
          trace_rect.depth,
          trace_rect.transform_id
        FROM surfaceflinger_layers_snapshot AS sfs
        LEFT JOIN android_surfaceflinger_display AS display
          ON sfs.id = display.snapshot_id
        LEFT JOIN android_winscope_trace_rect AS trace_rect
          ON display.trace_rect_id = trace_rect.id
        WHERE sfs.id >= ${start} AND sfs.id < ${end}
          ORDER BY sfs.id, display.id;`;
    return await this.traceProcessor.query(snapshotQuery);
  }

  private async queryRangeLayersAndRects(
    start: number,
    end: number,
  ): Promise<QueryResult> {
    const layersQuery = `
  SELECT
          sfl.snapshot_id,
          sfl.id,
          sfl.arg_set_id,
          sfl.layer_id,
          sfl.layer_name,
          sfl.is_visible,
          sfl.parent,
          sfl.corner_radius_tl,
          sfl.corner_radius_tr,
          sfl.corner_radius_bl,
          sfl.corner_radius_br,
          sfl.hwc_composition_type,
          sfl.is_hidden_by_policy,
          sfl.z_order_relative_of,
          sfl.is_missing_z_parent,
          sfl.input_rect_id,
          ltr.group_id,
          ltr.depth,
          ltr.opacity,
          ltr.rect_id,
          ltr.transform_id,
          itr.group_id AS input_group_id,
          itr.depth AS input_depth,
          itr.is_visible AS input_is_visible,
          itr.is_spy,
          itr.rect_id AS input_trace_rect_id,
          itr.transform_id AS input_transform_id,
          frr.id AS fr_id
        FROM surfaceflinger_layer AS sfl
        LEFT JOIN android_winscope_trace_rect AS ltr
          ON sfl.layer_rect_id = ltr.id
        LEFT JOIN android_winscope_trace_rect AS itr
          ON sfl.input_rect_id = itr.id
        LEFT JOIN android_winscope_fill_region AS fr
          ON sfl.input_rect_id = fr.trace_rect_id
        LEFT JOIN android_winscope_rect AS frr
          ON fr.rect_id = frr.id
        WHERE sfl.snapshot_id >= ${start} AND sfl.snapshot_id < ${end}
          ORDER BY sfl.id`;
    return await this.traceProcessor.query(layersQuery);
  }

  private async queryAllVisibleAndDisplayRects(): Promise<QueryResult> {
    const visibleRectsDisplayQuery = `
    SELECT
          sfl.snapshot_id,
          sfl.id,
          sfl.layer_id,
          sfl.layer_name,
          sfl.is_visible,
          sfl.corner_radius_tl,
          sfl.corner_radius_tr,
          sfl.corner_radius_bl,
          sfl.corner_radius_br,
          sfl.input_rect_id,
          ltr.group_id,
          ltr.depth,
          ltr.opacity,
          ltr.rect_id,
          ltr.transform_id,
          itr.is_visible AS input_is_visible,
          itr.is_spy,
          itr.group_id AS input_group_id,
          itr.depth AS input_depth,
          itr.is_visible AS input_is_visible,
          itr.is_spy,
          itr.rect_id AS input_trace_rect_id,
          itr.transform_id AS input_transform_id,
          frr.id AS fr_id
        FROM surfaceflinger_layer AS sfl
        LEFT JOIN android_winscope_trace_rect AS ltr
          ON sfl.layer_rect_id = ltr.id
        LEFT JOIN android_winscope_trace_rect AS itr
          ON sfl.input_rect_id = itr.id
        LEFT JOIN android_winscope_fill_region AS fr
          ON sfl.input_rect_id = fr.trace_rect_id
        LEFT JOIN android_winscope_rect AS frr
          ON fr.rect_id = frr.id
          WHERE (sfl.is_visible = true) OR (itr.is_visible = true)
          ORDER BY sfl.id;
    `;
    return this.traceProcessor.query(visibleRectsDisplayQuery);
  }
}

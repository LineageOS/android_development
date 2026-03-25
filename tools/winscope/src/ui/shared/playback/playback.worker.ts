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
import {NOT_IMPLEMENTED_ERROR} from '@common/errors';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {makeEntryHierarchyTrees as sfMakeEntryHierarchyTrees} from '@parsers/surface_flinger/entry_hierarchy_tree_factory';
import {makeEntryHierarchyTrees as wmMakeEntryHierarchyTrees} from '@parsers/window_manager/entry_hierarchy_tree_factory';
import {TraceType} from '@trace_api/trace_type';
import {createQueryResult} from '@trace_processor/perfetto/query_result';
import {QueryResult} from '@trace_processor/query_result';
import {Registry} from '@trace/proto_utils/tampered_message_type';
import {RectsForTrace} from '@tree_node/rect_extractor_result';

interface WorkerMessage {
  start: number;
  end: number;
  snapshotBatches: Uint8Array[] | undefined;
  nodeBatches: Uint8Array[];
  type: TraceType;
  traceGeometryData: TraceGeometryData;
  visibleRectsMap: RectsForTrace;
}

addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  await Registry.getInstance().loadDefaultDescriptors();

  const traceGeometryData = event.data.traceGeometryData;
  Object.setPrototypeOf(traceGeometryData, TraceGeometryData.prototype);

  const queries = processQueryResults(
    event.data.start,
    event.data.end,
    event.data.snapshotBatches,
    event.data.nodeBatches,
  );
  const snapshot = queries[0];
  const node = queries[1];

  const trees = buildTraceEntryValue(
    event.data.type,
    snapshot,
    node,
    event.data.visibleRectsMap,
    traceGeometryData,
  );
  postMessage({trees});
});

function buildTraceEntryValue(
  traceType: TraceType,
  snapshotResults: QueryResult | undefined,
  nodeResults: QueryResult,
  rectsMap: RectsForTrace,
  traceGeometryData: TraceGeometryData,
) {
  switch (traceType) {
    case TraceType.SURFACE_FLINGER:
      return sfMakeEntryHierarchyTrees(
        assertDefined(snapshotResults),
        nodeResults,
        rectsMap,
        undefined,
        traceGeometryData,
      );
    case TraceType.WINDOW_MANAGER:
      return wmMakeEntryHierarchyTrees(
        nodeResults,
        rectsMap,
        undefined,
        traceGeometryData,
      );
    default:
      throw NOT_IMPLEMENTED_ERROR;
  }
}

function processQueryResults(
  start: number,
  end: number,
  snapshotBatches: Uint8Array[] | undefined,
  nodeBatches: Uint8Array[],
): [QueryResult | undefined, QueryResult] {
  let snapshotQueryResult;
  if (snapshotBatches) {
    const snapshotQueryString = snapshotQuery(start, end);
    const snapshotErrorInfo = {
      query: snapshotQueryString,
    };
    snapshotQueryResult = createQueryResult(snapshotErrorInfo);
    for (let i = 0; i < snapshotBatches.length; i++) {
      snapshotQueryResult.appendResultBatch(snapshotBatches[i]);
    }
  }

  const layerQueryString = layerQuery(start, end);
  const layerErrorInfo = {
    query: layerQueryString,
  };
  const layerQueryResult = createQueryResult(layerErrorInfo);
  for (let i = 0; i < nodeBatches.length; i++) {
    layerQueryResult.appendResultBatch(nodeBatches[i]);
  }
  return [snapshotQueryResult, layerQueryResult];
}

function snapshotQuery(start: number, end: number) {
  return `SELECT
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
}

function layerQuery(start: number, end: number) {
  return `SELECT
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
          ORDER BY sfl.id;`;
}

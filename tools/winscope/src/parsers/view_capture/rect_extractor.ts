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

import {assertBigInt, assertDefined} from '@common/assert';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {TraceRectBuilderFromQueryRow} from '@parsers/helpers/trace_rect_builder_from_query_row';
import {RowIterator} from '@trace_processor/query_result';
import {NodeRects, RectsForTrace, SnapshotRects,} from '@tree_node/rect_extractor_result';
import {TraceRect} from '@tree_node/trace_rect';

/**
 * Extracts VC rect from a trace processor query result row.
 */
export function extractRect(
  viewRow: RowIterator,
  rectId: string,
  rectName: string,
  traceGeometryData: TraceGeometryData,
): TraceRect {
  const preprocessedRectId = assertBigInt(viewRow.get('rect_id'));
  const rect = assertDefined(traceGeometryData.getRect(preprocessedRectId));
  return new TraceRectBuilderFromQueryRow()
    .setRect(rect)
    .setRow(viewRow)
    .setId(rectId + ' ' + rectName)
    .setName(rectName)
    .setExtractOpacity(true)
    .setExtractMatrix(false)
    .build();
}

/**
 * Extracts all VC rects from a trace processor query result.
 */
export function extractAllRects(
  rowIterator: RowIterator,
  traceGeometryData: TraceGeometryData,
  makeRectId: (row: RowIterator) => string,
  makeRectName: (row: RowIterator) => string,
): RectsForTrace {
  const allRects: RectsForTrace = new Map();

  for (const it = rowIterator; it.valid(); it.next()) {
    const rect = extractRect(
      it,
      makeRectId(it),
      makeRectName(it),
      traceGeometryData,
    );

    const snapshotId = assertBigInt(it.get('snapshot_id'));
    const nodeId = assertBigInt(it.get('node_id'));
    const existingRectsForSnapshot = allRects.get(snapshotId);

    const nodeRect: NodeRects = {
      primaryRects: [rect],
      secondaryRects: undefined,
    };

    if (existingRectsForSnapshot) {
      existingRectsForSnapshot.set(nodeId, nodeRect);
    } else {
      const rectsForSnapshot: SnapshotRects = new Map([[nodeId, nodeRect]]);
      allRects.set(snapshotId, rectsForSnapshot);
    }
  }

  return allRects;
}

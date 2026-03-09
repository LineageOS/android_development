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

import {assertBigInt, assertBigIntOrUndefined, assertDefined,} from '@common/assert';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {TraceRectBuilderFromQueryRow} from '@parsers/helpers/trace_rect_builder_from_query_row';
import {RowIterator} from '@trace_processor/query_result';
import {RectsForTrace, SnapshotRects} from '@tree_node/rect_extractor_result';
import {TraceRect} from '@tree_node/trace_rect';

import {ContainerType} from './container_type';

/**
 * Extracts a WM rect from a trace processor query result row.
 */
export function extractRect(
  row: RowIterator,
  rectId: string,
  rectName: string,
  traceGeometryData: TraceGeometryData,
): TraceRect | undefined {
  const preprocessedRectId = assertBigIntOrUndefined(
    row.get('rect_id') ?? undefined,
  );
  if (preprocessedRectId === undefined) {
    return undefined;
  }
  const rect = assertDefined(traceGeometryData.getRect(preprocessedRectId));
  const isDisplay = row.get('container_type') === ContainerType.DisplayContent;
  return new TraceRectBuilderFromQueryRow()
    .setRect(rect)
    .setRow(row)
    .setId(rectId)
    .setName(isDisplay ? 'Display - ' + rectName : rectName)
    .setExtractOpacity(!isDisplay)
    .setIsDisplay(isDisplay)
    .setIsActiveDisplay(
      isDisplay && row.get('group_id') === row.get('focused_display_id'),
    )
    .setExtractMatrix(false)
    .build();
}

/**
 * Extracts all available WM rects from a trace processor query result.
 */
export function extractAllRects(
  rowIterator: RowIterator,
  traceGeometryData: TraceGeometryData,
  makeRectId: (row: RowIterator) => string,
  makeRectName: (row: RowIterator) => string,
): RectsForTrace {
  const allRects: RectsForTrace = new Map();

  for (const it = rowIterator; it.valid(); it.next()) {
    const rectName = makeRectName(it);
    const rect = extractRect(
      it,
      makeRectId(it) + ' ' + rectName,
      rectName,
      traceGeometryData,
    );
    if (rect === undefined) {
      continue;
    }

    const snapshotId = assertBigInt(it.get('snapshot_id'));
    const token = assertBigInt(it.get('token'));
    const existingRectsForSnapshot = allRects.get(snapshotId);

    const nodeRect = {primaryRects: [rect], secondaryRects: []};

    if (existingRectsForSnapshot) {
      existingRectsForSnapshot.set(token, nodeRect);
    } else {
      const rectsForSnapshot: SnapshotRects = new Map([[token, nodeRect]]);
      allRects.set(snapshotId, rectsForSnapshot);
    }
  }

  return allRects;
}

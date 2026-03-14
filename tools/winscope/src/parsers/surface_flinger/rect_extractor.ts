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

import {assertBigInt, assertBigIntOrUndefined, assertDefined, assertString, assertStringOrUndefined,} from '@common/assert';
import {Rect} from '@common/geometry/rect';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {TraceRectBuilderFromQueryRow} from '@parsers/helpers/trace_rect_builder_from_query_row';
import {QueryResult, RowIterator} from '@trace_processor/query_result';
import {RectsForTrace, SnapshotRects} from '@tree_node/rect_extractor_result';
import {TraceRect} from '@tree_node/trace_rect';

/**
 * Extracts rects from a trace processor query result.
 */
export class RectExtractor {
  static extractAllVisibleAndDisplayRects(
    snapshotResult: QueryResult,
    rectsResult: QueryResult,
    traceGeometryData: TraceGeometryData,
  ): RectsForTrace {
    const allRectsMap: RectsForTrace = new Map();
    const currRect = rectsResult.iter({});
    const currSnapshot = snapshotResult.iter({});
    while (currSnapshot.valid()) {
      const currentId = assertBigInt(currSnapshot.get('id'));

      // currSnapshot is iterated in extractDisplayRectsForSnapshot
      const {displayRects} = RectExtractor.extractDisplayRectsForSnapshot(
        currSnapshot,
        currentId,
        traceGeometryData,
      );

      // currRect is iterated in extractLayerRectsForSnapshot
      const {rects: layerRects} = RectExtractor.extractLayerRectsForSnapshot(
        currRect,
        currentId,
        traceGeometryData,
      );

      const snapshotRect: SnapshotRects = layerRects;
      if (displayRects.length > 0) {
        snapshotRect.set(-1n, {
          primaryRects: displayRects,
          secondaryRects: undefined,
        });
      }

      allRectsMap.set(currentId, snapshotRect);
    }
    return allRectsMap;
  }

  static extractLayerRectsForSnapshot(
    rectIter: RowIterator,
    currSnapshotId: bigint,
    traceGeometryData: TraceGeometryData,
  ): {rects: SnapshotRects} {
    const rects: SnapshotRects = new Map();
    let prevUniqueRowId: bigint | undefined;

    while (rectIter.valid()) {
      const snapshotId = assertBigIntOrUndefined(
        rectIter.get('snapshot_id') ?? undefined,
      );

      if (snapshotId !== currSnapshotId) {
        break;
      }

      const layerIdBigint = assertBigIntOrUndefined(
        rectIter.get('layer_id') ?? undefined,
      );
      if (layerIdBigint === undefined) {
        rectIter.next();
        continue;
      }

      const layerId = Number(layerIdBigint);
      const uniqueRowId = assertBigInt(rectIter.get('id'));

      if (prevUniqueRowId !== undefined && uniqueRowId === prevUniqueRowId) {
        const layerEntry = rects.get(layerIdBigint);
        const inputRect = layerEntry?.secondaryRects?.[0];
        if (inputRect?.fillRegion) {
          const fillRegionRect = RectExtractor.extractFillRegionRect(
            rectIter,
            traceGeometryData,
          );
          if (fillRegionRect) {
            inputRect.fillRegion.rects.push(fillRegionRect);
          }
        }
      } else {
        prevUniqueRowId = uniqueRowId;
        const layerName = assertString(rectIter.get('layer_name'));
        const nodeId = `${layerId} ${layerName}`;

        const layerRects = RectExtractor.extractLayerRects(
          rectIter,
          nodeId,
          layerName,
          traceGeometryData,
        );
        if (layerRects) {
          rects.set(layerIdBigint, layerRects);
        }
      }
      rectIter.next();
    }
    return {rects};
  }

  static extractDisplayRectsForSnapshot(
    snapshotIter: RowIterator,
    targetSnapshotId: bigint | undefined,
    traceGeometryData: TraceGeometryData,
  ): {displayRects: TraceRect[]} {
    const displayRects: TraceRect[] = [];

    for (snapshotIter; snapshotIter.valid(); snapshotIter.next()) {
      const snapshotId = assertBigIntOrUndefined(
        snapshotIter.get('id') ?? undefined,
      );

      if (snapshotId !== targetSnapshotId) {
        break;
      }

      const displayId = assertBigIntOrUndefined(
        snapshotIter.get('display_id') ?? undefined,
      );
      if (displayId === undefined) {
        continue;
      }
      const displayIdString = displayId.toString();
      const isActiveDisplay =
        snapshotIter.get('is_on') && !snapshotIter.get('is_virtual');
      const name = assertStringOrUndefined(
        snapshotIter.get('display_name') ?? undefined,
      );
      const rectId = assertBigIntOrUndefined(
        snapshotIter.get('rect_id') ?? undefined,
      );
      const transformId = assertBigIntOrUndefined(
        snapshotIter.get('transform_id') ?? undefined,
      );
      if (rectId === undefined || transformId === undefined) {
        continue;
      }
      const preprocessedRect = assertDefined(traceGeometryData.getRect(rectId));
      const preprocessedTransformMatrix = assertDefined(
        traceGeometryData.getTransform(transformId),
      );

      const rect = new TraceRectBuilderFromQueryRow()
        .setRect(preprocessedRect)
        .setTransformMatrix(preprocessedTransformMatrix)
        .setRow(snapshotIter)
        .setId('Display - ' + displayIdString)
        .setName(name ?? 'Unknown Display')
        .setIsDisplay(true)
        .setIsActiveDisplay(!!isActiveDisplay)
        .setExtractMatrix(false)
        .build();
      displayRects.push(rect);
    }
    return {displayRects};
  }

  static extractFillRegionRect(
    row: RowIterator,
    traceGeometryData: TraceGeometryData,
  ): Rect | undefined {
    const fillRegionId = assertBigIntOrUndefined(row.get('fr_id') ?? undefined);
    if (fillRegionId === undefined) {
      return undefined;
    }
    const rect = traceGeometryData.getRect(fillRegionId);
    if (rect === undefined) {
      return undefined;
    }
    return new Rect(rect.x, rect.y, rect.w, rect.h);
  }

  static extractLayerRects(
    row: RowIterator,
    rectId: string,
    layerName: string,
    traceGeometryData: TraceGeometryData,
  ):
    | {primaryRects: TraceRect[]; secondaryRects: TraceRect[] | undefined}
    | undefined {
    const bounds = RectExtractor.extractBoundsRect(
      row,
      rectId,
      layerName,
      traceGeometryData,
    );
    const input = RectExtractor.extractInputRect(
      row,
      rectId,
      layerName,
      traceGeometryData,
    );
    if (!bounds && !input) {
      return undefined;
    }
    return {
      primaryRects: bounds ? [bounds] : [],
      secondaryRects: input ? [input] : undefined,
    };
  }

  private static extractBoundsRect(
    row: RowIterator,
    rectId: string,
    layerName: string,
    traceGeometryData: TraceGeometryData,
  ): TraceRect | undefined {
    const groupId = assertBigIntOrUndefined(row.get('group_id') ?? undefined);
    if (groupId === undefined) {
      return undefined;
    }
    const preprocessedRectId = assertBigIntOrUndefined(
      row.get('rect_id') ?? undefined,
    );
    const preprocessedTransformId = assertBigIntOrUndefined(
      row.get('transform_id') ?? undefined,
    );
    if (
      preprocessedRectId === undefined ||
      preprocessedTransformId === undefined
    ) {
      return undefined;
    }
    const rect = traceGeometryData.getRect(preprocessedRectId);
    const transform = traceGeometryData.getTransform(preprocessedTransformId);
    if (rect === undefined || transform === undefined) {
      return undefined;
    }
    return new TraceRectBuilderFromQueryRow()
      .setRect(rect)
      .setTransformMatrix(transform)
      .setRow(row)
      .setId(rectId)
      .setName(layerName)
      .setExtractCornerRadii(true)
      .setExtractOpacity(true)
      .build();
  }

  private static extractInputRect(
    row: RowIterator,
    rectId: string,
    layerName: string,
    traceGeometryData: TraceGeometryData,
  ): TraceRect | undefined {
    const groupId = assertBigIntOrUndefined(
      row.get('input_group_id') ?? undefined,
    );
    if (groupId === undefined) {
      return undefined;
    }
    const preprocessedRectId = assertBigIntOrUndefined(
      row.get('input_trace_rect_id') ?? undefined,
    );
    const preprocessedTransformId = assertBigIntOrUndefined(
      row.get('input_transform_id') ?? undefined,
    );

    if (
      preprocessedRectId === undefined ||
      preprocessedTransformId === undefined ||
      traceGeometryData === undefined
    ) {
      return undefined;
    }
    const rect = traceGeometryData.getRect(preprocessedRectId);
    const transform = traceGeometryData.getTransform(preprocessedTransformId);
    if (rect === undefined || transform === undefined) {
      return undefined;
    }
    const builder = new TraceRectBuilderFromQueryRow()
      .setRect(rect)
      .setTransformMatrix(transform)
      .setRow(row)
      .setId(rectId)
      .setName(layerName)
      .setRectColumns(['input_x', 'input_y', 'input_w', 'input_h'])
      .setGroupIdColumn('input_group_id')
      .setDepthColumn('input_depth')
      .setIsVisibleColumn('input_is_visible')
      .setExtractIsSpy(true);

    const fillRegionRect = RectExtractor.extractFillRegionRect(
      row,
      traceGeometryData,
    );
    if (fillRegionRect) {
      builder.addFillRegionRect(fillRegionRect);
    }

    return builder.build();
  }
}

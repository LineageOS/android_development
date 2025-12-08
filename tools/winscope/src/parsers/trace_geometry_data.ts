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

import {assertBigInt} from 'common/assert';
import {Rect} from 'common/geometry/rect';
import {TransformMatrix} from 'common/geometry/transform_matrix';
import {TraceProcessor} from 'trace_processor/trace_processor';

/**
 * A class for fetching and building geometry data from a trace.
 */
export class TraceGeometryData {
  private rectsMap: Map<bigint, Rect>;
  private transformMap: Map<bigint, TransformMatrix>;
  private traceProcessor: TraceProcessor;

  constructor(traceProcessor: TraceProcessor) {
    this.traceProcessor = traceProcessor;
    this.rectsMap = new Map<bigint, Rect>();
    this.transformMap = new Map<bigint, TransformMatrix>();
  }

  async fetchAndBuild() {
    const allRects = `SELECT
        rr.id,
        rr.x,
        rr.y,
        rr.w,
        rr.h
        FROM android_winscope_rect AS rr`;

    const allTransforms = `SELECT
        lt.id,
        lt.dsdx,
        lt.dtdx,
        lt.dsdy,
        lt.dtdy,
        lt.tx,
        lt.ty
        FROM android_winscope_transform as lt`;

    const rectsResults = await this.traceProcessor.query(allRects);
    const transformResults = await this.traceProcessor.query(allTransforms);

    for (const row = rectsResults.iter({}); row.valid(); row.next()) {
      const currentId = assertBigInt(row.get('id'));
      const getNumber = (colName: string): number => Number(row.get(colName));
      const newRect = new Rect(
        getNumber('x'),
        getNumber('y'),
        getNumber('w'),
        getNumber('h'),
      );
      this.rectsMap.set(currentId, newRect);
    }

    for (const row = transformResults.iter({}); row.valid(); row.next()) {
      const currentId = assertBigInt(row.get('id'));
      const getNumber = (colName: string): number => Number(row.get(colName));
      const newTransform = new TransformMatrix(
        getNumber('dsdx'),
        getNumber('dtdx'),
        getNumber('tx'),
        getNumber('dtdy'),
        getNumber('dsdy'),
        getNumber('ty'),
      );
      this.transformMap.set(currentId, newTransform);
    }
  }

  getRect(id: bigint) {
    return this.rectsMap.get(id);
  }

  getTransform(id: bigint) {
    return this.transformMap.get(id);
  }
}

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

import {Rect} from '@common/geometry/rect';
import {TransformMatrix} from '@common/geometry/transform_matrix';
import {makeSpyQueryResult, makeSpyRowIterator, setupMockIteratorWithRows,} from '@trace_processor/test_utils';
import {TraceProcessor} from '@trace_processor/trace_processor';

import {buildTraceGeometryData, TraceGeometryData} from './trace_geometry_data';

describe('TraceGeometryData', () => {
  let mockTraceProcessor: jasmine.SpyObj<TraceProcessor>;

  beforeEach(() => {
    mockTraceProcessor = jasmine.createSpyObj<TraceProcessor>(
      'MockTraceProcessor',
      ['query'],
    );
  });

  describe('fetchAndBuild', () => {
    it('should query the trace processor and build the internal map', async () => {
      const mockRectRows = [
        {id: 1n, x: 0, y: 0, w: 10, h: 10},
        {id: 2n, x: 5, y: 5, w: 20, h: 20},
      ];
      const mockTransformRows = [
        {id: 1n, dsdx: 1, dtdx: 0, tx: 0, dtdy: 1, dsdy: 0, ty: 0},
        {id: 2n, dsdx: 2, dtdx: 0.1, tx: 50, dtdy: 2, dsdy: 0.2, ty: 51},
      ];

      setupMockQuery(mockRectRows, mockTransformRows);
      const traceGeometryData =
        await buildTraceGeometryData(mockTraceProcessor);

      expect(mockTraceProcessor.query).toHaveBeenCalledTimes(2);

      expect(traceGeometryData.getRect(1n)).toEqual(new Rect(0, 0, 10, 10));
      expect(traceGeometryData.getTransform(1n)).toEqual(
        new TransformMatrix(1, 0, 0, 1, 0, 0),
      );

      expect(traceGeometryData.getRect(2n)).toEqual(new Rect(5, 5, 20, 20));
      expect(traceGeometryData.getTransform(2n)).toEqual(
        new TransformMatrix(2, 0.1, 50, 2, 0.2, 51),
      );
    });

    it('should handle empty query results', async () => {
      setupMockQuery([], []);
      const traceGeometryData =
        await buildTraceGeometryData(mockTraceProcessor);
      expect(mockTraceProcessor.query).toHaveBeenCalledTimes(2);
      expect(traceGeometryData.getRect(1n)).toBeUndefined();
      expect(traceGeometryData.getTransform(1n)).toBeUndefined();
    });
  });

  describe('getRect', () => {
    let traceGeometryData: TraceGeometryData;

    beforeEach(async () => {
      const mockRectRows = [{id: 100n, x: 1, y: 2, w: 3, h: 4}];
      setupMockQuery(mockRectRows, []);
      traceGeometryData = await buildTraceGeometryData(mockTraceProcessor);
    });

    it('getRect should return the correct Rect for a valid ID', () => {
      expect(traceGeometryData.getRect(100n)).toEqual(new Rect(1, 2, 3, 4));
    });

    it('getRect should return undefined for an invalid ID', () => {
      expect(traceGeometryData.getRect(999n)).toBeUndefined();
    });
  });

  describe('getTransform', () => {
    let traceGeometryData: TraceGeometryData;

    beforeEach(async () => {
      const mockTransformRows = [
        {id: 100n, dsdx: 1.1, dtdx: 0.1, tx: 10, dtdy: 1.2, dsdy: 0.2, ty: 11},
      ];
      setupMockQuery([], mockTransformRows);
      traceGeometryData = await buildTraceGeometryData(mockTraceProcessor);
    });

    it('getTransform should return the correct TransformMatrix for a valid ID', () => {
      expect(traceGeometryData.getTransform(100n)).toEqual(
        new TransformMatrix(1.1, 0.1, 10, 1.2, 0.2, 11),
      );
    });

    it('getTransform should return undefined for an invalid ID', () => {
      expect(traceGeometryData.getTransform(999n)).toBeUndefined();
    });
  });

  function setupMockQuery(
    rectRows: Array<{[key: string]: bigint | number | string}>,
    transformRows: Array<{[key: string]: bigint | number | string}>,
  ) {
    mockTraceProcessor.query.and.callFake(async (query: string) => {
      if (query.includes('android_winscope_rect')) {
        return createMockQueryResult(rectRows);
      } else if (query.includes('android_winscope_transform')) {
        return createMockQueryResult(transformRows);
      }
      throw new Error('Unexpected query');
    });
  }

  function createMockQueryResult(
    rows: Array<{[key: string]: bigint | number | string}>,
  ) {
    const rowIterator = makeSpyRowIterator();
    setupMockIteratorWithRows(rowIterator, rows);
    return makeSpyQueryResult(rowIterator);
  }
});

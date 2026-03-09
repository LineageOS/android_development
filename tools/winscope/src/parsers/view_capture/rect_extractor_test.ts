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
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {ColumnType} from '@trace_processor/query_result';
import {makeSpyRowIterator, setupMockIteratorWithRows,} from '@trace_processor/test_utils';
import {RectsForTrace, SnapshotRects} from '@tree_node/rect_extractor_result';
import {TraceRectBuilder} from '@tree_node/trace_rect_builder';

import {extractAllRects, extractRect} from './rect_extractor';

describe('ViewCapture RectExtractor', () => {
  it('extracts rect', () => {
    const expectedRect = new TraceRectBuilder()
      .setX(1)
      .setY(2)
      .setWidth(3)
      .setHeight(4)
      .setId('ViewNode test.package.name@123456789')
      .setName('test.package.name@123456789')
      .setGroupId(0)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setDepth(4)
      .setOpacity(1)
      .setIsSpy(false)
      .build();

    const traceGeometryData = jasmine.createSpyObj<TraceGeometryData>(
      'traceGeometryData',
      ['getRect'],
    );
    traceGeometryData.getRect
      .withArgs(2n)
      .and.returnValue(new Rect(1, 2, 3, 4));

    const row = makeSpyRowIterator();
    row.get.withArgs('rect_id').and.returnValue(2n);
    row.get.withArgs('is_visible').and.returnValue(1n);
    row.get.withArgs('group_id').and.returnValue(0n);
    row.get.withArgs('depth').and.returnValue(4n);
    row.get.withArgs('opacity').and.returnValue(1);

    const rect = extractRect(
      row,
      'ViewNode',
      'test.package.name@123456789',
      traceGeometryData,
    );
    expect(rect).toEqual(expectedRect);
  });

  it('extracts all rects', () => {
    const expectedRectSnapshot1: SnapshotRects = new Map([
      [
        10n,
        {
          primaryRects: [
            new TraceRectBuilder()
              .setX(5)
              .setY(6)
              .setWidth(4)
              .setHeight(3)
              .setId('testId testName')
              .setName('testName')
              .setGroupId(0)
              .setIsVisible(true)
              .setIsDisplay(false)
              .setDepth(4)
              .setOpacity(1)
              .setIsSpy(false)
              .build(),
          ],
          secondaryRects: undefined,
        },
      ],

      [
        20n,
        {
          primaryRects: [
            new TraceRectBuilder()
              .setX(1)
              .setY(2)
              .setWidth(3)
              .setHeight(4)
              .setId('testId testName')
              .setName('testName')
              .setGroupId(0)
              .setIsVisible(false)
              .setIsDisplay(false)
              .setDepth(8)
              .setOpacity(0.5)
              .setIsSpy(false)
              .build(),
          ],
          secondaryRects: undefined,
        },
      ],
    ]);
    const expectedRectSnapshot2: SnapshotRects = new Map([
      [
        10n,
        {
          primaryRects: [
            new TraceRectBuilder()
              .setX(1)
              .setY(2)
              .setWidth(3)
              .setHeight(4)
              .setId('testId testName')
              .setName('testName')
              .setGroupId(0)
              .setIsVisible(true)
              .setIsDisplay(false)
              .setDepth(4)
              .setOpacity(1)
              .setIsSpy(false)
              .build(),
          ],
          secondaryRects: undefined,
        },
      ],

      [
        20n,
        {
          primaryRects: [
            new TraceRectBuilder()
              .setX(5)
              .setY(6)
              .setWidth(4)
              .setHeight(3)
              .setId('testId testName')
              .setName('testName')
              .setGroupId(0)
              .setIsVisible(false)
              .setIsDisplay(false)
              .setDepth(8)
              .setOpacity(0.5)
              .setIsSpy(false)
              .build(),
          ],
          secondaryRects: undefined,
        },
      ],
    ]);

    const expectedRects: RectsForTrace = new Map<bigint, SnapshotRects>([
      [0n, expectedRectSnapshot1],
      [1n, expectedRectSnapshot2],
    ]);

    const traceGeometryData = jasmine.createSpyObj<TraceGeometryData>(
      'traceGeometryData',
      ['getRect'],
    );
    traceGeometryData.getRect
      .withArgs(1n)
      .and.returnValue(new Rect(5, 6, 4, 3));
    traceGeometryData.getRect
      .withArgs(2n)
      .and.returnValue(new Rect(1, 2, 3, 4));

    const iter = makeSpyRowIterator();
    const rows: Array<{[key: string]: ColumnType | null}> = [
      {
        snapshot_id: 0n,
        node_id: 10n,
        rect_id: 1n,
        is_visible: 1n,
        group_id: 0n,
        depth: 4n,
        opacity: 1,
      },
      {
        snapshot_id: 0n,
        node_id: 20n,
        rect_id: 2n,
        is_visible: 0n,
        group_id: 0n,
        depth: 8n,
        opacity: 0.5,
      },
      {
        snapshot_id: 1n,
        node_id: 10n,
        rect_id: 2n,
        is_visible: 1n,
        group_id: 0n,
        depth: 4n,
        opacity: 1,
      },
      {
        snapshot_id: 1n,
        node_id: 20n,
        rect_id: 1n,
        is_visible: 0n,
        group_id: 0n,
        depth: 8n,
        opacity: 0.5,
      },
    ];
    setupMockIteratorWithRows(iter, rows);

    const rects = extractAllRects(
      iter,
      traceGeometryData,
      () => 'testId',
      () => 'testName',
    );
    expect(rects).toEqual(expectedRects);
  });
});

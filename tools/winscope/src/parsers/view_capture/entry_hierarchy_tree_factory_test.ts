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
import {Rect} from '@common/geometry/rect';
import {UINT32_MAX} from '@common/math';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {ColumnType, QueryResult, RowIterator,} from '@trace_processor/query_result';
import {makeSpyQueryResult, makeSpyRowIterator, setupMockIteratorWithRows,} from '@trace_processor/test_utils';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {RectsForTrace, SnapshotRects} from '@tree_node/rect_extractor_result';
import {TraceRect} from '@tree_node/trace_rect';

import {makeEntryHierarchyTrees, makeTreeNodeId, makeTreeNodeName,} from './entry_hierarchy_tree_factory';

describe('EntryHierarchyTreeFactory', () => {
  it('makeTreeNodeId', () => {
    const row = makeSpyRowIterator();
    row.get.withArgs('node_id').and.returnValue(2n);
    expect(makeTreeNodeId(row, 'TestWindow')).toBe('TestWindowViewNode2');
  });

  it('makeTreeNodeName', () => {
    const row = makeSpyRowIterator();
    row.get.withArgs('class_name').and.returnValue('TestClass');
    row.get.withArgs('hashcode').and.returnValue(12345n);
    expect(makeTreeNodeName(row)).toBe('TestClass@12345');
  });

  describe('makeEntryHierarchyTrees', () => {
    const traceProcessor = jasmine.createSpyObj<TraceProcessor>(
      'traceProcessor',
      ['query'],
    );

    const defaultNodeId = 13n;
    const defaultSnapshotId = 100n;
    const defaultRect = new Rect(1, 2, 3, 4);
    let viewsIter: jasmine.SpyObj<RowIterator>;
    let viewResult: jasmine.SpyObj<QueryResult>;
    let mockTraceGeometryData: jasmine.SpyObj<TraceGeometryData>;

    beforeEach(() => {
      viewsIter = makeSpyRowIterator();
      viewResult = makeSpyQueryResult(viewsIter);
      mockTraceGeometryData = jasmine.createSpyObj<TraceGeometryData>(
        'TraceGeometryData',
        ['getRect', 'getTransform'],
      );
      mockTraceGeometryData.getRect.withArgs(1n).and.returnValue(defaultRect);
    });

    it('builds hierarchy tree for one snapshot', () => {
      setupMockIteratorWithRows(viewsIter, [
        getViewRow(),
        getViewRow({node_id: 20n, parent_id: defaultNodeId, hashcode: 67890n}),
      ]);
      const trees = makeHierarchyTrees();
      expect(trees.length).toBe(1);
      expect(trees[0].id).toBe('TestWindowViewNode13 TestClass@12345');

      const child = assertDefined(trees[0].getChildByName('TestClass@67890'));
      expect(child.id).toBe('TestWindowViewNode20 TestClass@67890');
    });

    it('builds hierarchy tree for multiple snapshots', () => {
      setupMockIteratorWithRows(viewsIter, [
        getViewRow(),
        getViewRow({
          snapshot_id: 101n,
          hashcode: 54321n,
        }),
      ]);
      const trees = makeHierarchyTrees();
      expect(trees.length).toBe(2);
      expect(trees[0].id).toBe('TestWindowViewNode13 TestClass@12345');
      expect(trees[1].id).toBe('TestWindowViewNode13 TestClass@54321');
    });

    it('builds trees with rects for multiple snapshots', () => {
      setupMockIteratorWithRows(viewsIter, [
        getViewRow({
          rect_id: 1n,
        }),
        getViewRow({
          snapshot_id: 101n,
          rect_id: 2n,
        }),
      ]);

      const otherRect = new Rect(5, 6, 7, 8);

      const mockTraceRect = jasmine.createSpyObj<TraceRect>('TraceRect', [], {
        x: otherRect.x,
        y: otherRect.y,
        w: otherRect.w,
        h: otherRect.h,
      });

      const snapshotRectsFor101: SnapshotRects = new Map([
        [
          defaultNodeId,
          {primaryRects: [mockTraceRect], secondaryRects: undefined},
        ],
      ]);
      const visibleRects: RectsForTrace = new Map([
        [101n, snapshotRectsFor101],
      ]);

      const trees = makeHierarchyTrees(visibleRects);

      expect(trees.length).toBe(2);

      const rect1 = assertDefined(trees[0].getRects())[0];
      expect(rect1.x).toEqual(defaultRect.x);
      expect(rect1.y).toEqual(defaultRect.y);
      expect(rect1.w).toEqual(defaultRect.w);
      expect(rect1.h).toEqual(defaultRect.h);

      const rect2 = assertDefined(trees[1].getRects())[0];
      expect(rect2.x).toEqual(otherRect.x);
      expect(rect2.y).toEqual(otherRect.y);
      expect(rect2.w).toEqual(otherRect.w);
      expect(rect2.h).toEqual(otherRect.h);
    });

    function getViewRow(overrides: {[key: string]: ColumnType | null} = {}): {
      [key: string]: ColumnType | null;
    } {
      const defaults = {
        snapshot_id: defaultSnapshotId,
        arg_set_id: 2n,
        node_id: defaultNodeId,
        parent_id: BigInt(UINT32_MAX),
        class_name: 'TestClass',
        hashcode: 12345n,
        view_id: 'TestViewId',
        is_visible: 1n,
        rect_id: 1n,
        group_id: 0n,
        depth: 4n,
      };
      return {...defaults, ...overrides};
    }

    function makeHierarchyTrees(
      visibleRects: RectsForTrace = new Map(),
    ): HierarchyTreeNode[] {
      return makeEntryHierarchyTrees(
        viewResult,
        visibleRects,
        traceProcessor,
        mockTraceGeometryData,
        'TestWindow',
      );
    }
  });
});

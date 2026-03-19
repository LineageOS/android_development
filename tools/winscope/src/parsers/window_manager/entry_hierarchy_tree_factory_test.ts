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
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {ColumnType, QueryResult, RowIterator,} from '@trace_processor/query_result';
import {makeSpyQueryResult, makeSpyRowIterator, setupMockIteratorWithRows,} from '@trace_processor/test_utils';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {RectsForTrace, SnapshotRects} from '@tree_node/rect_extractor_result';
import {TraceRect} from '@tree_node/trace_rect';

import {ContainerType} from './container_type';
import {makeEntryHierarchyTrees, makeTreeNodeId, makeTreeNodeName,} from './entry_hierarchy_tree_factory';

describe('EntryHierarchyTreeFactory', () => {
  describe('makeEntryHierarchyTrees', () => {
    const traceProcessor = jasmine.createSpyObj<TraceProcessor>(
      'traceProcessor',
      ['query'],
    );

    const defaultContainerTitle = 'Container1';
    const defaultSnapshotId = 100n;
    const defaultContainerToken = 10n;
    let containersIter: jasmine.SpyObj<RowIterator>;
    let containersResult: jasmine.SpyObj<QueryResult>;
    let mockTraceGeometryData: jasmine.SpyObj<TraceGeometryData>;

    beforeEach(() => {
      containersIter = makeSpyRowIterator();
      containersResult = makeSpyQueryResult(containersIter);
      mockTraceGeometryData = jasmine.createSpyObj<TraceGeometryData>(
        'TraceGeometryData',
        ['getRect', 'getTransform'],
      );
    });

    it('builds hierarchy tree for one snapshot', () => {
      setupMockIteratorWithRows(containersIter, [
        getContainerRow({container_type: ContainerType.DisplayContent}),
        getContainerRow({token: 20n, parent_token: 10n, title: 'Container2'}),
      ]);
      const trees = makeHierarchyTrees();
      expect(trees.length).toBe(1);
      expect(trees[0].id).toBe('WindowManagerState root');

      const displayContent = assertDefined(
        trees[0].getChildByName('Container1'),
      );
      expect(displayContent.id).toBe('DisplayContent a Container1');

      const windowState = assertDefined(
        displayContent.getChildByName('Container2'),
      );
      expect(windowState.id).toBe('WindowState 14 Container2');
    });

    it('builds hierarchy tree for multiple snapshots', () => {
      setupMockIteratorWithRows(containersIter, [
        getContainerRow({container_type: ContainerType.DisplayContent}),
        getContainerRow({
          snapshot_id: 101n,
          container_type: ContainerType.DisplayContent,
          token: 300n,
          focused_display_id: 12n,
        }),
      ]);
      const trees = makeHierarchyTrees();
      expect(trees.length).toBe(2);
      expect(
        trees[0]
          .getEagerPropertyByName('focusedDisplayId')
          ?.getValue()
          ?.toString(),
      ).toEqual('14');
      expect(
        trees[1]
          .getEagerPropertyByName('focusedDisplayId')
          ?.getValue()
          ?.toString(),
      ).toEqual('12');

      const displayContent = assertDefined(
        trees[0].getChildByName('Container1'),
      );
      expect(displayContent.id).toBe('DisplayContent a Container1');

      const displayContent2 = assertDefined(
        trees[1].getChildByName('Container1'),
      );
      expect(displayContent2.id).toBe('DisplayContent 12c Container1');
    });

    it('builds trees with rects for multiple snapshots', () => {
      setupMockIteratorWithRows(containersIter, [
        getContainerRow({
          container_type: ContainerType.DisplayContent,
          rect_id: 1n,
        }),
        getContainerRow({
          snapshot_id: 101n,
          container_type: ContainerType.DisplayContent,
        }),
        getContainerRow({
          snapshot_id: 102n,
          container_type: ContainerType.DisplayContent,
          rect_id: 2n,
        }),
      ]);
      const defaultRect = new Rect(1, 2, 3, 4);
      mockTraceGeometryData.getRect.withArgs(1n).and.returnValue(defaultRect);
      const otherRect = new Rect(5, 6, 7, 8);

      const mockTraceRect = jasmine.createSpyObj<TraceRect>('TraceRect', [], {
        x: otherRect.x,
        y: otherRect.y,
        w: otherRect.w,
        h: otherRect.h,
      });

      const snapshotRectFor102: SnapshotRects = new Map([
        [
          defaultContainerToken,
          {primaryRects: [mockTraceRect], secondaryRects: []},
        ],
      ]);
      const visibleRects: RectsForTrace = new Map([[102n, snapshotRectFor102]]);

      const trees = makeHierarchyTrees(visibleRects);

      expect(trees.length).toBe(3);

      let rects = assertDefined(
        trees[0].getChildByName('Container1')?.getRects(),
      );
      expect(rects.length).toBe(1);
      expect(rects[0].x).toEqual(defaultRect.x);
      expect(rects[0].y).toEqual(defaultRect.y);
      expect(rects[0].w).toEqual(defaultRect.w);
      expect(rects[0].h).toEqual(defaultRect.h);

      expect(
        assertDefined(trees[1].getChildByName('Container1')).getRects(),
      ).toEqual([]);

      rects = assertDefined(trees[2].getChildByName('Container1')?.getRects());
      expect(rects.length).toBe(1);
      expect(rects[0].x).toEqual(otherRect.x);
      expect(rects[0].y).toEqual(otherRect.y);
      expect(rects[0].w).toEqual(otherRect.w);
      expect(rects[0].h).toEqual(otherRect.h);
    });

    function getContainerRow(
      overrides: {[key: string]: ColumnType | null} = {},
    ): {
      [key: string]: ColumnType | null;
    } {
      const defaults = {
        snapshot_id: defaultSnapshotId,
        focused_display_id: 14n,
        snapshot_arg_set_id: 1n,
        arg_set_id: 2n,
        title: defaultContainerTitle,
        name_override: null,
        token: defaultContainerToken,
        parent_token: null,
        container_type: ContainerType.WindowState,
        is_visible: 1n,
        rect_id: null,
        group_id: 0n,
        depth: 4n,
        opacity: 1,
      };
      return {...defaults, ...overrides};
    }

    function makeHierarchyTrees(
      visibleRects: RectsForTrace = new Map(),
    ): HierarchyTreeNode[] {
      return makeEntryHierarchyTrees(
        containersResult,
        visibleRects,
        traceProcessor,
        mockTraceGeometryData,
      );
    }
  });

  describe('makeTreeNodeId', () => {
    let row: jasmine.SpyObj<RowIterator>;

    beforeEach(() => {
      row = makeSpyRowIterator();
      row.get.withArgs('token').and.returnValue(12345n);
    });

    it('uses container type', () => {
      row.get.withArgs('container_type').and.returnValue('TaskFragment');
      expect(makeTreeNodeId(row)).toBe('TaskFragment 3039');
    });

    it('uses "root" if container type not available', () => {
      row.get.withArgs('container_type').and.returnValue(null);
      expect(makeTreeNodeId(row)).toBe('root 3039');
    });
  });

  describe('makeTreeNodeName', () => {
    let row: jasmine.SpyObj<RowIterator>;

    beforeEach(() => {
      row = makeSpyRowIterator();
      row.get.withArgs('title').and.returnValue('Container1');
    });

    it('uses name override', () => {
      row.get.withArgs('name_override').and.returnValue('OtherContainer');
      expect(makeTreeNodeName(row)).toBe('OtherContainer');
    });

    it('uses title if name override not available', () => {
      row.get.withArgs('name_override').and.returnValue(null);
      expect(makeTreeNodeName(row)).toBe('Container1');
    });
  });
});

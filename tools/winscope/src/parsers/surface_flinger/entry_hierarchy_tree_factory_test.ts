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
import {Region} from '@common/geometry/region';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {makeWarningDuplicateLayerIds, makeWarningMissingLayerIds, makeWarningRecursiveLayerIds,} from '@parsers/helpers/warnings';
import {ColumnType, QueryResult, RowIterator,} from '@trace_processor/query_result';
import {makeSpyQueryResult, makeSpyRowIterator, setupMockIteratorWithRows,} from '@trace_processor/test_utils';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {RectsForTrace, SnapshotRects} from '@tree_node/rect_extractor_result';
import {TraceRect} from '@tree_node/trace_rect';
import {TraceRectBuilder} from '@tree_node/trace_rect_builder';

import {makeEntryHierarchyTrees as sfMakeEntryHierarchyTrees} from './entry_hierarchy_tree_factory';
import {RectExtractor} from './rect_extractor';

describe('EntryHierarchyTreeFactory', () => {
  const traceProcessor = jasmine.createSpyObj<TraceProcessor>(
    'traceProcessor',
    ['query'],
  );
  const createEmptyRectsMap = (snapshotId: bigint): RectsForTrace => {
    return new Map([[snapshotId, new Map()]]);
  };

  const layerName1 = 'Layer1';
  const defaultSnapshotId = 100n;
  let layerRectsSpy: jasmine.Spy;
  let snapshotResult: jasmine.SpyObj<QueryResult>;
  let snapshotIter: jasmine.SpyObj<RowIterator>;
  let layersResult: jasmine.SpyObj<QueryResult>;
  let layersIter: jasmine.SpyObj<RowIterator>;
  let mockTraceGeometryData: jasmine.SpyObj<TraceGeometryData>;
  let extractFillRegionRectSpy: jasmine.Spy;

  beforeEach(() => {
    snapshotIter = makeSpyRowIterator();
    snapshotResult = makeSpyQueryResult(snapshotIter);
    let snapshotIterValidCallCount = 0;
    snapshotIter.valid.and.callFake(() => {
      return snapshotIterValidCallCount++ === 0;
    });
    layersIter = makeSpyRowIterator();
    setColumnValuesForLayer();
    layersResult = makeSpyQueryResult(layersIter);
    mockTraceGeometryData = jasmine.createSpyObj<TraceGeometryData>(
      'TraceGeometryData',
      ['getRect', 'getTransform'],
    );
    spyOn(RectExtractor, 'extractDisplayRectsForSnapshot').and.returnValue({
      displayRects: [],
    });
    layerRectsSpy = spyOn(RectExtractor, 'extractLayerRects').and.returnValue(
      undefined,
    );
    extractFillRegionRectSpy = spyOn(RectExtractor, 'extractFillRegionRect');
    let layersIterCallCount = 0;
    layersIter.valid.and.callFake(() => layersIterCallCount === 0);
    layersIter.next.and.callFake(() => {
      layersIterCallCount++;
    });
  });

  describe('rects', () => {
    const spyRect = jasmine.createSpyObj<TraceRect>('rect', [], ['x']);

    beforeEach(() => {
      snapshotIter.get.withArgs('arg_set_id').and.returnValue(1n);
      snapshotIter.get.withArgs('id').and.returnValue(defaultSnapshotId);
    });

    it('sets bounds rect to node', () => {
      layerRectsSpy.and.returnValue({
        primaryRects: [spyRect],
        secondaryRects: undefined,
      });
      const tree = makeEntryHierarchyTree(
        createEmptyRectsMap(defaultSnapshotId),
      );
      const layer = assertDefined(tree.getChildByName(layerName1));
      expect(layer.getRects()).toEqual([spyRect]);
      expect(layer.getSecondaryRects()).toEqual([]);
    });

    it('sets input rect to node', () => {
      const spyRectInput = jasmine.createSpyObj<TraceRect>('rect', [], {
        id: 'inputRect',
        fillRegion: new Region([]),
      });
      layerRectsSpy.and.returnValue({
        primaryRects: [],
        secondaryRects: [spyRectInput],
      });
      const mockLayersIter = setupLayerIterator([
        defaultLayerData({snapshot_id: defaultSnapshotId}),
      ]);
      layersResult.iter.and.returnValue(mockLayersIter);

      const tree = makeEntryHierarchyTree(
        createEmptyRectsMap(defaultSnapshotId),
      );
      const layer = assertDefined(tree.getChildByName(layerName1));
      expect(layer.getRects()).toEqual([]);
      expect(layer.getSecondaryRects()).toEqual([spyRectInput]);
    });

    it('sets both bounds and input rects to node', () => {
      const spyRectInputOther = jasmine.createSpyObj<TraceRect>('rect', [], {
        y: 20,
        fillRegion: new Region([]),
      });
      layerRectsSpy.and.returnValue({
        primaryRects: [spyRect],
        secondaryRects: [spyRectInputOther],
      });
      const mockLayersIter = setupLayerIterator([
        defaultLayerData({snapshot_id: defaultSnapshotId}),
      ]);
      layersResult.iter.and.returnValue(mockLayersIter);

      const tree = makeEntryHierarchyTree(
        createEmptyRectsMap(defaultSnapshotId),
      );
      const layer = assertDefined(tree.getChildByName(layerName1));
      expect(layer.getRects()).toEqual([spyRect]);
      expect(layer.getSecondaryRects()).toEqual([spyRectInputOther]);
    });

    it('adds fill region rects to input rect', () => {
      const layerIdBigint = 10n;
      const currentLayerName = 'TestLayer';

      const rows = [
        defaultLayerData({
          snapshot_id: defaultSnapshotId,
          id: 0n,
          layer_id: layerIdBigint,
          layer_name: currentLayerName,
          fr_id: 0n,
        }),
        defaultLayerData({
          snapshot_id: defaultSnapshotId,
          id: 0n,
          layer_id: layerIdBigint,
          layer_name: currentLayerName,
          fr_id: 1n,
        }),
      ];
      const mockLayersIter = setupLayerIterator(rows);
      layersResult.iter.and.returnValue(mockLayersIter);

      const rect1 = new Rect(1, 2, 3, 4);
      const rect2 = new Rect(2, 4, 6, 8);

      const spyInputRect = new TraceRectBuilder()
        .setX(0)
        .setY(0)
        .setWidth(10)
        .setHeight(10)
        .setId('inputRect')
        .setName('input')
        .setGroupId(0)
        .setIsVisible(true)
        .setIsDisplay(false)
        .setDepth(0)
        .setIsSpy(false)
        .setFillRegion(new Region([rect1]))
        .build();

      layerRectsSpy.and.returnValue({
        primaryRects: [],
        secondaryRects: [spyInputRect],
      });

      extractFillRegionRectSpy.and.returnValue(rect2);

      const tree = makeEntryHierarchyTree(
        createEmptyRectsMap(defaultSnapshotId),
      );
      const layer = assertDefined(tree.getChildByName(currentLayerName));

      const secondaryRects = layer.getSecondaryRects();
      expect(secondaryRects).toBeDefined();
      expect(secondaryRects!.length).toBe(1);
      const outputRect = secondaryRects![0];

      expect(outputRect.fillRegion).toBeDefined();
      const expectedFillRegion = new Region([rect1, rect2]);
      expect(assertDefined(outputRect.fillRegion).rects).toEqual(
        expectedFillRegion.rects,
      );

      expect(extractFillRegionRectSpy).toHaveBeenCalledTimes(1);
      expect(extractFillRegionRectSpy).toHaveBeenCalledWith(
        mockLayersIter,
        mockTraceGeometryData,
      );
    });

    it('sets display rects to root', () => {
      const expectedRects = [spyRect, spyRect];
      const snapshotRect: SnapshotRects = new Map([
        [-1n, {primaryRects: expectedRects, secondaryRects: undefined}],
      ]);
      const visibleRectsResults: RectsForTrace = new Map([
        [defaultSnapshotId, snapshotRect],
      ]);
      const tree = makeEntryHierarchyTree(visibleRectsResults);
      expect(tree.getRects()).toEqual(expectedRects);
    });
  });

  describe('warnings', () => {
    beforeEach(() => {
      snapshotIter.get.withArgs('arg_set_id').and.returnValue(1n);
      snapshotIter.get.withArgs('id').and.returnValue(100n);
    });
    it('handles missing layer ids', () => {
      const rows = [
        defaultLayerData({
          snapshot_id: defaultSnapshotId,
          layer_id: null,
          layer_name: 'LayerWithMissingId',
          id: 0n,
        }),
        defaultLayerData({
          snapshot_id: defaultSnapshotId,
          layer_id: 1n,
          layer_name: layerName1,
          id: 1n,
        }),
      ];
      const mockLayersIter = setupLayerIterator(rows);
      layersResult.iter.and.returnValue(mockLayersIter);

      const tree = makeEntryHierarchyTree(
        createEmptyRectsMap(defaultSnapshotId),
      );

      expect(tree.getAllChildren().length).toBe(1);
      expect(tree.getChildByName('LayerWithMissingId')).toBeUndefined();
      expect(tree.getChildByName(layerName1)).toBeDefined();
      expect(tree.getWarnings()).toEqual([makeWarningMissingLayerIds()]);
    });

    it('handles duplicate layer ids', () => {
      let calls = 0;
      layersIter.next.and.callFake(() => {
        if (calls !== 0) {
          layersIter.valid.and.returnValue(false);
          return;
        }
        calls++;
        layersIter.get.withArgs('id').and.returnValue(1n);
      });

      const tree = makeEntryHierarchyTree(
        createEmptyRectsMap(defaultSnapshotId),
      );
      expect(tree.getAllChildren().length).toBe(2);
      expect(tree.getChildByName(layerName1)).toBeDefined();
      expect(tree.getChildByName(layerName1 + ' duplicate(1)')).toBeDefined();
      expect(tree.getWarnings()).toEqual([makeWarningDuplicateLayerIds([1])]);
    });

    it('handles recursive layer ids', () => {
      layersIter.get.withArgs('parent').and.returnValue(1n);
      let calls = 0;
      layersIter.next.and.callFake(() => {
        if (calls !== 0) {
          layersIter.valid.and.returnValue(false);
          return;
        }
        calls++;
        layersIter.get.withArgs('id').and.returnValue(1n);
        layersIter.get.withArgs('layer_id').and.returnValue(7n);
        layersIter.get.withArgs('parent').and.returnValue(7n);
      });

      const tree = makeEntryHierarchyTree(
        createEmptyRectsMap(defaultSnapshotId),
      );
      const recursiveLayers = tree.getAllChildren()[0].getAllChildren();
      expect(
        recursiveLayers.map((c) =>
          c.getEagerPropertyByName('layerId')?.getValue(),
        ),
      ).toEqual([1n, 7n]);
      expect(
        recursiveLayers.map((c) =>
          c.getEagerPropertyByName('parent')?.getValue(),
        ),
      ).toEqual([1n, 7n]);
      expect(tree.getWarnings()).toEqual([
        makeWarningRecursiveLayerIds([1, 7]),
      ]);
    });
  });

  describe('multiple trees', () => {
    it('generates multiple trees', () => {
      const snapshots = [
        defaultSnapshotData({id: 1n, arg_set_id: 0n}),
        defaultSnapshotData({id: 2n, arg_set_id: 1n, display_id: 1n}),
      ];
      setupMockIteratorWithRows(snapshotIter, snapshots);

      const allLayers = [
        defaultLayerData({
          snapshot_id: 1n,
          layer_id: 11n,
          layer_name: 'Layer-1',
        }),
        defaultLayerData({
          snapshot_id: 2n,
          layer_id: 22n,
          layer_name: 'Layer-2',
        }),
      ];
      const mockLayersIter = setupLayerIterator(allLayers);
      layersResult.iter.and.returnValue(mockLayersIter);

      const visibleRectsResults: RectsForTrace = new Map([
        [1n, new Map()],
        [2n, new Map()],
      ]);

      const trees = makeEntryHierarchyTrees(visibleRectsResults);
      expect(trees.length).toBe(2);
    });
  });

  function setupLayerIterator(
    rows: Array<{[key: string]: ColumnType | null}>,
  ): jasmine.SpyObj<RowIterator> {
    const iter = makeSpyRowIterator();
    setupMockIteratorWithRows(iter, rows);
    return iter;
  }

  function defaultLayerData(
    overrides: {[key: string]: ColumnType | null} = {},
  ): {
    [key: string]: ColumnType | null;
  } {
    const defaults = {
      snapshot_id: 1n,
      id: 0n,
      layer_id: 1n,
      layer_name: layerName1,
      arg_set_id: 2n,
      is_visible: 0n,
      parent: -1n,
      z_order_relative_of: -1n,
      hwc_composition_type: 0,
      is_hidden_by_policy: 0n,
      is_missing_z_parent: 0n,
      fr_id: null,
    };
    return {...defaults, ...overrides};
  }

  function defaultSnapshotData(
    overrides: {[key: string]: ColumnType | null} = {},
  ): {
    [key: string]: ColumnType | null;
  } {
    const defaults = {
      id: 1n,
      arg_set_id: 1n,
      ts: 0n,
      cursor_x: 0,
      cursor_y: 0,
    };
    return {...defaults, ...overrides};
  }

  function setColumnValuesForLayer() {
    layersIter.get.withArgs('snapshot_id').and.returnValue(100n);
    layersIter.get.withArgs('id').and.returnValue(0n);
    layersIter.get.withArgs('layer_id').and.returnValue(1n);
    layersIter.get.withArgs('layer_name').and.returnValue(layerName1);
    layersIter.get.withArgs('arg_set_id').and.returnValue(2n);
    layersIter.get.withArgs('is_visible').and.returnValue(0n);
    layersIter.get.withArgs('parent').and.returnValue(-1n);
    layersIter.get.withArgs('hwc_composition_type').and.returnValue(0n);
    layersIter.get.withArgs('is_hidden_by_policy').and.returnValue(0n);
    layersIter.get.withArgs('z_order_relative_of').and.returnValue(0n);
    layersIter.get.withArgs('is_missing_z_parent').and.returnValue(0n);
    layersIter.get.withArgs('fr_id').and.returnValue(1n);
  }

  function makeEntryHierarchyTree(
    visibleRectsResults?: RectsForTrace,
  ): HierarchyTreeNode {
    const trees = sfMakeEntryHierarchyTrees(
      snapshotResult,
      layersResult,
      visibleRectsResults ?? new Map(),
      traceProcessor,
      mockTraceGeometryData,
    );
    return trees[0];
  }

  function makeEntryHierarchyTrees(
    visibleRectsResults?: RectsForTrace,
  ): HierarchyTreeNode[] {
    return sfMakeEntryHierarchyTrees(
      snapshotResult,
      layersResult,
      visibleRectsResults ?? new Map(),
      traceProcessor,
      mockTraceGeometryData,
    );
  }
});

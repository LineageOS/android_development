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

import {assertDefined} from 'common/assert';
import {Rect} from 'common/geometry/rect';
import {Region} from 'common/geometry/region';
import {
  DuplicateLayerIds,
  MissingLayerIds,
  RecursiveLayerIds,
} from 'messaging/user_warnings';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {QueryResult, RowIterator} from 'trace_processor/query_result';
import {makeSpyRowIterator} from 'trace_processor/test_utils';
import {TraceProcessor} from 'trace_processor/trace_processor';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {TraceRect} from 'tree_node/trace_rect';
import {TraceRectBuilder} from 'tree_node/trace_rect_builder';
import {EntryHierarchyTreeFactory} from './entry_hierarchy_tree_factory';
import {LayerRects, RectExtractor} from './rect_extractor';

describe('EntryHierarchyTreeFactory', () => {
  const factory = new EntryHierarchyTreeFactory();
  const traceProcessor = jasmine.createSpyObj<TraceProcessor>(
    'traceProcessor',
    ['query'],
  );
  const createMapWithoutLayerRects = (snapshotId: bigint) => {
    return new Map([[snapshotId, {displayRects: [], layerRects: new Map()}]]);
  };

  const layerName1 = 'Layer1';
  const defaultSnapshotId = 100n;
  let displaysSpy: jasmine.Spy;
  let layerRectsSpy: jasmine.Spy;
  let snapshotResult: jasmine.SpyObj<QueryResult>;
  let snapshotIter: jasmine.SpyObj<RowIterator>;
  let layersResult: jasmine.SpyObj<QueryResult>;
  let layersIter: jasmine.SpyObj<RowIterator>;
  let mockTraceGeometryData: jasmine.SpyObj<TraceGeometryData>;
  let extractFillRegionRectSpy: jasmine.Spy;

  beforeEach(() => {
    snapshotIter = makeSpyRowIterator();
    snapshotResult = jasmine.createSpyObj<QueryResult>('result', ['iter']);
    snapshotResult.iter.and.returnValue(snapshotIter);
    let snapshotIterValidCallCount = 0;
    snapshotIter.valid.and.callFake(() => {
      return snapshotIterValidCallCount++ === 0;
    });
    layersIter = makeSpyRowIterator();
    setColumnValuesForLayer();
    layersResult = jasmine.createSpyObj<QueryResult>('result', ['iter']);
    layersResult.iter.and.returnValue(layersIter);
    mockTraceGeometryData = jasmine.createSpyObj<TraceGeometryData>(
      'TraceGeometryData',
      ['getRect', 'getTransform'],
    );
    displaysSpy = spyOn(
      RectExtractor,
      'extractDisplayRectsForSnapshot',
    ).and.returnValue({
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
      layerRectsSpy.and.returnValue({bounds: spyRect});
      const tree = makeEntryHierarchyTree(
        createMapWithoutLayerRects(defaultSnapshotId),
      );
      const layer = assertDefined(tree.getChildByName(layerName1));
      expect(layer.getRects()).toEqual([spyRect]);
      expect(layer.getSecondaryRects()).toBeUndefined();
    });

    it('sets input rect to node', () => {
      const spyRectInput = jasmine.createSpyObj<TraceRect>('rect', [], {
        'id': 'inputRect',
        'fillRegion': new Region([]),
      });
      layerRectsSpy.and.returnValue({input: spyRectInput});
      const mockLayersIter = setupLayerIterator([
        defaultLayerData({'snapshot_id': defaultSnapshotId}),
      ]);
      layersResult.iter.and.returnValue(mockLayersIter);

      const tree = makeEntryHierarchyTree(
        createMapWithoutLayerRects(defaultSnapshotId),
      );
      const layer = assertDefined(tree.getChildByName(layerName1));
      expect(layer.getRects()).toBeUndefined();
      expect(layer.getSecondaryRects()).toEqual([spyRectInput]);
    });

    it('sets both bounds and input rects to node', () => {
      const spyRectInputOther = jasmine.createSpyObj<TraceRect>('rect', [], {
        'y': 20,
        'fillRegion': new Region([]),
      });
      layerRectsSpy.and.returnValue({
        bounds: spyRect,
        input: spyRectInputOther,
      });
      const mockLayersIter = setupLayerIterator([
        defaultLayerData({'snapshot_id': defaultSnapshotId}),
      ]);
      layersResult.iter.and.returnValue(mockLayersIter);

      const tree = makeEntryHierarchyTree(
        createMapWithoutLayerRects(defaultSnapshotId),
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
          'snapshot_id': defaultSnapshotId,
          'id': 0n,
          'layer_id': layerIdBigint,
          'layer_name': currentLayerName,
          'fr_id': 0n,
          'fr_x': 1,
          'fr_y': 2,
          'fr_w': 3,
          'fr_h': 4,
        }),
        defaultLayerData({
          'snapshot_id': defaultSnapshotId,
          'id': 0n,
          'layer_id': layerIdBigint,
          'layer_name': currentLayerName,
          'fr_id': 1n,
          'fr_x': 2,
          'fr_y': 4,
          'fr_w': 6,
          'fr_h': 8,
        }),
      ];
      const mockLayersIter = setupLayerIterator(rows);
      layersResult.iter.and.returnValue(mockLayersIter);

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
        .setFillRegion(new Region([]))
        .build();

      layerRectsSpy.and.returnValue({input: spyInputRect});

      const rect1 = new Rect(1, 2, 3, 4);
      const rect2 = new Rect(2, 4, 6, 8);
      extractFillRegionRectSpy.and.returnValues(rect1, rect2);

      const tree = makeEntryHierarchyTree(
        createMapWithoutLayerRects(defaultSnapshotId),
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

      expect(extractFillRegionRectSpy).toHaveBeenCalledTimes(2);
      expect(extractFillRegionRectSpy).toHaveBeenCalledWith(
        mockLayersIter,
        mockTraceGeometryData,
      );
    });

    it('sets display rects to root', () => {
      const expectedRects = [spyRect, spyRect];
      const visibleRectsResults = new Map([
        [
          defaultSnapshotId,
          {displayRects: expectedRects, layerRects: new Map()},
        ],
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
          'snapshot_id': defaultSnapshotId,
          'layer_id': null,
          'layer_name': 'LayerWithMissingId',
          'id': 0n,
        }),
        defaultLayerData({
          'snapshot_id': defaultSnapshotId,
          'layer_id': 1n,
          'layer_name': layerName1,
          'id': 1n,
        }),
      ];
      const mockLayersIter = setupLayerIterator(rows);
      layersResult.iter.and.returnValue(mockLayersIter);

      const tree = makeEntryHierarchyTree(
        createMapWithoutLayerRects(defaultSnapshotId),
      );

      expect(tree.getAllChildren().length).toBe(1);
      expect(tree.getChildByName('LayerWithMissingId')).toBeUndefined();
      expect(tree.getChildByName(layerName1)).toBeDefined();
      expect(tree.getWarnings()).toEqual([new MissingLayerIds()]);
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
        createMapWithoutLayerRects(defaultSnapshotId),
      );
      expect(tree.getAllChildren().length).toBe(2);
      expect(tree.getChildByName(layerName1)).toBeDefined();
      expect(tree.getChildByName(layerName1 + ' duplicate(1)')).toBeDefined();
      expect(tree.getWarnings()).toEqual([new DuplicateLayerIds([1])]);
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
        createMapWithoutLayerRects(defaultSnapshotId),
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
      expect(tree.getWarnings()).toEqual([new RecursiveLayerIds([1, 7])]);
    });
  });

  describe('multiple trees', () => {
    it('generates multiple trees', () => {
      const snapshots = [
        defaultSnapshotData({'id': 1n, 'arg_set_id': 0n}),
        defaultSnapshotData({'id': 2n, 'arg_set_id': 1n, 'display_id': 1n}),
      ];
      setupSnapshotIterator(snapshots);

      const allLayers = [
        defaultLayerData({
          'snapshot_id': 1n,
          'layer_id': 11n,
          'layer_name': 'Layer-1',
        }),
        defaultLayerData({
          'snapshot_id': 2n,
          'layer_id': 22n,
          'layer_name': 'Layer-2',
        }),
      ];
      const mockLayersIter = setupLayerIterator(allLayers);
      layersResult.iter.and.returnValue(mockLayersIter);

      const visibleRectsResults = new Map([
        [1n, {displayRects: [], layerRects: new Map()}],
        [2n, {displayRects: [], layerRects: new Map()}],
      ]);

      const trees = makeEntryHierarchyTrees(visibleRectsResults);
      expect(trees.length).toBe(2);
    });
  });

  function setupSnapshotIterator(rows: Array<{[key: string]: any}>) {
    let currentRow = 0;
    snapshotIter.valid.and.callFake(() => currentRow < rows.length);

    snapshotIter.next.and.callFake(() => {
      currentRow++;
    });

    snapshotIter.get.and.callFake((key: string) => {
      if (currentRow < 0 || currentRow >= rows.length) {
        return undefined;
      }
      return rows[currentRow][key];
    });
  }

  function setupLayerIterator(
    rows: Array<{[key: string]: any}>,
  ): jasmine.SpyObj<RowIterator> {
    const iter = makeSpyRowIterator();
    let currentRow = 0;

    iter.valid.and.callFake(() => currentRow < rows.length);

    iter.next.and.callFake(() => {
      currentRow++;
    });

    iter.get.and.callFake((key: string) => {
      if (currentRow < 0 || currentRow >= rows.length) {
        return undefined;
      }
      const rowData = rows[currentRow];
      return rowData ? rowData[key] : undefined;
    });

    return iter;
  }

  function defaultLayerData(overrides: {[key: string]: any} = {}): {
    [key: string]: any;
  } {
    const defaults = {
      'snapshot_id': 1n,
      'id': 0n,
      'layer_id': 1n,
      'layer_name': layerName1,
      'arg_set_id': 2n,
      'is_visible': 0n,
      'parent': -1n,
      'z_order_relative_of': -1n,
      'hwc_composition_type': 0,
      'is_hidden_by_policy': 0n,
      'is_missing_z_parent': 0n,
      'fr_x': null,
      'fr_y': null,
      'fr_w': null,
      'fr_h': null,
    };
    return {...defaults, ...overrides};
  }

  function defaultSnapshotData(overrides: {[key: string]: any} = {}): {
    [key: string]: any;
  } {
    const defaults = {
      'id': 1n,
      'arg_set_id': 1n,
      'ts': 0n,
      'cursor_x': 0,
      'cursor_y': 0,
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
    layersIter.get.withArgs('fr_x').and.returnValue(1);
    layersIter.get.withArgs('fr_y').and.returnValue(1);
    layersIter.get.withArgs('fr_w').and.returnValue(1);
    layersIter.get.withArgs('fr_h').and.returnValue(1);
  }

  function makeEntryHierarchyTree(
    visibleRectsResults?: Map<
      bigint,
      {displayRects: TraceRect[]; layerRects: Map<bigint, LayerRects>}
    >,
  ): HierarchyTreeNode {
    const trees = factory.makeEntryHierarchyTrees(
      snapshotResult,
      layersResult,
      visibleRectsResults ?? new Map(),
      traceProcessor,
      mockTraceGeometryData,
    );
    return trees[0];
  }

  function makeEntryHierarchyTrees(
    visibleRectsResults?: Map<
      bigint,
      {displayRects: TraceRect[]; layerRects: Map<bigint, LayerRects>}
    >,
  ): HierarchyTreeNode[] {
    return factory.makeEntryHierarchyTrees(
      snapshotResult,
      layersResult,
      visibleRectsResults ?? new Map(),
      traceProcessor,
      mockTraceGeometryData,
    );
  }
});

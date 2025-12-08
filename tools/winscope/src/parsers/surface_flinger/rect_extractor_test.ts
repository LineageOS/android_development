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

import {CornerRadii} from 'common/geometry/corner_radii';
import {Rect} from 'common/geometry/rect';
import {Region} from 'common/geometry/region';
import {TransformMatrix} from 'common/geometry/transform_matrix';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {QueryResult, RowIterator} from 'trace_processor/query_result';
import {makeSpyRowIterator} from 'trace_processor/test_utils';
import {TraceRect} from 'tree_node/trace_rect';
import {TraceRectBuilder} from 'tree_node/trace_rect_builder';
import {RectExtractor} from './rect_extractor';

describe('SurfaceFlinger RectExtractor', () => {
  const expectedMatrix = TransformMatrix.from({
    dsdx: 1,
    dtdx: 2,
    tx: 3,
    dtdy: 4,
    dsdy: 5,
    ty: 6,
  });
  const rectId1 = 'RectId1';
  const rectName1 = 'RectName1';

  const boundsRectGeom = new Rect(1, 1, 200, 400);
  const inputRectGeom = new Rect(2, 2, 400, 200);
  const displayRectGeom = new Rect(0, 0, 1000, 2000);
  const fillRegionGeom = new Rect(1, 2, 3, 4);

  let mockTraceGeometryData: jasmine.SpyObj<TraceGeometryData>;

  beforeEach(() => {
    mockTraceGeometryData = jasmine.createSpyObj<TraceGeometryData>(
      'TraceGeometryData',
      ['getRect', 'getTransform'],
    );
  });

  describe('extractAllRects', () => {
    const snapshotId = 100n;

    let snapshotResult: jasmine.SpyObj<QueryResult>;
    let rectsResult: jasmine.SpyObj<QueryResult>;
    let snapshotIter: jasmine.SpyObj<RowIterator>;
    let rectsIter: jasmine.SpyObj<RowIterator>;
    let extractDisplayRectsSpy: jasmine.Spy;
    let extractLayerInputRectsSpy: jasmine.Spy;

    beforeEach(() => {
      snapshotIter = makeSpyRowIterator();
      snapshotResult = jasmine.createSpyObj<QueryResult>('snapshotResult', [
        'iter',
      ]);
      snapshotResult.iter.and.returnValue(snapshotIter);
      rectsIter = makeSpyRowIterator();
      rectsResult = jasmine.createSpyObj<QueryResult>('rectsResult', ['iter']);
      rectsResult.iter.and.returnValue(rectsIter);
      let snapshotValidCalls = 0;
      snapshotIter.valid.and.callFake(() => snapshotValidCalls === 0);
      snapshotIter.get.and.callFake((key: string) => {
        if (key === 'id') return snapshotId;
        return null;
      });
      snapshotIter.next.and.callFake(() => {
        snapshotValidCalls++;
      });
      extractDisplayRectsSpy = spyOn(
        RectExtractor,
        'extractDisplayRectsForSnapshot',
      );
      extractLayerInputRectsSpy = spyOn(
        RectExtractor,
        'extractLayerRectsForSnapshot',
      );
      extractDisplayRectsSpy.and.callFake(
        (iter: RowIterator, currentId: bigint) => {
          if (iter.valid() && iter.get('id') === currentId) {
            iter.next();
          }
          return {
            displayRects: [],
            nextSnapshotId: undefined,
          };
        },
      );

      extractLayerInputRectsSpy.and.returnValue({
        rects: [],
      });
      mockTraceGeometryData.getRect
        .withArgs(1n)
        .and.returnValue(displayRectGeom);
      mockTraceGeometryData.getRect
        .withArgs(2n)
        .and.returnValue(displayRectGeom);
    });

    it('extracts 1 display rect for 1 snapshot id', () => {
      const displayRect = makeMinimalDisplayRect('display1', 1n);
      checkExtractedMap([displayRect], new Map(), snapshotId);
    });

    it('extracts 2 display rects for 1 snapshot id', () => {
      const displayRect1 = makeMinimalDisplayRect('display1', 1n);
      const displayRect2 = makeMinimalDisplayRect('display2', 1n);
      checkExtractedMap([displayRect1, displayRect2], new Map(), snapshotId);
    });

    it('extracts 1 input rect for 1 snapshot id', () => {
      const layerRects = new Map<bigint, any>();
      layerRects.set(1n, {input: makeExpectedInputRect()});
      checkExtractedMap([], layerRects, snapshotId);
    });

    it('extracts 2 input rects for 1 snapshot id', () => {
      const layerRects = new Map<bigint, any>();
      layerRects.set(1n, {input: makeExpectedInputRect()});
      layerRects.set(2n, {input: makeExpectedInputRect()});
      checkExtractedMap([], layerRects, snapshotId);
    });

    it('extracts 1 layer rect for 1 snapshot id', () => {
      const layerRects = new Map<bigint, any>();
      layerRects.set(1n, {bounds: makeMinimalLayerRect('layer1')});
      checkExtractedMap([], layerRects, snapshotId);
    });

    it('extracts 2 layer rects for 1 snapshot id', () => {
      const layerRects = new Map<bigint, any>();
      layerRects.set(1n, {bounds: makeMinimalLayerRect('layer1')});
      layerRects.set(2n, {bounds: makeMinimalLayerRect('layer2')});
      checkExtractedMap([], layerRects, snapshotId);
    });

    it('extracts 1 display rect and 1 layer rect and 1 input rect for 1 snapshot id', () => {
      const displayRect = makeMinimalDisplayRect('display1', 1n);
      const layerRects = new Map<bigint, any>();
      layerRects.set(1n, {
        bounds: makeMinimalLayerRect('layer1_bounds'),
        input: makeExpectedInputRect(),
      });
      checkExtractedMap([displayRect], layerRects, snapshotId);
    });

    it('extracts 1 display rect and 1 layer rect and 1 input rect for multiple snapshot ids', () => {
      const snapshotId1 = 100n;
      const snapshotId2 = 200n;

      const displayRows = [
        {id: snapshotId1, name: 'display1'},
        {id: snapshotId2, name: 'display2'},
      ];
      let displayIndex = 0;
      snapshotIter.valid.and.callFake(() => displayIndex < displayRows.length);
      snapshotIter.get.and.callFake(
        (key: string) => (displayRows[displayIndex] as any)?.[key],
      );
      snapshotIter.next.and.callFake(() => {
        displayIndex++;
      });

      const layerRows = [
        {snapshot_id: snapshotId1, name: 'layer1', layer_id: 1n},
        {snapshot_id: snapshotId2, name: 'layer2', layer_id: 2n},
      ];
      let layerIndex = 0;
      rectsIter.valid.and.callFake(() => layerIndex < layerRows.length);
      rectsIter.get.and.callFake(
        (key: string) => (layerRows[layerIndex] as any)?.[key],
      );
      rectsIter.next.and.callFake(() => {
        layerIndex++;
      });

      const displayRect1 = makeMinimalDisplayRect('display1', 1n);
      const displayRect2 = makeMinimalDisplayRect('display2', 2n);
      extractDisplayRectsSpy.and.callFake(
        (iter: jasmine.SpyObj<RowIterator>, currentId: bigint) => {
          const displayRects: TraceRect[] = [];
          while (iter.valid() && iter.get('id') === currentId) {
            if (currentId === snapshotId1) displayRects.push(displayRect1);
            if (currentId === snapshotId2) displayRects.push(displayRect2);
            iter.next();
          }
          return {displayRects};
        },
      );

      const layerRects1 = new Map<bigint, any>();
      layerRects1.set(1n, {bounds: makeMinimalLayerRect('layer1')});
      const layerRects2 = new Map<bigint, any>();
      layerRects2.set(2n, {bounds: makeMinimalLayerRect('layer2')});

      extractLayerInputRectsSpy.and.callFake(
        (iter: jasmine.SpyObj<RowIterator>, currentId: bigint) => {
          const rects = new Map<bigint, any>();
          while (iter.valid() && iter.get('snapshot_id') === currentId) {
            const layerId = iter.get('layer_id') as bigint;
            if (currentId === snapshotId1) {
              rects.set(layerId, {bounds: makeMinimalLayerRect('layer1')});
            }
            if (currentId === snapshotId2) {
              rects.set(layerId, {bounds: makeMinimalLayerRect('layer2')});
            }
            iter.next();
          }
          return {rects};
        },
      );

      const result = RectExtractor.extractAllVisibleAndDisplayRects(
        snapshotResult,
        rectsResult,
        mockTraceGeometryData,
      );

      const expectedMap = new Map();
      expectedMap.set(snapshotId1, {
        displayRects: [displayRect1],
        layerRects: layerRects1,
      });
      expectedMap.set(snapshotId2, {
        displayRects: [displayRect2],
        layerRects: layerRects2,
      });

      expect(result).toEqual(expectedMap);
    });

    function checkExtractedMap(
      displayRects: TraceRect[],
      layerRects: Map<bigint, any>,
      expectedSnapshotId: bigint,
      nextDisplaySnapshotId: bigint | undefined = undefined,
      nextLayerSnapshotId: bigint | undefined = undefined,
    ) {
      extractDisplayRectsSpy.and.callFake(
        (iter: RowIterator, currentId: bigint) => {
          iter.next();
          return {
            displayRects,
            nextSnapshotId: nextDisplaySnapshotId,
          };
        },
      );

      extractLayerInputRectsSpy.and.callFake(() => {
        return {
          rects: layerRects,
          nextSnapshotId: nextLayerSnapshotId,
        };
      });

      const result = RectExtractor.extractAllVisibleAndDisplayRects(
        snapshotResult,
        rectsResult,
        mockTraceGeometryData,
      );

      const expectedMap = new Map();
      expectedMap.set(expectedSnapshotId, {
        displayRects,
        layerRects,
      });
      expect(result).toEqual(expectedMap);
    }
  });

  describe('extractLayerRectsForSnapshot', () => {
    let layersIter: jasmine.SpyObj<RowIterator>;
    let extractLayerRectsSpy: jasmine.Spy;

    const currSnapshotId = 100n;

    beforeEach(() => {
      layersIter = makeSpyRowIterator();
      extractLayerRectsSpy = spyOn(RectExtractor, 'extractLayerRects');
    });

    it('extracts 1 input layer rect for 1 snapshot id', () => {
      const mockInputRect = makeExpectedInputRect();
      setupMockLayerIterator([layerInputRow()]);

      extractLayerRectsSpy.and.returnValue({input: mockInputRect});

      const {rects} = RectExtractor.extractLayerRectsForSnapshot(
        layersIter,
        currSnapshotId,
        mockTraceGeometryData,
      );

      const expectedMap = new Map();
      expectedMap.set(1n, {input: mockInputRect});

      expect(rects).toEqual(expectedMap);
      expect(extractLayerRectsSpy).toHaveBeenCalledTimes(1);
      expect(layersIter.next).toHaveBeenCalledTimes(1);
      expect(layersIter.valid).toHaveBeenCalledTimes(2);
    });

    it('extracts 2 input layer rects for 1 snapshot id', () => {
      const mockInputRect1 = makeExpectedInputRect();
      const mockInputRect2 = makeExpectedInputRect();
      const layerInputRow2 = layerInputRow({
        'layer_id': 2n,
        'id': 2n,
        'layer_name': 'Layer2',
        'input_group_id': 5n,
      });

      setupMockLayerIterator([layerInputRow(), layerInputRow2]);

      extractLayerRectsSpy.and.returnValues(
        {input: mockInputRect1},
        {input: mockInputRect2},
      );

      const {rects} = RectExtractor.extractLayerRectsForSnapshot(
        layersIter,
        currSnapshotId,
        mockTraceGeometryData,
      );

      const expectedMap = new Map();
      expectedMap.set(1n, {input: mockInputRect1});
      expectedMap.set(2n, {input: mockInputRect2});

      expect(rects).toEqual(expectedMap);
      expect(extractLayerRectsSpy).toHaveBeenCalledTimes(2);
    });

    it('extracts 1 bounds layer rect', () => {
      const mockBoundsRect = makeExpectedLayerRect();
      setupMockLayerIterator([layerBoundsRow()]);
      extractLayerRectsSpy.and.returnValue({
        bounds: mockBoundsRect,
      });

      const {rects} = RectExtractor.extractLayerRectsForSnapshot(
        layersIter,
        currSnapshotId,
        mockTraceGeometryData,
      );

      const expectedMap = new Map();
      expectedMap.set(1n, {
        bounds: mockBoundsRect,
      });
      expect(rects).toEqual(expectedMap);
      expect(extractLayerRectsSpy).toHaveBeenCalledTimes(1);
    });

    it('extracts 2 bounds layer rects for different layers', () => {
      const mockBoundsRect1 = makeExpectedLayerRect('1', 'Layer1');
      const mockBoundsRect2 = makeExpectedLayerRect('2', 'Layer2');
      setupMockLayerIterator([
        layerBoundsRow({
          layer_id: 1n,
          id: 1n,
          layer_name: 'Layer1',
        }),
        layerBoundsRow({
          layer_id: 2n,
          id: 2n,
          layer_name: 'Layer2',
        }),
      ]);
      extractLayerRectsSpy.and.returnValues(
        {
          bounds: mockBoundsRect1,
        },
        {
          bounds: mockBoundsRect2,
        },
      );

      const {rects} = RectExtractor.extractLayerRectsForSnapshot(
        layersIter,
        currSnapshotId,
        mockTraceGeometryData,
      );

      const expectedMap = new Map();
      expectedMap.set(1n, {
        bounds: mockBoundsRect1,
      });
      expectedMap.set(2n, {
        bounds: mockBoundsRect2,
      });
      expect(rects).toEqual(expectedMap);
      expect(extractLayerRectsSpy).toHaveBeenCalledTimes(2);
    });

    it('extracts combined bounds and input rect for a single layer', () => {
      const mockBounds = makeExpectedLayerRect();
      const mockInput = makeExpectedInputRect();
      setupMockLayerIterator([layerCombinedRow()]);
      extractLayerRectsSpy.and.returnValue({
        bounds: mockBounds,
        input: mockInput,
      });

      const {rects} = RectExtractor.extractLayerRectsForSnapshot(
        layersIter,
        currSnapshotId,
        mockTraceGeometryData,
      );

      const expectedMap = new Map();
      expectedMap.set(1n, {
        bounds: mockBounds,
        input: mockInput,
      });
      expect(rects).toEqual(expectedMap);
      expect(extractLayerRectsSpy).toHaveBeenCalledTimes(1);
    });

    it('merges fill region for the same layer id and unique row id', () => {
      const initialInputRect = makeExpectedInputRect([new Rect(1, 1, 1, 1)]);
      const mockRects = {
        input: initialInputRect,
      };

      const row1 = layerInputRow({
        fr_x: 1,
        fr_y: 1,
        fr_w: 1,
        fr_h: 1,
      });
      const row2 = layerInputRow({
        fr_x: 2,
        fr_y: 2,
        fr_w: 2,
        fr_h: 2,
      });

      setupMockLayerIterator([row1, row2]);

      extractLayerRectsSpy.and.returnValue(mockRects);
      const extractFillRegionRectSpy = spyOn(
        RectExtractor,
        'extractFillRegionRect',
      );
      extractFillRegionRectSpy.and.returnValue(new Rect(2, 2, 2, 2));

      const {rects} = RectExtractor.extractLayerRectsForSnapshot(
        layersIter,
        currSnapshotId,
        mockTraceGeometryData,
      );

      expect(extractLayerRectsSpy).toHaveBeenCalledTimes(1);
      expect(extractFillRegionRectSpy).toHaveBeenCalledTimes(1);

      const layerEntry = rects.get(1n);
      expect(layerEntry?.input?.fillRegion?.rects).toEqual([
        new Rect(1, 1, 1, 1),
        new Rect(2, 2, 2, 2),
      ]);
    });

    function setupMockLayerIterator(rows: Array<{[key: string]: any}>) {
      let currentRow = 0;
      layersIter.valid.and.callFake(() => currentRow < rows.length);
      layersIter.next.and.callFake(() => {
        currentRow++;
      });
      layersIter.get.and.callFake((key: string) => {
        if (currentRow >= rows.length) {
          return undefined;
        }
        return rows[currentRow][key];
      });
    }

    function layerInputRow(overrides: {[key: string]: any} = {}): {
      [key: string]: any;
    } {
      const defaults = {
        'snapshot_id': currSnapshotId,
        'layer_id': 1n,
        'id': 1n,
        'layer_name': 'LayerName',
        'input_x': 2,
        'input_y': 2,
        'input_w': 400,
        'input_h': 200,
        'input_is_visible': 0n,
        'input_group_id': 4n,
        'input_depth': 3n,
        'fr_x': null,
        'group_id': null,
      };
      return {...defaults, ...overrides};
    }

    function layerBoundsRow(
      overrides: {
        [key: string]: any;
      } = {},
    ): {
      [key: string]: any;
    } {
      const defaults = {
        'snapshot_id': currSnapshotId,
        'layer_id': 1n,
        'id': 1n,
        'layer_name': 'LayerName',
        'x': 1,
        'y': 1,
        'w': 100,
        'h': 100,
        'is_visible': 1n,
        'group_id': 3n,
        'depth': 5n,
        'input_group_id': null,
        'fr_x': null,
        'rect_id': 1n,
        'transform_id': 1n,
      };
      return {...defaults, ...overrides};
    }

    function layerCombinedRow(
      overrides: {
        [key: string]: any;
      } = {},
    ): {
      [key: string]: any;
    } {
      const defaults = {
        'snapshot_id': currSnapshotId,
        'layer_id': 1n,
        'id': 1n,
        'layer_name': 'LayerName',
        'x': 1,
        'y': 1,
        'w': 100,
        'h': 100,
        'is_visible': 1n,
        'group_id': 3n,
        'depth': 5n,
        'input_x': 2,
        'input_y': 2,
        'input_w': 400,
        'input_h': 200,
        'input_is_visible': 0n,
        'input_group_id': 4n,
        'input_depth': 3n,
        'fr_x': null,
      };
      return {...defaults, ...overrides};
    }
  });

  describe('extractLayerRects', () => {
    let layersIter: jasmine.SpyObj<RowIterator>;
    const boundsRectId = 100n;
    const inputRectId = 101n;
    const fillRegionId = 1n;
    const transformId = 102n;

    beforeEach(() => {
      layersIter = makeSpyRowIterator();
      mockTraceGeometryData.getRect.and.returnValue(undefined);
      mockTraceGeometryData.getRect
        .withArgs(boundsRectId)
        .and.returnValue(boundsRectGeom);
      mockTraceGeometryData.getRect
        .withArgs(inputRectId)
        .and.returnValue(inputRectGeom);
      mockTraceGeometryData.getRect
        .withArgs(fillRegionId)
        .and.returnValue(fillRegionGeom);

      mockTraceGeometryData.getTransform.and.returnValue(expectedMatrix);
      mockTraceGeometryData.getTransform
        .withArgs(transformId)
        .and.returnValue(expectedMatrix);

      let iterated = false;
      layersIter.valid.and.callFake(() => !iterated);
      layersIter.next.and.callFake(() => {
        iterated = true;
      });
    });

    it('extracts bounds rect with corner radius and opacity', () => {
      setColumnValuesForLayerRect();
      const expectedRect = makeExpectedLayerRect();
      checkLayerRectsExtracted(expectedRect);
    });

    it('does not set bounds rect if null group_id', () => {
      setColumnValuesForLayerRect();
      layersIter.get.withArgs('group_id').and.returnValue(null);
      checkLayerRectsExtracted();
    });

    it('extracts input rect with is_spy', () => {
      setColumnValuesForInputRect();
      const expectedRect = makeExpectedInputRect();
      checkLayerRectsExtracted(undefined, expectedRect);
    });

    it('adds fill region rects to input rect', () => {
      setColumnValuesForInputRect();
      layersIter.get.withArgs('fr_id').and.returnValue(1n);
      layersIter.get.withArgs('fr_x').and.returnValue(1);
      layersIter.get.withArgs('fr_y').and.returnValue(2);
      layersIter.get.withArgs('fr_w').and.returnValue(3);
      layersIter.get.withArgs('fr_h').and.returnValue(4);
      const expectedRect = makeExpectedInputRect([new Rect(1, 2, 3, 4)]);
      checkLayerRectsExtracted(undefined, expectedRect);
    });

    it('does not set input rect if null group_id', () => {
      setColumnValuesForInputRect();
      layersIter.get.withArgs('input_group_id').and.returnValue(null);
      checkLayerRectsExtracted();
    });

    it('extracts both input rect and bounds rect', () => {
      setColumnValuesForLayerRect(false);
      setColumnValuesForInputRect(false);
      const expectedBoundRect = makeExpectedLayerRect();
      const expectedInputRect = makeExpectedInputRect();
      checkLayerRectsExtracted(expectedBoundRect, expectedInputRect);
    });

    function setColumnValuesForLayerRect(noInputRect = true) {
      setCommonColumnValuesForLayer();
      layersIter.get.withArgs('rect_id').and.returnValue(BigInt(boundsRectId));
      layersIter.get
        .withArgs('transform_id')
        .and.returnValue(BigInt(transformId));
      layersIter.get.withArgs('x').and.returnValue(1);
      layersIter.get.withArgs('y').and.returnValue(1);
      layersIter.get.withArgs('w').and.returnValue(200);
      layersIter.get.withArgs('h').and.returnValue(400);
      layersIter.get.withArgs('is_visible').and.returnValue(1n);
      layersIter.get.withArgs('group_id').and.returnValue(3n);
      layersIter.get.withArgs('depth').and.returnValue(5n);
      layersIter.get.withArgs('fr_id').and.returnValue(null);
      if (noInputRect) {
        layersIter.get.withArgs('input_group_id').and.returnValue(null);
        layersIter.get.withArgs('input_trace_rect_id').and.returnValue(null);
        layersIter.get.withArgs('input_transform_id').and.returnValue(null);
      }
    }

    function setColumnValuesForInputRect(noLayerRect = true) {
      setCommonColumnValuesForLayer();
      layersIter.get.withArgs('input_trace_rect_id').and.returnValue(101n);
      layersIter.get.withArgs('input_x').and.returnValue(2);
      layersIter.get.withArgs('input_y').and.returnValue(2);
      layersIter.get.withArgs('input_w').and.returnValue(400);
      layersIter.get.withArgs('input_h').and.returnValue(200);
      layersIter.get.withArgs('input_is_visible').and.returnValue(0n);
      layersIter.get.withArgs('input_group_id').and.returnValue(4n);
      layersIter.get.withArgs('input_depth').and.returnValue(3n);
      layersIter.get.withArgs('fr_id').and.returnValue(null);
      layersIter.get.withArgs('input_transform_id').and.returnValue(101n);
      if (noLayerRect) {
        layersIter.get.withArgs('group_id').and.returnValue(null);
        layersIter.get.withArgs('rect_id').and.returnValue(null);
        layersIter.get.withArgs('transform_id').and.returnValue(null);
      }
    }

    function setCommonColumnValuesForLayer() {
      layersIter.get.withArgs('layer_id').and.returnValue(1n);
      layersIter.get.withArgs('opacity').and.returnValue(0.5);
      layersIter.get.withArgs('is_spy').and.returnValue(1n);
      layersIter.get.withArgs('corner_radius_tl').and.returnValue(0.25);
      layersIter.get.withArgs('corner_radius_tr').and.returnValue(null);
      layersIter.get.withArgs('corner_radius_bl').and.returnValue(0.5);
      layersIter.get.withArgs('corner_radius_br').and.returnValue(null);
      layersIter.get.withArgs('dsdx').and.returnValue(1);
      layersIter.get.withArgs('dtdx').and.returnValue(2);
      layersIter.get.withArgs('tx').and.returnValue(3);
      layersIter.get.withArgs('dtdy').and.returnValue(4);
      layersIter.get.withArgs('dsdy').and.returnValue(5);
      layersIter.get.withArgs('ty').and.returnValue(6);
      layersIter.get.withArgs('fr_id').and.returnValue(null);
      layersIter.get.withArgs('fr_x').and.returnValue(null);
      layersIter.get.withArgs('fr_y').and.returnValue(null);
      layersIter.get.withArgs('fr_w').and.returnValue(null);
      layersIter.get.withArgs('fr_h').and.returnValue(null);
    }

    function checkLayerRectsExtracted(
      expectedBoundsRect?: TraceRect,
      expectedInputRect?: TraceRect,
    ) {
      const rects = RectExtractor.extractLayerRects(
        layersIter,
        rectId1,
        rectName1,
        mockTraceGeometryData,
      );
      if (!expectedBoundsRect && !expectedInputRect) {
        expect(rects).toBeUndefined();
      } else {
        expect(rects?.bounds).toEqual(expectedBoundsRect);
        expect(rects?.input).toEqual(expectedInputRect);
      }
    }
  });

  describe('extractFillRegionRect', () => {
    let fillRegionIter: jasmine.SpyObj<RowIterator>;

    beforeEach(() => {
      fillRegionIter = makeSpyRowIterator();
      mockTraceGeometryData.getRect
        .withArgs(1n)
        .and.returnValue(new Rect(1, 2, 3, 4));
    });

    it('extracts fill region rect', () => {
      fillRegionIter.get.withArgs('fr_id').and.returnValue(1n);
      fillRegionIter.get.withArgs('fr_x').and.returnValue(1);
      fillRegionIter.get.withArgs('fr_y').and.returnValue(2);
      fillRegionIter.get.withArgs('fr_w').and.returnValue(3);
      fillRegionIter.get.withArgs('fr_h').and.returnValue(4);
      const fillRegionRect = RectExtractor.extractFillRegionRect(
        fillRegionIter,
        mockTraceGeometryData,
      );
      expect(fillRegionRect).toEqual(new Rect(1, 2, 3, 4));
    });

    it('robust to row without fill region rect', () => {
      const fillRegionRect = RectExtractor.extractFillRegionRect(
        fillRegionIter,
        mockTraceGeometryData,
      );
      expect(fillRegionRect).toBeUndefined();
    });
  });

  describe('extractDisplayRects', () => {
    let snapshotResult: jasmine.SpyObj<QueryResult>;
    let snapshotIter: jasmine.SpyObj<RowIterator>;

    beforeEach(() => {
      snapshotIter = makeSpyRowIterator();
      snapshotResult = jasmine.createSpyObj<QueryResult>('result', ['iter']);
      snapshotResult.iter.and.returnValue(snapshotIter);
      mockTraceGeometryData.getRect.and.returnValue(new Rect(0, 0, 1000, 2000));
      mockTraceGeometryData.getTransform.and.returnValue(expectedMatrix);
      mockTraceGeometryData.getRect
        .withArgs(123n)
        .and.returnValue(displayRectGeom);
      mockTraceGeometryData.getRect
        .withArgs(654n)
        .and.returnValue(new Rect(1000, 0, 800, 1800));
    });

    it('skips display with null id', () => {
      snapshotIteratorMock([{'display_id': null, 'id': 1n}]);
      checkDisplaysExtracted([]);
    });

    it('extracts display rect with isActiveDisplay not set', () => {
      snapshotIteratorMock([defaultDisplayRow()]);
      const expectedRect = makeExpectedDisplayRect();
      checkDisplaysExtracted([expectedRect]);
    });

    it('extracts display rect with isActiveDisplay set', () => {
      snapshotIteratorMock([defaultDisplayRow({'is_on': true})]);
      const expectedRect = makeExpectedDisplayRect(undefined, true);
      checkDisplaysExtracted([expectedRect]);
    });

    it('extracts display rect with unknown name', () => {
      snapshotIteratorMock([defaultDisplayRow({'display_name': null})]);
      const expectedRect = makeExpectedDisplayRect('Unknown Display');
      checkDisplaysExtracted([expectedRect]);
    });

    it('extracts 2 displays for same snapshot id', () => {
      const display1Values = defaultDisplayRow();
      const display2Values = {
        'display_id': 456n,
        'display_name': 'Display 456',
        'is_on': 1n,
        'is_virtual': 0n,
        'rect_id': 2n,
        'transform_id': 2n,
        'x': 1000,
        'y': 0,
        'w': 800,
        'h': 1800,
        'group_id': 654n,
        'depth': 2n,
        'id': 1n,
      };
      snapshotIteratorMock([display1Values, display2Values]);

      const expectedRect1 = makeExpectedDisplayRect('Display 123', false);
      const expectedRect2 = new TraceRectBuilder()
        .setX(0)
        .setY(0)
        .setWidth(1000)
        .setHeight(2000)
        .setId('Display - 456')
        .setName('Display 456')
        .setTransform(TransformMatrix.IDENTITY)
        .setGroupId(654)
        .setIsVisible(false)
        .setIsDisplay(true)
        .setIsActiveDisplay(true)
        .setDepth(2)
        .setIsSpy(false)
        .build();

      checkDisplaysExtracted([expectedRect1, expectedRect2]);
    });

    it('stops processing when snapshotId changes', () => {
      snapshotIteratorMock([
        defaultDisplayRow({
          'id': 1n,
          'display_id': 111n,
          'display_name': 'Display 111',
        }),
        defaultDisplayRow({
          'id': 1n,
          'display_id': 222n,
          'display_name': 'Display 222',
        }),
        defaultDisplayRow({
          'id': 2n,
          'display_id': 333n,
          'display_name': 'Display 333',
        }),
      ]);
      const expectedRect1 = makeExpectedDisplayRect('Display 111', false, 111n);
      const expectedRect2 = makeExpectedDisplayRect('Display 222', false, 222n);
      checkDisplaysExtracted([expectedRect1, expectedRect2]);
    });

    it('handles no rows matching targetSnapshotId', () => {
      snapshotIteratorMock([
        defaultDisplayRow({'id': 2n}),
        defaultDisplayRow({'id': 3n}),
      ]);
      checkDisplaysExtracted([]);
    });

    function snapshotIteratorMock(rows: Array<{[key: string]: any}>) {
      let currentRow = 0;
      snapshotIter.valid.and.callFake(() => currentRow < rows.length);
      snapshotIter.next.and.callFake(() => {
        currentRow++;
      });
      snapshotIter.get.and.callFake((key: string) => {
        if (currentRow >= rows.length) {
          return undefined;
        }
        return rows[currentRow][key];
      });
    }

    function defaultDisplayRow(overrides: {[key: string]: any} = {}): {
      [key: string]: any;
    } {
      const defaults = {
        'display_id': 123n,
        'display_name': 'Display 123',
        'is_on': false,
        'is_virtual': 0n,
        'rect_id': 1n,
        'transform_id': 1n,
        'x': 0,
        'y': 0,
        'w': 1000,
        'h': 2000,
        'group_id': 321n,
        'depth': 1n,
        'id': 1n,
      };
      return {...defaults, ...overrides};
    }

    function checkDisplaysExtracted(expected: TraceRect[]) {
      const {displayRects} = RectExtractor.extractDisplayRectsForSnapshot(
        snapshotResult.iter({}),
        1n,
        mockTraceGeometryData,
      );
      expect(displayRects).toEqual(expected);
    }
  });

  function makeExpectedDisplayRect(
    name = 'Display 123',
    isActive = false,
    displayId = 123n,
  ): TraceRect {
    return new TraceRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1000)
      .setHeight(2000)
      .setId(`Display - ${displayId}`)
      .setName(name)
      .setTransform(TransformMatrix.IDENTITY)
      .setGroupId(321)
      .setIsVisible(false)
      .setIsDisplay(true)
      .setIsActiveDisplay(isActive)
      .setDepth(1)
      .setIsSpy(false)
      .build();
  }

  function makeExpectedLayerRect(id = rectId1, name = rectName1): TraceRect {
    return new TraceRectBuilder()
      .setX(1)
      .setY(1)
      .setWidth(200)
      .setHeight(400)
      .setId(id)
      .setName(name)
      .setCornerRadii(new CornerRadii(0.25, 0, 0.5, 0))
      .setTransform(expectedMatrix)
      .setGroupId(3)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setDepth(5)
      .setIsSpy(false)
      .setOpacity(0.5)
      .build();
  }

  function makeExpectedInputRect(fillRegion?: Rect[]): TraceRect {
    const builder = new TraceRectBuilder()
      .setX(2)
      .setY(2)
      .setWidth(400)
      .setHeight(200)
      .setId(rectId1)
      .setName(rectName1)
      .setTransform(expectedMatrix)
      .setGroupId(4)
      .setIsVisible(false)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setDepth(3)
      .setIsSpy(true);
    if (fillRegion) {
      builder.setFillRegion(new Region(fillRegion));
    }
    return builder.build();
  }

  function makeMinimalDisplayRect(name: string, displayId: bigint): TraceRect {
    return makeExpectedDisplayRect(name, false, displayId);
  }

  function makeMinimalLayerRect(id: string): TraceRect {
    return makeExpectedLayerRect(id, id);
  }
});

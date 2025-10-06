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

import {TraceEntryValueBuilder} from './trace_entry_value_builder';
import {QueryResult} from 'trace_processor/query_result';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {SnapshotRects} from 'parsers/surface_flinger/rect_extractor';
import {EntryHierarchyTreeFactory} from 'parsers/surface_flinger/entry_hierarchy_tree_factory';
import {TraceType} from 'trace_api/trace_type';

describe('TraceEntryValueBuilder', async () => {
  const mockQueryResult: QueryResult = {} as QueryResult;
  const mockTraceGeometryData: TraceGeometryData = {} as TraceGeometryData;
  const mockRectsMap: Map<bigint, SnapshotRects> = new Map<
    bigint,
    SnapshotRects
  >();

  let traceEntryValueBuilder: TraceEntryValueBuilder;
  let makeEntryHierarchyTreesSpy: jasmine.Spy;

  beforeAll(() => {
    makeEntryHierarchyTreesSpy = spyOn(
      EntryHierarchyTreeFactory,
      'makeEntryHierarchyTrees',
    );
  });
  beforeEach(() => {
    traceEntryValueBuilder = new TraceEntryValueBuilder();
  });

  it('sets the trace type', () => {
    expect(() =>
      traceEntryValueBuilder.setType(TraceType.SURFACE_FLINGER),
    ).not.toThrow();
  });

  it('sets the snapshot results', () => {
    expect(() =>
      traceEntryValueBuilder.setSnapshotResults(mockQueryResult),
    ).not.toThrow();
  });

  it('sets the layer results', () => {
    expect(() =>
      traceEntryValueBuilder.setLayersResults(mockQueryResult),
    ).not.toThrow();
  });

  it('sets the rect map', () => {
    expect(() =>
      traceEntryValueBuilder.setSfRectsMap(mockRectsMap),
    ).not.toThrow();
  });

  it('sets the trace geometry data', () => {
    expect(() =>
      traceEntryValueBuilder.setGeometryData(mockTraceGeometryData),
    ).not.toThrow();
  });

  it('returns undefined if trace type is not set on build', () => {
    const result = traceEntryValueBuilder.build();
    expect(result).toBeUndefined();
  });

  it('throws error for not implement trace type', () => {
    traceEntryValueBuilder.setType(TraceType.WINDOW_MANAGER);
    expect(() => traceEntryValueBuilder.build()).toThrow();
  });

  it('successfully calls makeEntryHierarchyTrees when all data is set', () => {
    traceEntryValueBuilder.setType(TraceType.SURFACE_FLINGER);
    traceEntryValueBuilder.setSnapshotResults(mockQueryResult);
    traceEntryValueBuilder.setLayersResults(mockQueryResult);
    traceEntryValueBuilder.setSfRectsMap(mockRectsMap);
    traceEntryValueBuilder.setGeometryData(mockTraceGeometryData);

    traceEntryValueBuilder.build();

    expect(makeEntryHierarchyTreesSpy).toHaveBeenCalledTimes(1);
    expect(makeEntryHierarchyTreesSpy).toHaveBeenCalledWith(
      mockQueryResult,
      mockQueryResult,
      mockRectsMap,
      undefined,
      mockTraceGeometryData,
    );
  });

  it('throws an error if type is set but required data is missing', () => {
    traceEntryValueBuilder.setType(TraceType.SURFACE_FLINGER);
    expect(() => traceEntryValueBuilder.build()).toThrow();
  });
});

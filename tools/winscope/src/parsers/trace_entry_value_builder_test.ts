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
import {makeEntryHierarchyTrees} from 'parsers/surface_flinger/entry_hierarchy_tree_factory';
import {TraceType} from 'trace_api/trace_type';
import {RectsForTrace} from './rect_extractor_result';
import {
  makeSpyRowIterator,
  setupMockIteratorWithRows,
} from 'trace_processor/test_utils';
import {TraceProcessor} from 'trace_processor/trace_processor';

describe('TraceEntryValueBuilder', async () => {
  const mockQueryResult: QueryResult = {} as QueryResult;
  const mockTraceGeometryData: TraceGeometryData = {} as TraceGeometryData;
  const mockRectsMap: RectsForTrace = new Map();

  let traceEntryValueBuilder: TraceEntryValueBuilder;
  let mockTraceProcessor: jasmine.SpyObj<TraceProcessor>;
  let makeEntryHierarchyTreesSpy: jasmine.Spy;

  beforeEach(() => {
    makeEntryHierarchyTreesSpy = spyOn(
      {makeEntryHierarchyTrees},
      'makeEntryHierarchyTrees',
    ).and.callThrough();
    mockTraceProcessor = jasmine.createSpyObj<TraceProcessor>(
      'MockTraceProcessor',
      ['query'],
    );
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
      traceEntryValueBuilder.setNodeResults(mockQueryResult),
    ).not.toThrow();
  });

  it('sets the rect map', () => {
    expect(() =>
      traceEntryValueBuilder.setRectsMap(mockRectsMap),
    ).not.toThrow();
  });

  it('sets the trace geometry data', () => {
    expect(() =>
      traceEntryValueBuilder.setGeometryData(mockTraceGeometryData),
    ).not.toThrow();
  });

  it('throws error if trace type is not set on build', () => {
    expect(() => traceEntryValueBuilder.build()).toThrow();
  });

  it('throws error for not implement trace type', () => {
    traceEntryValueBuilder.setType(TraceType.WINDOW_MANAGER);
    expect(() => traceEntryValueBuilder.build()).toThrow();
  });

  it('successfully calls makeEntryHierarchyTrees when all data is set', () => {
    const trees = traceEntryValueBuilder
      .setType(TraceType.SURFACE_FLINGER)
      .setSnapshotResults(createMockQueryResult([]))
      .setNodeResults(createMockQueryResult([]))
      .setRectsMap(mockRectsMap)
      .setGeometryData(mockTraceGeometryData)
      .build();

    expect(trees).toBeDefined();
  });

  it('throws an error if type is set but required data is missing', () => {
    traceEntryValueBuilder.setType(TraceType.SURFACE_FLINGER);
    expect(() => traceEntryValueBuilder.build()).toThrow();
  });

  function createMockQueryResult(
    rows: Array<{[key: string]: bigint | number | string}>,
  ) {
    const rowIterator = makeSpyRowIterator();
    setupMockIteratorWithRows(rowIterator, rows);
    const queryResult = jasmine.createSpyObj<QueryResult>('QueryResult', [
      'iter',
    ]);
    queryResult.iter.and.returnValue(rowIterator);
    return queryResult;
  }
});

/*
 * Copyright (C) 2024 The Android Open Source Project
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

import {InMemoryStorage} from '@common/store/in_memory_storage';
import {makeConverterZeroRteOffsets, makeRealTimestamp,} from '@common/time/testing/test_helpers';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {Trace} from '@trace_api/trace';
import {InitializeTraceSearchRequest, TraceAddRequest, TracePositionUpdate, TraceRemoveRequest, TraceSearchFailed, TraceSearchInitialized, TraceSearchRequest,} from '@trace_api/trace_events';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {QueryResult} from '@trace_processor/query_result';
import {makeSearchTraceSpies} from '@trace_processor/test_utils';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {Presenter} from './presenter';
import {CurrentSearch, ListedSearch, SearchResult, UiData} from './ui_data';

describe('PresenterSearch', () => {
  const timestampConverter = makeConverterZeroRteOffsets();
  let presenter: Presenter;
  let uiData: UiData;
  let userNotifierChecker: UserNotifierChecker;
  let emitEventSpy: jasmine.Spy;
  let storage: InMemoryStorage;

  beforeAll(() => {
    userNotifierChecker = new UserNotifierChecker();
    jasmine.addCustomEqualityTester(searchEqualityTester);
  });

  beforeEach(() => {
    storage = new InMemoryStorage();
    presenter = new Presenter(
      new Traces(),
      storage,
      (newData: UiData) => (uiData = newData),
      timestampConverter,
    );
    userNotifierChecker.reset();
    emitEventSpy = jasmine.createSpy();
    presenter.setEmitEvent(emitEventSpy);
  });

  it('handles trace search initialization', async () => {
    await presenter.onGlobalSearchSectionClick();
    expect(emitEventSpy).toHaveBeenCalledOnceWith(
      new InitializeTraceSearchRequest(),
    );
    expect(uiData.initialized).toBeFalse();

    await presenter.onAppEvent(new TraceSearchInitialized(['test_view']));
    expect(uiData.initialized).toBeTrue();
    expect(uiData.searchViews).toEqual(['test_view']);

    emitEventSpy.calls.reset();
    await presenter.onGlobalSearchSectionClick();
    expect(emitEventSpy).not.toHaveBeenCalled();
  });

  it('loads recent searches from storage', () => {
    const testStorage = new InMemoryStorage();
    const recentSearches = [new ListedSearch('stored query')];
    testStorage.add(
      'recentSearches',
      JSON.stringify({searches: recentSearches}),
    );

    presenter = new Presenter(
      new Traces(),
      testStorage,
      (newData: UiData) => (uiData = newData),
      timestampConverter,
    );
    expect(uiData.recentSearches).toEqual(recentSearches);
  });

  it('handles search for successful query with zero rows', async () => {
    const query = 'successful empty query';
    await runSearchWithNoRowsAndCheckUiData(
      query,
      makeEmptyTrace(TraceType.SEARCH, [query, '1']),
    );
  });

  it('handles search for successful query with non-zero rows', async () => {
    const testQuery = 'successful non-empty query';
    await presenter.onSearchQueryClick(testQuery, 1);
    expect(emitEventSpy).toHaveBeenCalledOnceWith(
      new TraceSearchRequest(testQuery),
    );

    const time100 = makeRealTimestamp(100n);
    const [spyQueryResult, spyIter] = makeSearchTraceSpies(time100, {
      value: '123',
    });
    spyIter.get.withArgs('property').and.returnValue('test_time_ns');
    const spyTimestamp = spyOn(
      timestampConverter,
      'makeTimestampFromBootTimeNs',
    ).and.callThrough();
    const trace = new TraceBuilder<QueryResult>()
      .setEntries([spyQueryResult])
      .setTimestamps([time100])
      .setDescriptors([testQuery])
      .setType(TraceType.SEARCH)
      .build();
    await presenter.onAppEvent(new TraceAddRequest(trace));
    expect(uiData.currentSearches.length).toBe(1);
    expect(uiData.currentSearches[0].uid).toBe(1);
    expect(uiData.currentSearches[0].query).toBe(testQuery);
    expect(uiData.lastTraceFailed).toEqual(false);

    await presenter.onAppEvent(
      TracePositionUpdate.fromTraceEntry(trace.getEntry(0)),
    );
    expect(uiData.currentSearches.length).toBe(1);
    expect(uiData.currentSearches[0].result?.currentIndex).toBe(0);
    expect(uiData.currentSearches[0].result?.headers.length).toBe(4);
    expect(uiData.currentSearches[0].result?.entries.length).toBe(1);
    expect(spyTimestamp).toHaveBeenCalledTimes(2);
    expect(spyTimestamp).toHaveBeenCalledWith(200n);
    expect(spyTimestamp).toHaveBeenCalledWith(123n);
    expect(uiData.lastTraceFailed).toEqual(false);
    expect(uiData.recentSearches).toEqual([new ListedSearch(testQuery)]);
  });

  it('runs same query twice with separate uids', async () => {
    const query = 'successful query';
    await runSearchWithNoRowsAndCheckUiData(
      query,
      makeEmptyTrace(TraceType.SEARCH, [query]),
    );
    presenter.addSearch();
    emitEventSpy.calls.reset();
    await runSearchWithNoRowsAndCheckUiData(
      query,
      makeEmptyTrace(TraceType.SEARCH, [query]),
      2,
      [
        new CurrentSearch(1, query, new SearchResult([], [])),
        new CurrentSearch(2, query, new SearchResult([], [])),
      ],
    );
  });

  it('handles non-search trace added event', async () => {
    const currData = uiData;
    const trace = makeEmptyTrace<HierarchyTreeNode>(TraceType.SURFACE_FLINGER);
    await presenter.onAppEvent(new TraceAddRequest(trace));
    expect(uiData).toEqual(currData);
  });

  it('handles search for unsuccessful query', async () => {
    const testQuery = 'unsuccessful query';
    presenter.onSearchQueryClick(testQuery, 1);
    await presenter.onAppEvent(new TraceSearchFailed());
    expect(uiData.lastTraceFailed).toEqual(true);
    expect(uiData.currentSearches).toEqual([new CurrentSearch(1, testQuery)]);
    expect(uiData.recentSearches).toEqual([]);
  });

  it('clears current search result when query run again, keeping both in recent searches', async () => {
    const testQuery = 'query to be overwritten';
    const trace = makeEmptyTrace<QueryResult>(TraceType.SEARCH, [testQuery]);
    await runSearchWithNoRowsAndCheckUiData(testQuery, trace);
    emitEventSpy.calls.reset();

    await presenter.onSearchQueryClick(testQuery, 1);
    expect(emitEventSpy).toHaveBeenCalledWith(new TraceRemoveRequest(trace));
    expect(emitEventSpy).toHaveBeenCalledWith(
      new TraceSearchRequest(testQuery),
    );
    expect(uiData.currentSearches.length).toBe(1);
    emitEventSpy.calls.reset();

    await presenter.onAppEvent(new TraceSearchFailed());
    expect(uiData.currentSearches.length).toBe(1);
    expect(uiData.recentSearches).toEqual([new ListedSearch(testQuery)]);
    emitEventSpy.calls.reset();

    const newQuery = 'new query';
    const newTrace = makeEmptyTrace<QueryResult>(TraceType.SEARCH, [newQuery]);
    await runSearchWithNoRowsAndCheckUiData(newQuery, newTrace);
    emitEventSpy.calls.reset();

    // check removed presenter cannot still affect ui data
    await presenter.onArrowDownPress(1);
    expect(uiData.currentSearches.length).toBe(1);

    await presenter.onSearchQueryClick(newQuery, 1);
    expect(emitEventSpy).toHaveBeenCalledWith(new TraceRemoveRequest(newTrace));
    expect(emitEventSpy).toHaveBeenCalledWith(new TraceSearchRequest(newQuery));
    expect(uiData.currentSearches.length).toBe(1);
    expect(uiData.recentSearches).toEqual([
      new ListedSearch(newQuery),
      new ListedSearch(testQuery),
    ]);
  });

  it('handles save query click', () => {
    const testQuery = 'save query';
    const testName = 'save name';
    presenter.onSaveQueryClick(testQuery, testName);
    const testSearch = new ListedSearch(testQuery, testName);
    expect(uiData.savedSearches).toEqual([testSearch]);

    const newQuery = 'new save query';
    const newName = 'new save name';
    presenter.onSaveQueryClick(newQuery, newName);
    const newSearch = new ListedSearch(newQuery, newName);
    expect(uiData.savedSearches).toEqual([newSearch, testSearch]);
  });

  it('handles delete saved query click', () => {
    const testQuery = 'delete query';
    const testName = 'delete name';
    const testSearch = new ListedSearch(testQuery, testName);
    presenter.onDeleteSavedQueryClick(testSearch);
    expect(uiData.savedSearches).toEqual([]);

    presenter.onSaveQueryClick(testQuery, testName);
    expect(uiData.savedSearches).toEqual([testSearch]);

    presenter.onDeleteSavedQueryClick(uiData.savedSearches[0]);
    expect(uiData.savedSearches).toEqual([]);
  });

  it('handles clear query click', async () => {
    const testQuery = 'clear query';
    const trace = makeEmptyTrace<QueryResult>(TraceType.SEARCH, [
      testQuery,
      '1',
    ]);
    await runSearchWithNoRowsAndCheckUiData(testQuery, trace);

    await presenter.onClearQueryClick(0);
    expect(uiData.currentSearches.length).toBe(1);
    await presenter.onClearQueryClick(1);
    expect(uiData.currentSearches.length).toBe(1);
    expect(uiData.currentSearches[0].result).toBeUndefined();
  });

  it('retains at most 100 recent searches and saves to storage', async () => {
    for (let i = 0; i < 110; i++) {
      const testQuery = `recent query ${i}`;
      const trace = makeEmptyTrace<QueryResult>(TraceType.SEARCH, [
        testQuery,
        '1',
      ]);
      await presenter.onSearchQueryClick(testQuery, 1);
      await presenter.onAppEvent(new TraceAddRequest(trace));
    }
    expect(uiData.currentSearches.length).toBe(1);
    expect(uiData.recentSearches.length).toBe(100);
    const saved = JSON.parse(storage.get('recentSearches') ?? '{}');
    expect(saved.searches.length).toBe(100);
  });

  it('moves duplicate recent search to the top', async () => {
    const query1 = 'query 1';
    const query2 = 'query 2';

    // First query
    const trace1 = makeEmptyTrace<QueryResult>(TraceType.SEARCH, [query1, '1']);
    await presenter.onSearchQueryClick(query1, 1);
    await presenter.onAppEvent(new TraceAddRequest(trace1));

    // Second query
    const trace2 = makeEmptyTrace<QueryResult>(TraceType.SEARCH, [query2, '1']);
    await presenter.onSearchQueryClick(query2, 1);
    await presenter.onAppEvent(new TraceAddRequest(trace2));

    expect(uiData.recentSearches).toEqual([
      new ListedSearch(query2),
      new ListedSearch(query1),
    ]);

    // Repeat first query
    const trace1Again = makeEmptyTrace<QueryResult>(TraceType.SEARCH, [
      query1,
      '1',
    ]);
    await presenter.onSearchQueryClick(query1, 1);
    await presenter.onAppEvent(new TraceAddRequest(trace1Again));

    // Verify it moved to the top and didn't duplicate
    expect(uiData.recentSearches.length).toBe(2);
    expect(uiData.recentSearches).toEqual([
      new ListedSearch(query1),
      new ListedSearch(query2),
    ]);
  });

  function searchEqualityTester(
    first: unknown,
    second: unknown,
  ): boolean | undefined {
    if (first instanceof ListedSearch && second instanceof ListedSearch) {
      return first.query === second.query && first.name === second.name;
    }
    return undefined;
  }

  async function runSearchWithNoRowsAndCheckUiData(
    testQuery: string,
    trace: Trace<QueryResult>,
    uid = 1,
    expectedCurrentSearches = [
      new CurrentSearch(uid, testQuery, new SearchResult([], [])),
    ],
  ) {
    await presenter.onSearchQueryClick(testQuery, uid);
    expect(emitEventSpy).toHaveBeenCalledOnceWith(
      new TraceSearchRequest(testQuery),
    );
    await presenter.onAppEvent(new TraceAddRequest(trace));
    expect(uiData.currentSearches).toEqual(expectedCurrentSearches);
    expect(uiData.lastTraceFailed).toEqual(false);
    expect(uiData.recentSearches[0]).toEqual(new ListedSearch(testQuery));
  }
});

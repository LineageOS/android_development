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

import {assertDefined} from '@common/assert';
import {createPersistentStoreProxy} from '@common/store/persistent_store_proxy';
import {Store} from '@common/store/store';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {getLogger, Logger} from '@compat/logging';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent} from '@messaging/winscope_event_emitter';
import {Trace} from '@trace_api/trace';
import {InitializeTraceSearchRequest, TraceAddRequest, TracePositionUpdate, TraceRemoveRequest, TraceSearchFailed, TraceSearchInitialized, TraceSearchRequest,} from '@trace_api/trace_events';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {QueryResult} from '@trace_processor/query_result';
import {ActiveSearchQueriesUpdate} from '@ui/shared/events/misc_events';
import {LogFilterChangeDetail, LogTextFilterChangeDetail, TimestampClickDetail,} from '@ui/shared/viewers/viewer_event_details';

import {SearchResultPresenter} from './search_result_presenter';
import {CurrentSearch, ListedSearch, SearchResult, UiData} from './ui_data';

interface ActiveSearch {
  search: CurrentSearch;
  trace?: Trace<QueryResult>;
  resultPresenter?: SearchResultPresenter;
}

export class Presenter {
  private emitWinscopeEvent: EmitEvent = () => Promise.resolve();
  private uiData = UiData.createEmpty();
  private activeSearchUid = 0;
  private activeSearches: ActiveSearch[] = [];
  private savedSearches: {searches: ListedSearch[]};
  private recentSearches: {searches: ListedSearch[]};
  private viewerElement: HTMLElement | undefined;
  private runningSearch: CurrentSearch | undefined;

  constructor(
    private traces: Traces,
    private storage: Store,
    private readonly notifyViewCallback: (uiData: UiData) => void,
    private readonly timestampConverter: TimestampConverter,
    private readonly logger: Logger = getLogger('Presenter'),
  ) {
    this.savedSearches = createPersistentStoreProxy<{searches: ListedSearch[]}>(
      'savedSearches',
      {searches: []},
      this.storage,
    );
    this.recentSearches = createPersistentStoreProxy<{
      searches: ListedSearch[];
    }>('recentSearches', {searches: []}, this.storage);
    this.uiData.savedSearches = this.savedSearches.searches.map(
      (s) => new ListedSearch(s.query, s.name, s.timeMs),
    );
    this.uiData.recentSearches = this.recentSearches.searches.map(
      (s) => new ListedSearch(s.query, s.name, s.timeMs),
    );
    this.addSearch();
  }

  setEmitEvent(callback: EmitEvent) {
    this.emitWinscopeEvent = callback;
  }

  onDestroy() {
    // do nothing
  }

  notifyViewChanged() {
    // Create a shallow copy of the data, otherwise the Angular OnPush change detection strategy
    // won't detect the new input
    const copy = Object.assign({}, this.uiData);
    this.notifyViewCallback(copy);
  }

  async onAppEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case TraceSearchInitialized:
        return await this.onTraceSearchInitialized(
          event as TraceSearchInitialized,
        );
      case TraceAddRequest:
        return await this.onTraceAddRequest(event as TraceAddRequest);
      case TraceSearchFailed:
        return this.onTraceSearchFailed();
      default:
        this.logger.trace('Not processing event ' + event.constructor.name);
    }

    for (const activeSearch of this.activeSearches.values()) {
      await activeSearch.resultPresenter?.onAppEvent(event);
    }
  }

  async onGlobalSearchSectionClick() {
    if (!this.uiData.initialized) {
      this.emitWinscopeEvent(new InitializeTraceSearchRequest());
    }
  }

  async onSearchQueryClick(query: string, uid: number) {
    const activeSearch = assertDefined(this.findActiveSearch(uid));
    this.resetActiveSearch(activeSearch, query);
    this.runningSearch = activeSearch.search;
    this.emitWinscopeEvent(new TraceSearchRequest(query));
  }

  addSearch(query?: string) {
    this.activeSearchUid++;
    this.activeSearches.push({
      search: new CurrentSearch(this.activeSearchUid, query),
    });
    this.updateCurrentSearches();
  }

  async onClearQueryClick(uid: number) {
    const activeSearchIndex = this.activeSearches.findIndex(
      (a) => a.search.uid === uid,
    );
    if (activeSearchIndex === -1) {
      return;
    }
    const activeSearch =
      activeSearchIndex === 0
        ? this.activeSearches[activeSearchIndex]
        : this.activeSearches.splice(activeSearchIndex, 1)[0];
    this.resetActiveSearch(activeSearch);
    this.updateCurrentSearches();
  }

  onSaveQueryClick(query: string, name: string) {
    this.uiData.savedSearches.unshift(new ListedSearch(query, name));
    this.savedSearches.searches = this.uiData.savedSearches;
    this.notifyViewChanged();
  }

  onDeleteSavedQueryClick(savedSearch: ListedSearch) {
    this.uiData.savedSearches = this.uiData.savedSearches.filter(
      (s) => s !== savedSearch,
    );
    this.savedSearches.searches = this.uiData.savedSearches;
    this.notifyViewChanged();
  }

  async onSelectFilterChange(uid: number, detail: LogFilterChangeDetail) {
    return this.findResultPresenter(uid)?.onSelectFilterChange(
      detail.header,
      detail.value,
    );
  }

  async onLogTextFilterChange(uid: number, detail: LogTextFilterChangeDetail) {
    return this.findResultPresenter(uid)?.onTextFilterChange(
      detail.header,
      detail.filter,
    );
  }

  async onLogEntryClick(uid: number, index: number) {
    return this.findResultPresenter(uid)?.onLogEntryClick(index);
  }

  async onTimestampClick(uid: number, detail: TimestampClickDetail) {
    return this.findResultPresenter(uid)?.onTimestampClick(detail);
  }

  async onArrowDownPress(uid: number) {
    return this.findResultPresenter(uid)?.onArrowDownPress();
  }

  async onArrowUpPress(uid: number) {
    return this.findResultPresenter(uid)?.onArrowUpPress();
  }

  private onTraceSearchFailed() {
    this.runningSearch = undefined;
    this.uiData.lastTraceFailed = true;
    this.notifyViewChanged();
    this.uiData.lastTraceFailed = false;
  }

  private async showQueryResult(newTrace: Trace<QueryResult>) {
    const [traceQuery] = newTrace.getDescriptors();
    const existingIndex = this.uiData.recentSearches.findIndex(
      (s) => s.query === traceQuery,
    );
    if (existingIndex !== -1) {
      this.uiData.recentSearches.splice(existingIndex, 1);
    } else if (this.uiData.recentSearches.length >= 100) {
      this.uiData.recentSearches.pop();
    }
    this.uiData.recentSearches.unshift(new ListedSearch(traceQuery));
    this.recentSearches.searches = this.uiData.recentSearches;

    const activeSearch = assertDefined(
      this.findActiveSearch(assertDefined(this.runningSearch?.uid)),
    );
    this.resetActiveSearch(activeSearch, traceQuery);
    this.runningSearch = undefined;
    this.notifyViewChanged();
    this.initializeResultPresenter(activeSearch, newTrace);
  }

  private updateCurrentSearches() {
    this.uiData.currentSearches = this.activeSearches.map((a) => a.search);
    this.emitWinscopeEvent(
      new ActiveSearchQueriesUpdate(
        this.uiData.currentSearches
          .map((s) => s.query)
          .filter((q) => q !== undefined) as string[],
      ),
    );
    this.notifyViewChanged();
  }

  private resetActiveSearch(activeSearch: ActiveSearch, newQuery?: string) {
    activeSearch.search.query = newQuery;
    activeSearch.search.result = undefined;
    if (activeSearch.resultPresenter) {
      activeSearch.resultPresenter.onDestroy();
      activeSearch.resultPresenter = undefined;
    }
    if (activeSearch.trace) {
      this.emitWinscopeEvent(new TraceRemoveRequest(activeSearch.trace));
      activeSearch.trace = undefined;
    }
  }

  private async initializeResultPresenter(
    activeSearch: ActiveSearch,
    newTrace: Trace<QueryResult>,
  ) {
    activeSearch.trace = newTrace;
    const firstEntry =
      newTrace.lengthEntries > 0 ? newTrace.getEntry(0) : undefined;

    // assume all received timestamps are elapsed from boottime
    const makeTimestampStrategy = (valueNs: bigint) =>
      this.timestampConverter.makeTimestampFromBootTimeNs(valueNs);

    const presenter = new SearchResultPresenter(
      newTrace,
      (result: SearchResult) => {
        if (activeSearch.search.result) {
          activeSearch.search.result.scrollToIndex = result.scrollToIndex;
          activeSearch.search.result.selectedIndex = result.selectedIndex;
        } else {
          activeSearch.search.result = result;
        }
        this.updateCurrentSearches();
      },
      makeTimestampStrategy,
      firstEntry ? await firstEntry.getValue() : undefined,
    );
    presenter.setEmitEvent(async (event) => this.emitWinscopeEvent(event));
    activeSearch.resultPresenter = presenter;

    if (firstEntry) {
      await presenter.onAppEvent(
        TracePositionUpdate.fromTraceEntry(firstEntry),
      );
      await this.emitWinscopeEvent(
        TracePositionUpdate.fromTraceEntry(firstEntry),
      );
    }
  }

  private async onTraceSearchInitialized(event: TraceSearchInitialized) {
    this.uiData.searchViews = event.views;
    this.uiData.initialized = true;
    this.notifyViewChanged();
  }

  private async onTraceAddRequest(event: TraceAddRequest) {
    if (event.trace.type === TraceType.SEARCH) {
      return this.showQueryResult(event.trace as Trace<QueryResult>);
    }
  }

  private findResultPresenter(uid: number) {
    return this.findActiveSearch(uid)?.resultPresenter;
  }

  private findActiveSearch(uid: number) {
    return this.activeSearches.find((s) => s.search.uid === uid);
  }
}

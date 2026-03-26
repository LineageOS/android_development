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

import {AbstractViewer} from '@app/shared/abstract_viewer';
import {assertDefined} from '@common/assert';
import {Store} from '@common/store/store';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {QueryResult} from '@trace_processor/query_result';
import {Presenter} from '@ui/search/presenter';
import {UiData} from '@ui/search/ui_data';
import {ViewType} from '@ui/shared/viewers/viewer';

import {ViewerSearchComponent} from './viewer_search_component';

export class ViewerSearch extends AbstractViewer<
  QueryResult,
  UiData,
  Presenter
> {
  static readonly DEPENDENCIES: TraceType[] = [TraceType.SEARCH];

  private traces: Traces | undefined;

  constructor(
    traces: Traces,
    store: Store,
    timestampConverter: TimestampConverter,
  ) {
    super(undefined, traces, ViewerSearchComponent, store, timestampConverter);
  }

  override getTraces(): Array<Trace<QueryResult>> {
    return assertDefined(this.traces).getTraces(TraceType.SEARCH);
  }

  override getViewType(): ViewType {
    return ViewType.GLOBAL_SEARCH;
  }

  protected override createPresenter(
    trace: Trace<QueryResult> | undefined,
    traces: Traces,
    store: Store,
    notifyViewCallback: (uiData: UiData) => void,
    timestampConverter: TimestampConverter,
  ): Presenter {
    this.traces = traces;
    return new Presenter(traces, store, notifyViewCallback, timestampConverter);
  }

  protected override getTraceTypeForViewTitle(): TraceType {
    return TraceType.SEARCH;
  }

  protected override addOutputListeners(component: ViewerSearchComponent) {
    component.onLogFilterChange.subscribe(async (event) => {
      await this.presenter.onSelectFilterChange(event.uid, event.detail);
    });
    component.onLogTextFilterChange.subscribe(async (event) => {
      await this.presenter.onLogTextFilterChange(event.uid, event.detail);
    });
    component.onLogEntryClick.subscribe(async (event) => {
      await this.presenter.onLogEntryClick(event.uid, event.detail);
    });
    component.onResultTimestampClick.subscribe(async (event) => {
      await this.presenter.onTimestampClick(event.uid, event.detail);
    });
    component.onArrowDownPress.subscribe(async (event) => {
      await this.presenter.onArrowDownPress(event);
    });
    component.onArrowUpPress.subscribe(async (event) => {
      await this.presenter.onArrowUpPress(event);
    });
    component.globalSearchSectionClick.subscribe(async () => {
      await this.presenter.onGlobalSearchSectionClick();
    });
    component.searchQueryChange.subscribe(async (event) => {
      await this.presenter.onSearchQueryClick(event.query, event.uid);
    });
    component.saveQuery.subscribe(async (event) => {
      this.presenter.onSaveQueryClick(event.query, event.name);
    });
    component.clearQueryChange.subscribe(async (event) => {
      await this.presenter.onClearQueryClick(event);
    });
    component.addQueryChange.subscribe((event) => {
      this.presenter.addSearch(event);
    });
    component.deleteSavedQuery.subscribe((event) => {
      this.presenter.onDeleteSavedQueryClick(event);
    });
  }
}

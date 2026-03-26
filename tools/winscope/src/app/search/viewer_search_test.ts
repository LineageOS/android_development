/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {ComponentRef} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {makeConverterNoRteOffsets} from '@common/time/testing/test_helpers';
import {Traces} from '@trace_api/traces';
import {Presenter} from '@ui/search/presenter';
import {ListedSearch} from '@ui/search/ui_data';
import {SaveQueryClickDetail, SearchQueryClickDetail,} from '@ui/shared/viewers/viewer_event_details';

import {ViewerSearch} from './viewer_search';
import {ViewerSearchComponent} from './viewer_search_component';

describe('ViewerSearch', () => {
  let traces: Traces;
  let viewer: ViewerSearch;
  let componentRef: ComponentRef<ViewerSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewerSearchComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ViewerSearchComponent);
    componentRef = fixture.componentRef;
    traces = new Traces();
    const converter = makeConverterNoRteOffsets();
    viewer = new ViewerSearch(traces, new InMemoryStorage(), converter);
    viewer.setComponentRef(componentRef);
  });

  it('adds component output listener for onGlobalSearchSectionClick', async () => {
    const spy = spyOn(Presenter.prototype, 'onGlobalSearchSectionClick');
    componentRef.instance.globalSearchSectionClick.emit();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('adds component output listener for onSearchQueryClick', async () => {
    const spy = spyOn(Presenter.prototype, 'onSearchQueryClick');
    const detail = new SearchQueryClickDetail('query', 1);
    componentRef.instance.searchQueryChange.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail.query, detail.uid);
  });

  it('adds component output listener for onSaveQueryClick', async () => {
    const spy = spyOn(Presenter.prototype, 'onSaveQueryClick');
    const detail = new SaveQueryClickDetail('query', 'name');
    componentRef.instance.saveQuery.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail.query, detail.name);
  });

  it('adds component output listener for onDeleteSavedQueryClick', async () => {
    const spy = spyOn(Presenter.prototype, 'onDeleteSavedQueryClick');
    const detail = new ListedSearch('query', 'name');
    componentRef.instance.deleteSavedQuery.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail);
  });

  it('adds component output listener for onAddQueryClick', async () => {
    const spy = spyOn(Presenter.prototype, 'addSearch');
    componentRef.instance.addQueryChange.emit('query');
    expect(spy).toHaveBeenCalledOnceWith('query');
  });

  it('adds component output listener for onClearQueryClick', async () => {
    const spy = spyOn(Presenter.prototype, 'onClearQueryClick');
    componentRef.instance.clearQueryChange.emit(1);
    expect(spy).toHaveBeenCalledOnceWith(1);
  });
});

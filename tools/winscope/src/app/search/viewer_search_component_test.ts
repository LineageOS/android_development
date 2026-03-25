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

import {CdkAccordionModule} from '@angular/cdk/accordion';
import {CdkMenuModule} from '@angular/cdk/menu';
import {CdkVirtualScrollViewport, ScrollingModule,} from '@angular/cdk/scrolling';
import {CommonModule} from '@angular/common';
import {TestBed} from '@angular/core/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTabsModule} from '@angular/material/tabs';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {CollapsedSectionsComponent} from '@app/shared/collapsible_sections/collapsed_sections_component';
import {CollapsibleSectionTitleComponent} from '@app/shared/collapsible_sections/collapsible_section_title_component';
import {LogComponent} from '@app/shared/log_view/log_component';
import {VirtualRow, VirtualScrollViewportComponent,} from '@app/shared/scroll/virtual_scroll_viewport_component';
import {assertDefined} from '@common/assert';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeRealTimestamp} from '@common/time/testing/test_helpers';
import {Analytics} from '@logging/analytics';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {CurrentSearch, ListedSearch, SearchResult, UiData,} from '@ui/search/ui_data';
import {LogEntry, LogField, LogHeader} from '@ui/shared/log/ui_data_log';
import {SaveQueryClickDetail, SearchQueryClickDetail,} from '@ui/shared/viewers/viewer_event_details';
import {makeWarningExportTooLarge, makeWarningFailedToExportToCsv, makeWarningNoResultsToExport,} from '@ui/trace_loading/warnings';

import {ActiveSearchComponent} from './active_search_component';
import {SearchListComponent} from './search_list_component';
import {SEARCH_VIEWS} from './trace_search_initializer';
import {ViewerSearchComponent} from './viewer_search_component';

describe('ViewerSearchComponent', () => {
  const testQuery = 'select * from table';
  const accordionItemSelector = '.accordion-item-header';
  const searchQuerySelector = '.query-actions .search-button';
  const listedSearchSelector = '.listed-search-option';
  const headers: LogHeader[] = [
    new LogHeader({name: 'Column 1', cssClass: 'col1'}),
    new LogHeader({name: 'Column, 2', cssClass: 'col2'}),
  ];

  const trace = new TraceBuilder<PropertyTreeNode>()
    .setTimestamps([makeRealTimestamp(100n), makeRealTimestamp(200n)])
    .build();

  const entries: LogEntry[] = [
    {
      traceEntry: trace.getEntry(0),
      fields: [
        new LogField(headers[0].spec, 'value 1'),
        new LogField(headers[1].spec, 'value "2"'),
      ],
      getPropertiesTree: undefined,
    },
    {
      traceEntry: trace.getEntry(1),
      fields: [
        new LogField(headers[0].spec, 'value 3\nwith newline'),
        new LogField(headers[1].spec, makeRealTimestamp(300n)),
      ],
      getPropertiesTree: undefined,
    },
  ];

  const search = new CurrentSearch(
    1,
    'query',
    new SearchResult(headers, entries),
  );
  let component: ViewerSearchComponent;
  let dom: DOMTestHelper<ViewerSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        MatFormFieldModule,
        MatInputModule,
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        CdkMenuModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        CdkAccordionModule,
        MatDividerModule,
        ViewerSearchComponent,
        CollapsedSectionsComponent,
        CollapsibleSectionTitleComponent,
        ActiveSearchComponent,
        SearchListComponent,
        LogComponent,
        VirtualRow,
        VirtualScrollViewportComponent,
        ScrollingModule,
        CdkVirtualScrollViewport,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ViewerSearchComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    const inputData = UiData.createEmpty();
    inputData.initialized = true;
    inputData.currentSearches = [new CurrentSearch(1)];
    dom.setComponentInput('inputData', inputData);
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('creates global search section with tabs', () => {
    const globalSearch = dom.get('.global-search');
    const [searchTab, savedTab, recentTab] = globalSearch.findAll(
      '.mdc-tab .mdc-tab__text-label',
    );
    searchTab.checkTextExact('Search');
    savedTab.checkTextExact('Saved');
    recentTab.checkTextExact('Recent');
  });

  it('creates collapsed sections with no buttons', () => {
    dom.checkNoCollapsedSectionButtons();
  });

  it('handles search box section collapse/expand', () => {
    dom.checkSectionCollapseAndExpand('.global-search', 'GLOBAL SEARCH');
  });

  it('handles tabulated results section collapse/expand', () => {
    dom.checkSectionCollapseAndExpand('.search-results', 'SEARCH RESULTS');
  });

  it('handles documentation groups section collapse/expand', () => {
    dom.checkSectionCollapseAndExpand('.how-to-search', 'HOW TO SEARCH');
  });

  it('handles search via search query click', () => {
    runSearchAndCheckHandled(runSearchByQueryButton, 1);
  });

  it('handles search via run query from saved without creating new active search', async () => {
    const inputData = assertDefined(component.inputData());
    inputData.savedSearches = [new ListedSearch(testQuery, 'saved1')];
    dom.detectChanges();
    await changeTab(1);
    runSearchAndCheckHandled(() => dom.findAndClick(listedSearchSelector), 1);
  });

  it('handles search via run query from recents without creating new active search', async () => {
    const inputData = assertDefined(component.inputData());
    inputData.recentSearches = [new ListedSearch(testQuery)];
    dom.detectChanges();
    await changeTab(2);
    runSearchAndCheckHandled(() => dom.findAndClick(listedSearchSelector), 1);
  });

  it('handles search via run query from saved creating new active search', async () => {
    const inputData = assertDefined(component.inputData());
    inputData.savedSearches = [new ListedSearch(testQuery, 'saved1')];
    await checkRunQueryFromOptionsWhenResultPresent(1);
  });

  it('handles search via run query from recents creating new active search', async () => {
    const inputData = assertDefined(component.inputData());
    inputData.recentSearches = [new ListedSearch(testQuery)];
    await checkRunQueryFromOptionsWhenResultPresent(2);
  });

  it('handles edit saved search without creating new section', async () => {
    const inputData = assertDefined(component.inputData());
    inputData.savedSearches = [new ListedSearch(testQuery, 'saved1')];
    await checkEditQueryFromOptions(1);
  });

  it('handles edit recent search without creating new section', async () => {
    const inputData = assertDefined(component.inputData());
    inputData.recentSearches = [new ListedSearch(testQuery)];
    await checkEditQueryFromOptions(2);
  });

  it('handles edit saved search creating new section', async () => {
    const inputData = assertDefined(component.inputData());
    inputData.savedSearches = [new ListedSearch(testQuery, 'saved1')];
    await checkEditQueryFromOptionsWhenResultPresent(1);
  });

  it('handles edit recent search creating new section', async () => {
    const inputData = assertDefined(component.inputData());
    inputData.recentSearches = [new ListedSearch(testQuery)];
    await checkEditQueryFromOptionsWhenResultPresent(2);
  });

  it('handles running query complete', () => {
    const placeholderCss = '.results-placeholder.placeholder-text';
    expect(dom.find(placeholderCss)).toBeDefined();

    dom.get(searchQuerySelector).click();
    runSearchByQueryButton();
    expect(dom.find(placeholderCss)).toBeUndefined();

    addCurrentSearchWithResult();
    expect(dom.find('.query-execution-time')).toBeDefined();
    expect(dom.find('log-view')).toBeDefined();
    expect(dom.find(placeholderCss)).toBeUndefined();
    expect(dom.find('.result-actions')).toBeDefined();
    dom.get('.result-actions').checkTextExact('download Export to CSV');
  });

  it('exports search results to csv', async () => {
    const analyticsSpy = spyOn(Analytics.TraceSearch, 'logQueryExportedToCsv');
    const downloadSpy = jasmine.createSpy();
    const createObjectURLSpy = spyOn(URL, 'createObjectURL').and.callFake(
      (_) => 'blob:url',
    );

    component.exportToCsv(search, downloadSpy);

    const expectedCsv = [
      'Column 1,"Column, 2"',
      'value 1,"value ""2"""',
      '"value 3\nwith newline","1970-01-01, 00:00:00.000"',
    ].join('\n');

    expect(downloadSpy).toHaveBeenCalledWith(
      'blob:url',
      'search_results_1.csv',
    );
    expect(analyticsSpy).toHaveBeenCalled();

    const blob = createObjectURLSpy.calls.mostRecent().args[0] as Blob;
    expect(await blob.text()).toEqual(expectedCsv);
  });

  it('notifies user on export failure', () => {
    const userNotifierChecker = new UserNotifierChecker();
    const analyticsSpy = spyOn(Analytics.TraceSearch, 'logQueryExportFailed');
    const errorMessage = 'Export error';
    spyOn(URL, 'createObjectURL').and.throwError(errorMessage);

    component.exportToCsv(search);

    userNotifierChecker.expectNotified([
      makeWarningFailedToExportToCsv(errorMessage),
    ]);
    expect(analyticsSpy).toHaveBeenCalled();
  });

  it('notifies user on empty results export', () => {
    const userNotifierChecker = new UserNotifierChecker();
    const search = new CurrentSearch(1, 'query', new SearchResult([], []));
    component.exportToCsv(search);
    userNotifierChecker.expectNotified([makeWarningNoResultsToExport()]);
  });

  it('notifies user on too large results export', () => {
    const userNotifierChecker = new UserNotifierChecker();
    const entries = new Array(100001).fill({});
    const search = new CurrentSearch(1, 'query', new SearchResult([], entries));
    component.exportToCsv(search);
    userNotifierChecker.expectNotified([makeWarningExportTooLarge(100000)]);
  });

  it('adds search sections', () => {
    const spy = spyOn(component.addQueryChange, 'emit');

    const addButton = dom.get('.add-button');
    expect(dom.find('.clear-button')).toBeUndefined();
    addButton.checkDisabled(true);

    const data = structuredClone(assertDefined(component.inputData()));
    data.currentSearches[0].query = testQuery;
    updateInputDataAndDetectChanges(data);

    addButton.click();
    expect(spy).toHaveBeenCalledTimes(1);

    const newData = structuredClone(assertDefined(component.inputData()));
    newData.currentSearches.push(new CurrentSearch(2));
    updateInputDataAndDetectChanges(newData);

    const activeSections = dom.findAll('active-search');
    expect(activeSections.length).toBe(2);
    expect(activeSections[0].find('.clear-button')).toBeDefined();
    expect(activeSections[1].find('.clear-button')).toBeDefined();

    expect(activeSections[0].find('.add-button')).toBeUndefined();
    activeSections[1].get('.add-button').checkDisabled(true);
  });

  it('handles multiple results', async () => {
    const clearQuerySpy = spyOn(component.clearQueryChange, 'emit');

    const data = structuredClone(assertDefined(component.inputData()));
    data.currentSearches[0].result = new SearchResult([], []);
    updateInputDataAndDetectChanges(data);
    addCurrentSearchWithResult(testQuery, 2);
    let resultTabs = dom.findAll('.result-tabs .mdc-tab__text-label');
    let activeSections = dom.findAll('active-search');
    expect(activeSections.length).toBe(2);
    expect(resultTabs.length).toBe(2);
    resultTabs[0].checkTextExact('Query 1');
    resultTabs[1].checkTextExact('Query 2');

    dom.findAndClick('.clear-button');
    expect(clearQuerySpy).toHaveBeenCalledOnceWith(1);

    const spy = spyOn(activeSections[1].getHTMLElement(), 'scrollIntoView');

    const newData = structuredClone(assertDefined(component.inputData()));
    newData.currentSearches.shift();
    updateInputDataAndDetectChanges(newData);
    await dom.whenStable();

    resultTabs = dom.findAll('.result-tabs .mdc-tab__text-label');
    activeSections = dom.findAll('active-search');
    expect(resultTabs.length).toBe(1);
    resultTabs[0].checkTextExact('Query 2');
    expect(activeSections.length).toBe(1);
    expect(spy).toHaveBeenCalled();
  });

  it('handles running query failure', () => {
    runSearchByQueryButton();
    const data = structuredClone(assertDefined(component.inputData()));
    data.lastTraceFailed = true;
    updateInputDataAndDetectChanges(data);
    expect(dom.find('.query-execution-time')).toBeDefined();
    expect(dom.find('.running-query-message')).toBeUndefined();
    expect(dom.find('log-view')).toBeUndefined();
    dom.get(searchQuerySelector).checkDisabled(false);
  });

  it('emits event on save query click', () => {
    const saveQuerySpy = spyOn(component.saveQuery, 'emit');
    const testName = 'Query 1';
    const data = structuredClone(assertDefined(component.inputData()));
    data.savedSearches.push(new ListedSearch(testQuery, testName));
    updateInputDataAndDetectChanges(data);
    addCurrentSearchWithResult();
    const saveField = dom.get('.current-search .save-field');
    const saveQueryButton = saveField.get('.query-button');
    const input = saveField.get('input');
    input.dispatchInput(testName);
    saveQueryButton.click();
    expect(saveQuerySpy).not.toHaveBeenCalled(); // name already exists

    const testName2 = 'Query 2';
    input.dispatchInput(testName2);
    input.keydownEnter(); // save by enter key
    expect(saveQuerySpy).toHaveBeenCalledOnceWith(
      new SaveQueryClickDetail(testQuery, testName2),
    );

    const testName3 = 'Query 3';
    input.dispatchInput(testName3);
    saveQueryButton.click(); // save by click
    expect(saveQuerySpy).toHaveBeenCalledTimes(2);
    expect(saveQuerySpy).toHaveBeenCalledWith(
      new SaveQueryClickDetail(testQuery, testName3),
    );
  });

  it('emits event on delete saved query click', async () => {
    const deleteSavedQuerySpy = spyOn(component.deleteSavedQuery, 'emit');
    const search = new ListedSearch(testQuery);
    const data = structuredClone(assertDefined(component.inputData()));
    data.savedSearches = [search];
    updateInputDataAndDetectChanges(data);

    await changeTab(1);
    dom.findAndClickByIndex(listedSearchSelector, 2);
    expect(deleteSavedQuerySpy).toHaveBeenCalledOnceWith(search);
  });

  it('handles trace search initialization', () => {
    let data = structuredClone(assertDefined(component.inputData()));
    data.initialized = false;
    updateInputDataAndDetectChanges(data);
    const spy = spyOn(component.globalSearchSectionClick, 'emit');
    const globalSearch = dom.get('.global-search');
    expect(globalSearch.find('.message-with-spinner')).toBeUndefined();

    clickGlobalSearchAndCheckMessage(globalSearch);
    clickGlobalSearchAndCheckMessage(globalSearch);
    expect(spy).toHaveBeenCalledTimes(1);

    getTextInput().dispatchInput(testQuery);
    dom.get(searchQuerySelector).checkDisabled(true);

    data = structuredClone(assertDefined(component.inputData()));
    data.initialized = true;
    updateInputDataAndDetectChanges(data);
    expect(globalSearch.find('.message-with-spinner')).toBeUndefined();
    dom.get(searchQuerySelector).checkDisabled(false);
  });

  it('can open SQL view descriptors in how to section', () => {
    const accordionItems = dom.findAll('.how-to-search .accordion-item');
    expect(accordionItems.length).toBe(SEARCH_VIEWS.length);
    accordionItems.forEach((item) => checkAccordionItemCollapsed(item));

    accordionItems[0].get(accordionItemSelector).click();
    checkAccordionItemExpanded(accordionItems[0]);
    checkAccordionItemCollapsed(accordionItems[1]);

    accordionItems[1].get(accordionItemSelector).click();
    checkAccordionItemExpanded(accordionItems[0]);
    checkAccordionItemExpanded(accordionItems[1]);

    accordionItems[0].get(accordionItemSelector).click();
    checkAccordionItemCollapsed(accordionItems[0]);
    checkAccordionItemExpanded(accordionItems[1]);
  });

  it('can open documentation for each SQL view', async () => {
    const links = dom.findAll('.how-to-search .accordion-item-header a');
    expect(links.length).toBe(SEARCH_VIEWS.length);
    for (const [i, link] of links.entries()) {
      await checkDocsLink(link, i);
    }
  });

  function clickGlobalSearchAndCheckMessage(
    globalSearch: DOMTestHelper<ViewerSearchComponent>,
  ) {
    globalSearch.click();
    expect(dom.find('.message-with-spinner')).toBeDefined();
    dom.get(searchQuerySelector).checkDisabled(true);
  }

  function getTextInput(i = 0): DOMTestHelper<ViewerSearchComponent> {
    return dom.findAll('.query-field textarea')[i];
  }

  function runSearchByQueryButton(i = 0) {
    getTextInput(i).dispatchInput(testQuery);
    dom.findAndClickByIndex(searchQuerySelector, i);
  }

  async function changeTab(index: number) {
    const matTabGroups = component.matTabGroups();
    matTabGroups[0].selectedIndex = index;
    await dom.detectChangesAndWaitStable();
  }

  async function checkRunQueryFromOptionsWhenResultPresent(tabIndex: number) {
    const data = structuredClone(assertDefined(component.inputData()));
    data.currentSearches[0].query = testQuery;
    data.currentSearches[0].result = new SearchResult([], []);
    const addQuerySpy = spyOn(component.addQueryChange, 'emit');
    updateInputDataAndDetectChanges(data);

    await changeTab(tabIndex);
    dom.findAndClick(listedSearchSelector);
    expect(addQuerySpy).toHaveBeenCalledOnceWith(testQuery);
    await changeTab(0);
    runSearchAndCheckHandled(addCurrentSearchWithResult, 2);
    expect(dom.findAll('active-search').length).toBe(2);
  }

  function runSearchAndCheckHandled(runSearch: () => void, uid: number) {
    const searchQuerySpy = spyOn(component.searchQueryChange, 'emit');
    runSearch();
    expect(searchQuerySpy).toHaveBeenCalledOnceWith(
      new SearchQueryClickDetail(testQuery, uid),
    );
    dom.get(searchQuerySelector).checkDisabled(true);
    const runningQueryMessage = dom.get('.running-query-message');
    runningQueryMessage.checkTextExact('timer Calculating results');
    expect(runningQueryMessage.find('mat-spinner')).toBeDefined();
  }

  async function checkEditQueryFromOptionsWhenResultPresent(tabIndex: number) {
    let data = structuredClone(assertDefined(component.inputData()));
    data.currentSearches[0].result = new SearchResult([], []);
    updateInputDataAndDetectChanges(data);

    const spy = spyOn(component.addQueryChange, 'emit');

    await changeTabAndClickEdit(tabIndex);
    expect(component.matTabGroups().at(0)?.selectedIndex).toEqual(tabIndex);
    expect(spy).toHaveBeenCalledOnceWith(testQuery);

    data = structuredClone(assertDefined(component.inputData()));
    data.currentSearches.push(new CurrentSearch(2, testQuery));
    updateInputDataAndDetectChanges(data);
    await dom.detectChangesAndWaitStable();
    expect(component.matTabGroups().at(0)?.selectedIndex).toBe(0);
    getTextInput(0).checkValue('');
    getTextInput(1).checkValue(testQuery);
  }

  async function checkEditQueryFromOptions(tabIndex: number) {
    dom.detectChanges();
    const input = getTextInput();
    expect(input.checkValue(''));
    await changeTabAndClickEdit(tabIndex);
    expect(component.matTabGroups().at(0)?.selectedIndex).toBe(0);
    expect(input.checkValue(testQuery));
  }

  async function changeTabAndClickEdit(tabIndex: number) {
    await changeTab(tabIndex);
    const listedSearchButton = dom.findAll('.listed-search-option');
    listedSearchButton[1].click();
    await dom.whenStable();
  }

  function addCurrentSearchWithResult(q = testQuery, uid = 2) {
    const data = structuredClone(assertDefined(component.inputData()));
    const currentSearch = new CurrentSearch(uid, q, new SearchResult([], []));
    data.currentSearches.push(currentSearch);
    updateInputDataAndDetectChanges(data);
  }

  function checkAccordionItemCollapsed(
    item: DOMTestHelper<ViewerSearchComponent>,
  ) {
    item.get(accordionItemSelector).checkText('chevron_right');
    expect(item.find('.accordion-item-body')).toBeUndefined();
  }

  function checkAccordionItemExpanded(
    item: DOMTestHelper<ViewerSearchComponent>,
  ) {
    item.get(accordionItemSelector).checkText('arrow_drop_down');
    expect(item.find('.accordion-item-body')).toBeDefined();
  }

  async function checkDocsLink(
    link: DOMTestHelper<ViewerSearchComponent>,
    index: number,
  ) {
    expect(link.getHTMLElement().getAttribute('href')).toEqual(
      SEARCH_VIEWS[index].docsUrl,
    );
    await link.get('.open-docs-icon').checkTooltip('Open full documentation');
  }

  function updateInputDataAndDetectChanges(data: UiData) {
    dom.setComponentInput('inputData', data);
    dom.detectChanges();
  }
});

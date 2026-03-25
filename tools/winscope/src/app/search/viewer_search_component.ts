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

import {CdkAccordionItem, CdkAccordionModule} from '@angular/cdk/accordion';
import {CdkMenuModule} from '@angular/cdk/menu';
import {CommonModule} from '@angular/common';
import {ChangeDetectorRef, Component, effect, ElementRef, HostListener, Inject, output, TemplateRef, viewChild, viewChildren,} from '@angular/core';
import {FormControl, FormsModule, ReactiveFormsModule, ValidationErrors, Validators,} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTabChangeEvent, MatTabGroup, MatTabsModule,} from '@angular/material/tabs';
import {MatTooltipModule} from '@angular/material/tooltip';
import {CollapsedSectionsComponent} from '@app/shared/collapsible_sections/collapsed_sections_component';
import {CollapsibleSectionTitleComponent} from '@app/shared/collapsible_sections/collapsible_section_title_component';
import {LogComponent} from '@app/shared/log_view/log_component';
import {ViewerComponent} from '@app/shared/viewers/viewer_component';
import {assertDefined} from '@common/assert';
import {downloadFromUrl} from '@common/download';
import {Timestamp} from '@common/time/time';
import {TimeDuration} from '@common/time/time_duration';
import {TIME_UNIT_TO_NANO} from '@common/time/time_units';
import {Analytics} from '@logging/analytics';
import {UserNotifier} from '@services/user_notifier';
import {CurrentSearch, ListedSearch, UiData} from '@ui/search/ui_data';
import {CollapsibleSectionType} from '@ui/shared/collapsible_sections/collapsible_section_type';
import {CollapsibleSections} from '@ui/shared/collapsible_sections/collapsible_sections';
import {ClickableProperty} from '@ui/shared/log/ui_data_log';
import {LogFilterChangeDetail, LogTextFilterChangeDetail, SaveQueryClickDetail, SearchQueryClickDetail, TimestampClickDetail,} from '@ui/shared/viewers/viewer_event_details';
import {makeWarningExportTooLarge, makeWarningFailedToExportToCsv, makeWarningNoResultsToExport,} from '@ui/trace_loading/warnings';

import {ActiveSearchComponent} from './active_search_component';
import {ListItemOption, SearchListComponent} from './search_list_component';
import {SEARCH_VIEWS} from './trace_search_initializer';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    CollapsedSectionsComponent,
    CollapsibleSectionTitleComponent,
    LogComponent,
    ActiveSearchComponent,
    SearchListComponent,
    MatFormFieldModule,
    MatInputModule,
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
  ],
  selector: 'viewer-search',
  templateUrl: './viewer_search_component.ng.html',
  styleUrls: ['./viewer_search_component.scss'],
})
export class ViewerSearchComponent extends ViewerComponent<UiData> {
  saveQueryField = viewChild<TemplateRef<unknown>>('saveQueryField');
  globalSearchTitle = viewChild<ElementRef<HTMLElement>>('globalSearchTitle');
  matTabGroups = viewChildren(MatTabGroup);
  activeSearchComponents = viewChildren(ActiveSearchComponent);

  readonly onLogFilterChange = output<{
    detail: LogFilterChangeDetail;
    uid: number;
  }>();
  readonly onLogTextFilterChange = output<{
    detail: LogTextFilterChangeDetail;
    uid: number;
  }>();
  readonly onLogEntryClick = output<{detail: number; uid: number}>();
  readonly onResultTimestampClick = output<{
    detail: TimestampClickDetail;
    uid: number;
  }>();
  readonly onArrowDownPress = output<number>();
  readonly onArrowUpPress = output<number>();

  readonly globalSearchSectionClick = output<void>();
  readonly searchQueryChange = output<SearchQueryClickDetail>();
  readonly saveQuery = output<SaveQueryClickDetail>();
  readonly clearQueryChange = output<number>();
  readonly addQueryChange = output<string | undefined>();
  readonly deleteSavedQuery = output<ListedSearch>();

  sections = new CollapsibleSections([
    {
      type: CollapsibleSectionType.GLOBAL_SEARCH,
      label: CollapsibleSectionType.GLOBAL_SEARCH,
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.SEARCH_RESULTS,
      label: CollapsibleSectionType.SEARCH_RESULTS,
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.HOW_TO_SEARCH,
      label: CollapsibleSectionType.HOW_TO_SEARCH,
      isCollapsed: false,
    },
  ]);
  searchSections: SearchSection[] = [];
  initializing = false;
  menuSaveQueryNameControl = this.makeSaveQueryNameControl();
  runningQueryUid: number | undefined;

  private runFromOptions = false;
  private editFromOptions = false;
  private globalSearchTitleHeight = 48;

  private currentSearches: CurrentSearch[] | undefined = [];

  private readonly editOption: ListItemOption = {
    name: 'Edit',
    icon: 'edit',
    onClickCallback: (search: ListedSearch) => {
      this.onEditQueryClick(search);
    },
  };
  private readonly saveOption: ListItemOption = {
    name: 'Save',
    icon: 'save',
  };
  readonly savedSearchOptions: ListItemOption[] = [
    {
      name: 'Run',
      icon: 'play_arrow',
      onClickCallback: (search: ListedSearch) => {
        Analytics.TraceSearch.logQueryRequested('saved');
        this.onRunQueryFromOptionsClick(search);
      },
    },
    this.editOption,
    {
      name: 'Delete',
      icon: 'delete',
      onClickCallback: (search: ListedSearch) => {
        this.onDeleteQueryClick(search);
      },
    },
  ];
  readonly recentSearchOptions: ListItemOption[] = [
    {
      name: 'Run',
      icon: 'play_arrow',
      onClickCallback: (search: ListedSearch) => {
        Analytics.TraceSearch.logQueryRequested('recent');
        this.onRunQueryFromOptionsClick(search);
      },
    },
    this.editOption,
    this.saveOption,
  ];
  readonly globalSearchText = `
     Write an SQL query in the field below, and run the search. \
     Results will be shown in a tabular view and you can optionally visualize them in the timeline. \
  `;
  readonly SEARCH_VIEWS = SEARCH_VIEWS;

  constructor(
    @Inject(ElementRef) elementRef: ElementRef<HTMLElement>,
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
  ) {
    super(elementRef);

    effect(() => {
      const data = this.inputData();
      if (this.initializing && data?.initialized) {
        this.initializing = false;
      }
      this.updateSearchSections();
      if (this.tryPropagateRunFromOptions()) {
        return;
      }
      this.tryHandleQueryCompleted();
    });
  }

  ngAfterViewInit() {
    this.globalSearchTitleHeight =
      this.globalSearchTitle()?.nativeElement.clientHeight ?? 48;
    this.saveOption.menu = this.saveQueryField();
    this.changeDetectorRef.detectChanges();
  }

  ngAfterContentChecked() {
    this.tryPropagateEditFromOptions();
  }

  onGlobalSearchClick() {
    if (!this.initializing && !this.inputData()?.initialized) {
      this.initializing = true;
      this.globalSearchSectionClick.emit();
    }
  }

  searchQuery(query: string, uid: number) {
    this.runningQueryUid = uid;
    const section = assertDefined(
      this.searchSections.find((s) => s.uid === uid),
    );
    section.lastQueryExecutionTime = undefined;
    section.lastQueryStartTime = Date.now();
    this.searchQueryChange.emit(new SearchQueryClickDetail(query, uid));
  }

  onSaveQueryClick(query: string, control: FormControl) {
    if (control.invalid) {
      return;
    }
    this.saveQuery.emit(
      new SaveQueryClickDetail(query, assertDefined(control.value)),
    );
    Analytics.TraceSearch.logQuerySaved();
    control.reset();
  }

  onHeaderClick(accordionItem: CdkAccordionItem) {
    accordionItem.toggle();
  }

  clearQuery(uid: number) {
    this.clearQueryChange.emit(uid);
  }

  addQuery(query?: string) {
    this.addQueryChange.emit(query);
  }

  getCurrentSearchesWithResults(): CurrentSearch[] {
    return assertDefined(this.inputData()).currentSearches.filter(
      (search) => search.result !== undefined,
    );
  }

  getCurrentSearchByUid(uid: number): CurrentSearch | undefined {
    return this.inputData()?.currentSearches.find(
      (search) => search.uid === uid,
    );
  }

  getExecutedQueryForSearchSection(uid: number): string | undefined {
    return this.runningQueryUid !== uid
      ? this.getCurrentSearchByUid(uid)?.query
      : undefined;
  }

  getQueryLabel(uid: number): string {
    return 'Query ' + uid;
  }

  showResultsPlaceholder(): boolean {
    return (
      this.runningQueryUid === undefined &&
      this.getCurrentSearchesWithResults().length === 0
    );
  }

  onSearchTabChanged() {
    const activeSearchComponents = this.activeSearchComponents();
    const finalComponent = activeSearchComponents.at(
      activeSearchComponents.length - 1,
    );
    if (this.matTabGroups().at(0)?.selectedIndex === 0) {
      finalComponent?.elementRef.nativeElement.scrollIntoView();
    }
  }

  getTabsHeight(): string {
    return 'calc(100% - ' + this.globalSearchTitleHeight + 'px)';
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.globalSearchTitleHeight =
      this.globalSearchTitle()?.nativeElement.clientHeight ?? 48;
    this.changeDetectorRef.detectChanges();
  }

  onResultTabChange(event: MatTabChangeEvent) {
    const res = this.getCurrentSearchesWithResults().at(event.index)?.result;
    if (!res) {
      return;
    }
    res.checkScrollViewportCount++;
  }

  exportToCsv(search: CurrentSearch, download = downloadFromUrl) {
    try {
      const result = search.result;
      if (result == null) return;

      if (result.entries.length === 0) {
        UserNotifier.add(makeWarningNoResultsToExport()).notify();
        return;
      }

      const MAX_ROWS = 100000;
      if (result.entries.length > MAX_ROWS) {
        UserNotifier.add(makeWarningExportTooLarge(MAX_ROWS)).notify();
        return;
      }

      const headers = result.headers.map((h) => this.escapeCsv(h.spec.name));
      const rows = result.entries.map((entry) => {
        return entry.fields.map((field) => {
          const value = field.value;
          if (value instanceof Timestamp) {
            return this.escapeCsv(value.format());
          }
          if (Array.isArray(value)) {
            const stringValue = value
              .map((item) => {
                if (
                  typeof item === 'object' &&
                  item !== null &&
                  'propertyValue' in item
                ) {
                  return (item as ClickableProperty).propertyValue;
                }
                return String(item);
              })
              .join(', ');
            return this.escapeCsv(stringValue);
          }
          return this.escapeCsv(String(value ?? ''));
        });
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((r) => r.join(',')),
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      download(url, `search_results_${search.uid}.csv`);
      Analytics.TraceSearch.logQueryExportedToCsv();
    } catch (e) {
      UserNotifier.add(
        makeWarningFailedToExportToCsv(e instanceof Error ? e.message : ''),
      ).notify();
      Analytics.TraceSearch.logQueryExportFailed();
    }
  }

  private escapeCsv(value: string): string {
    if (
      value.includes(',') ||
      value.includes('"') ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private updateSearchSections() {
    const currentSearches = this.inputData()?.currentSearches;
    const previousSearches: CurrentSearch[] | undefined = this.currentSearches;
    currentSearches?.forEach((search) => {
      if (!this.searchSections.some((s) => s.uid === search.uid)) {
        this.searchSections.push({
          uid: search.uid,
          saveQueryNameControl: this.makeSaveQueryNameControl(),
        });
      }
    });
    previousSearches?.forEach((search) => {
      if (!currentSearches?.some((curr) => curr.uid === search.uid)) {
        const i = this.searchSections.findIndex((a) => a.uid === search.uid);
        this.searchSections.splice(i, 1);
      }
    });
    this.currentSearches = currentSearches;
  }

  private tryPropagateRunFromOptions(): boolean {
    const inputData = this.inputData();
    if (
      this.runFromOptions &&
      this.runningQueryUid === undefined &&
      inputData?.currentSearches
    ) {
      const lastSearch =
        inputData.currentSearches[inputData.currentSearches.length - 1];
      this.searchQuery(assertDefined(lastSearch.query), lastSearch.uid);
      this.runFromOptions = false;
      return true;
    }
    return false;
  }

  private tryPropagateEditFromOptions() {
    if (this.editFromOptions) {
      const currentSearches = assertDefined(this.inputData()).currentSearches;
      const activeSearchComponents = this.activeSearchComponents();
      if (currentSearches.length !== activeSearchComponents?.length) {
        return;
      }
      const lastSearch = currentSearches[currentSearches.length - 1];
      if (lastSearch.query) {
        this.updateLastSectionTextAndShowTab(lastSearch.query);
        this.editFromOptions = false;
      }
    }
  }

  private updateLastSectionTextAndShowTab(text: string) {
    assertDefined(
      this.activeSearchComponents().at(this.searchSections.length - 1),
    ).updateText(text);
    assertDefined(this.matTabGroups())[0].selectedIndex = 0;
  }

  private tryHandleQueryCompleted() {
    const currentSearch =
      this.runningQueryUid !== undefined
        ? this.getCurrentSearchByUid(this.runningQueryUid)
        : undefined;

    if (this.runningQueryUid !== undefined && currentSearch !== undefined) {
      const sectionIndex = this.searchSections.findIndex(
        (s) => s.uid === this.runningQueryUid,
      );
      const section = this.searchSections[sectionIndex];

      if (!this.inputData()?.lastTraceFailed) {
        this.activeSearchComponents()
          ?.at(sectionIndex)
          ?.updateText(currentSearch?.query ?? '');
        section.saveQueryNameControl.setValue(
          this.getQueryLabel(assertDefined(this.runningQueryUid)),
        );
        const matTabGroups = this.matTabGroups();
        matTabGroups[matTabGroups.length - 1].selectedIndex = sectionIndex;
      }

      const executionTimeMs =
        Date.now() - assertDefined(section.lastQueryStartTime);
      Analytics.TraceSearch.logQueryExecutionTime(executionTimeMs);
      section.lastQueryExecutionTime = new TimeDuration(
        BigInt(executionTimeMs) * TIME_UNIT_TO_NANO.ms,
      ).format();
      section.lastQueryStartTime = undefined;

      this.runningQueryUid = undefined;
    }
  }

  private onRunQueryFromOptionsClick(search: ListedSearch) {
    const lastUid = this.getLastUid();
    if (this.getCurrentSearchByUid(lastUid)?.result) {
      this.runFromOptions = true;
      this.addQuery(search.query);
    } else {
      this.searchQuery(search.query, lastUid);
    }
  }

  private getLastUid(): number {
    return this.searchSections[this.searchSections.length - 1].uid;
  }

  private onEditQueryClick(search: ListedSearch) {
    const currentSearches = assertDefined(this.inputData()).currentSearches;
    const lastCurrentSearch = currentSearches[currentSearches.length - 1];
    if (lastCurrentSearch.result !== undefined) {
      this.editFromOptions = true;
      this.addQuery(search.query);
      return;
    }
    this.updateLastSectionTextAndShowTab(search.query);
  }

  private onDeleteQueryClick(search: ListedSearch) {
    this.deleteSavedQuery.emit(search);
  }

  private makeSaveQueryNameControl() {
    return new FormControl(
      '',
      assertDefined(
        Validators.compose([
          Validators.required,
          (control: FormControl) =>
            this.validateSearchQuerySaveName(
              control,
              this.inputData()?.savedSearches ?? [],
            ),
        ]),
      ),
    );
  }

  private validateSearchQuerySaveName(
    control: FormControl,
    savedSearches: ListedSearch[],
  ): ValidationErrors | null {
    const valid =
      control.value &&
      !savedSearches.some((search) => search.name === control.value);
    return !valid ? {invalidInput: control.value} : null;
  }
}

interface SearchSection {
  uid: number;
  saveQueryNameControl: FormControl;
  lastQueryExecutionTime?: string;
  lastQueryStartTime?: number;
}

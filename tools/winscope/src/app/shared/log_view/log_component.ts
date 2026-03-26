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

import {ClipboardModule} from '@angular/cdk/clipboard';
import {SelectionModel} from '@angular/cdk/collections';
import {CdkMenuModule} from '@angular/cdk/menu';
import {ScrollingModule} from '@angular/cdk/scrolling';
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, ElementRef, HostListener, Inject, input, output, viewChild, viewChildren,} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSelectChange} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {CollapsibleSectionTitleComponent} from '@app/shared/collapsible_sections/collapsible_section_title_component';
import {ItemHeightPredictor} from '@app/shared/scroll/item_height_predictor';
import {VirtualRow, VirtualScrollViewportComponent,} from '@app/shared/scroll/virtual_scroll_viewport_component';
import {SearchBoxComponent} from '@app/shared/search_box/search_box_component';
import {assertDefined} from '@common/assert';
import {isElementOverflowing, isElementVisible, KeyboardEventKey,} from '@common/dom';
import {Timestamp} from '@common/time/time';
import {Timer} from '@common/time/timer';
import {LogFilter, LogSelectFilter, LogTextFilter,} from '@ui/shared/log/log_filters';
import {ClickableProperty, LogEntry, LogField, LogFieldValue, LogHeader,} from '@ui/shared/log/ui_data_log';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {LogFilterChangeDetail, LogTextFilterChangeDetail, TimestampClickDetail,} from '@ui/shared/viewers/viewer_event_details';

import {SelectWithFilterComponent} from './select_with_filter_component';

@Component({
  selector: 'log-view',
  standalone: true,
  imports: [
    CommonModule,
    ScrollingModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    ClipboardModule,
    CollapsibleSectionTitleComponent,
    SelectWithFilterComponent,
    SearchBoxComponent,
    VirtualScrollViewportComponent,
    VirtualRow,
    CdkMenuModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './log_component.ng.html',
  styleUrls: ['./log_component.scss'],
})
export class LogComponent {
  Array = Array;

  headers = input.required<LogHeader[]>();
  entries = input.required<LogEntry[]>();

  title = input<string>();
  selectedIndex = input<number>();
  scrollToIndex = input<number>();
  currentIndex = input<number>();
  showTimeControls = input<boolean>(true);
  showTraceEntryTimes = input<boolean>(true);
  padEntries = input<boolean>(true);
  isFetchingData = input<boolean>(false);
  checkScrollViewportCount = input<number>(0);
  heightPredictor = input<ItemHeightPredictor<unknown>>(
    new ItemHeightPredictor(this.elementRef, (index: number) => {
      return this.entries().at(index);
    }),
  );

  readonly areMultipleDatesPresent = computed<boolean>(() => {
    return (
      this.entries().at(0)?.traceEntry.getFullTrace().spansMultipleDates() ??
      false
    );
  });

  readonly isRowVisible = (index: number) => {
    return this.virtualScrollViewport()?.isIndexVisible(index) ?? false;
  };

  readonly collapseButtonClicked = output();
  readonly logFilterChange = output<LogFilterChangeDetail>();
  readonly logTextFilterChange = output<LogTextFilterChangeDetail>();
  readonly logEntryClick = output<number>();
  readonly timestampClick = output<TimestampClickDetail>();
  readonly arrowDownPress = output();
  readonly arrowUpPress = output();

  readonly virtualScrollViewport =
    viewChild.required<VirtualScrollViewportComponent>('logContainer');
  readonly selectFilters = viewChildren(SelectWithFilterComponent);

  readonly textSelection = new SelectionModel<LogEntry>(false, []);

  private lastClickedTimestamp: Timestamp | undefined;

  constructor(
    @Inject(ElementRef) private readonly elementRef: ElementRef<HTMLElement>,
    @Inject(ChangeDetectorRef)
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {
    effect(() => {
      if (this.checkScrollViewportCount() > 0) {
        this.virtualScrollViewport().checkViewportSize();
      }
    });

    effect(() => {
      const scrollToIndex = this.scrollToIndex();
      const entries = this.entries();
      if (
        scrollToIndex !== undefined &&
        this.lastClickedTimestamp !==
          entries.at(scrollToIndex)?.traceEntry.getTimestamp()
      ) {
        // scroll previous index to top, so when previous index is partially
        // rendered the target index is still fully rendered
        this.virtualScrollViewport().scrollToIndex(
          Math.max(0, scrollToIndex - 1),
        );

        this.textSelection.clear();
        this.textSelection.toggle(entries[scrollToIndex]);
      }
    });
  }

  onVisibleRangeChanged() {
    this.changeDetectorRef.markForCheck();
  }

  disableHeaderTooltip(header: HTMLElement): boolean {
    return !isElementOverflowing(header);
  }

  isClickableArray(value: LogFieldValue): boolean {
    return Array.isArray(value);
  }

  isString(item: string | ClickableProperty) {
    return typeof item === 'string';
  }

  showFieldButton(entry: LogEntry, field: LogField): boolean {
    const propagateEntryTimestamp =
      !!field.propagateEntryTimestamp && entry.traceEntry.hasValidTimestamp();
    return field.value instanceof Timestamp || propagateEntryTimestamp;
  }

  getFieldClass(field: LogField, index: number): string {
    return (
      field.spec.cssClass + ' cell' + (index % 2 === 0 ? ' alt-background' : '')
    );
  }

  async ngAfterContentInit() {
    await new Timer(10, 10).sleepMs();
    this.updateTableMarginEnd();
  }

  @HostListener('window:resize', ['$event'])
  onResize(_: Event) {
    this.updateTableMarginEnd();
    this.virtualScrollViewport().checkViewportSize();
  }

  onFilterChange(event: MatSelectChange, header: LogHeader) {
    this.logFilterChange.emit(new LogFilterChangeDetail(header, event.value));
  }

  onSearchBoxChange(detail: TextFilter, header: LogHeader) {
    this.logTextFilterChange.emit(
      new LogTextFilterChangeDetail(header, detail),
    );
  }

  onEntryClicked(index: number) {
    const clickedEntry = assertDefined(this.entries()[index]);
    this.textSelection.clear();
    this.textSelection.toggle(clickedEntry);
    this.logEntryClick.emit(index);
  }

  onGoToFirstEntryClick() {
    const firstEntry = this.entries().at(0);
    if (firstEntry) {
      this.virtualScrollViewport().scrollToIndex(0);
      this.timestampClick.emit(new TimestampClickDetail(firstEntry.traceEntry));
      this.textSelection.clear();
      this.textSelection.toggle(firstEntry);
    }
  }

  onGoToCurrentEntryClick() {
    const currentIndex = this.currentIndex();
    if (currentIndex !== undefined) {
      this.virtualScrollViewport().scrollToIndex(currentIndex);
      this.textSelection.clear();
      this.textSelection.toggle(this.entries()[currentIndex]);
    }
  }

  onGoToLastEntryClick() {
    const entries = this.entries();
    const lastIndex = entries.length - 1;
    const lastEntry = entries.at(lastIndex);
    if (lastEntry) {
      this.virtualScrollViewport().scrollToIndex(lastIndex);
      this.timestampClick.emit(new TimestampClickDetail(lastEntry.traceEntry));
      this.textSelection.clear();
      this.textSelection.toggle(lastEntry);
    }
  }

  onTraceEntryTimestampClick(event: MouseEvent, entry: LogEntry) {
    event.stopPropagation();
    this.lastClickedTimestamp = entry.traceEntry.getTimestamp();
    this.timestampClick.emit(new TimestampClickDetail(entry.traceEntry));
  }

  onFieldButtonClick(event: MouseEvent, entry: LogEntry, field: LogField) {
    event.stopPropagation();
    if (field.propagateEntryTimestamp) {
      this.onTraceEntryTimestampClick(event, entry);
    } else if (field.value instanceof Timestamp) {
      this.onRawTimestampClick(field.value as Timestamp);
    }
  }

  @HostListener('document:keydown', ['$event'])
  async handleKeyboardEvent(event: KeyboardEvent) {
    const logComponentVisible = isElementVisible(this.elementRef.nativeElement);
    if (event.key === KeyboardEventKey.ARROW_DOWN && logComponentVisible) {
      event.stopPropagation();
      event.preventDefault();
      this.arrowDownPress.emit();
    }
    if (event.key === KeyboardEventKey.ARROW_UP && logComponentVisible) {
      event.stopPropagation();
      event.preventDefault();
      this.arrowUpPress.emit();
    }
    const selectedIndex = this.selectedIndex();
    if (
      event.key === KeyboardEventKey.ENTER &&
      logComponentVisible &&
      selectedIndex !== undefined
    ) {
      event.stopPropagation();
      event.preventDefault();
      this.timestampClick.emit(
        new TimestampClickDetail(this.entries()[selectedIndex].traceEntry),
      );
    }
  }

  isCurrentEntry(index: number): boolean {
    return index === this.currentIndex();
  }

  isSelectedEntry(index: number): boolean {
    return index === this.selectedIndex();
  }

  updateTableMarginEnd() {
    const tableHeader =
      this.elementRef.nativeElement.querySelector<HTMLElement>('.table-header');
    if (!tableHeader) {
      return;
    }
    const el = this.virtualScrollViewport().elementRef.nativeElement;
    if (el && el.scrollHeight > el.offsetHeight) {
      tableHeader.style.marginInlineEnd =
        el.offsetWidth - el.scrollWidth + 'px';
    } else {
      tableHeader.style.marginInlineEnd = '';
    }
  }

  isLogSelectFilter(filter: LogFilter): filter is LogSelectFilter {
    return filter instanceof LogSelectFilter;
  }

  isLogTextFilter(filter: LogFilter): filter is LogTextFilter {
    return filter instanceof LogTextFilter;
  }

  @HostListener('document:copy', ['$event'])
  onDocumentCopy(event: ClipboardEvent) {
    const componentElement = this.elementRef.nativeElement;
    const logComponentVisible = isElementVisible(componentElement);

    if (!logComponentVisible) {
      return;
    }

    if (this.entries()[0].formatForClipboard === undefined) {
      return;
    }

    const isCopyInsideLogComponent = componentElement.contains(
      event.target as Node,
    );
    if (!isCopyInsideLogComponent) {
      return;
    }

    const browserSelection = window.getSelection();
    let entriesFromBrowserSelection: LogEntry[] = [];
    let isTextSelection = false;

    if (browserSelection && browserSelection.rangeCount > 0) {
      const range = browserSelection.getRangeAt(0);

      if (!range.collapsed) {
        if (
          componentElement.contains(range.startContainer) ||
          componentElement.contains(range.endContainer) ||
          range.intersectsNode(componentElement)
        ) {
          entriesFromBrowserSelection =
            this.getEntriesFromBrowserSelection(range);

          if (entriesFromBrowserSelection.length > 0) {
            isTextSelection = true;
          }
        }
      }
    }

    if (isTextSelection) {
      this.performCustomCopy(event, entriesFromBrowserSelection);
      return;
    }

    if (this.textSelection.hasValue()) {
      this.performCustomCopy(event, this.textSelection.selected);
      return;
    }
  }

  findSelectFilterComponent(
    field: LogField,
  ): SelectWithFilterComponent | undefined {
    const filter = this.selectFilters().find(
      (f) => f.label() === field.spec.name,
    );
    if (!filter || filter.disabled()) {
      return undefined;
    }
    return filter;
  }

  setFilterSingleValue(filter: SelectWithFilterComponent, value: string) {
    filter.value.set([value]);
  }

  excludeFromFilter(filter: SelectWithFilterComponent, value: string) {
    filter.value.set(filter.options().filter((o) => o !== value));
  }

  private onRawTimestampClick(value: Timestamp) {
    this.timestampClick.emit(new TimestampClickDetail(undefined, value));
  }

  private getEntriesFromBrowserSelection(range: Range): LogEntry[] {
    const selectedEntries: LogEntry[] = [];
    const entryElements =
      this.elementRef.nativeElement.querySelectorAll('.entry');

    entryElements.forEach((entryElement) => {
      if (range.intersectsNode(entryElement)) {
        const itemIdStr = entryElement.getAttribute('item-id');
        if (itemIdStr !== null) {
          const absoluteIndex = Number(itemIdStr);
          const entries = this.entries();
          if (!isNaN(absoluteIndex) && entries[absoluteIndex]) {
            selectedEntries.push(entries[absoluteIndex]);
          }
        }
      }
    });

    return selectedEntries;
  }

  private performCustomCopy(event: ClipboardEvent, entriesToCopy: LogEntry[]) {
    if (entriesToCopy.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const clipboardText = this.formatEntriesForClipboard(entriesToCopy);

    if (event.clipboardData) {
      event.clipboardData.setData('text/plain', clipboardText);
    }
  }

  private formatEntriesForClipboard(entries: LogEntry[]): string {
    const timeOnly = !this.areMultipleDatesPresent();
    return entries
      .map((entry) => {
        return entry.formatForClipboard?.(timeOnly) ?? '';
      })
      .join('\n');
  }
}

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
import {
  CdkVirtualScrollViewport,
  ScrollingModule,
} from '@angular/cdk/scrolling';
import {CommonModule} from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSelectChange} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';

import {
  isElementOverflowing,
  isElementVisible,
  KeyboardEventKey,
} from '@common/dom';
import {Timestamp} from '@common/time/time';
import {Timer} from '@common/time/timer';
import {TraceType} from '@trace_api/trace_type';
import {TextFilter} from '@viewers/common/text_filter';
import {
  LogEntry,
  LogField,
  LogFieldValue,
  LogHeader,
  ClickableProperty,
} from '@viewers/common/ui_data_log';
import {VariableHeightScrollDirective} from '@viewers/common/variable_height_scroll_directive';
import {
  LogFilterChangeDetail,
  LogTextFilterChangeDetail,
  TimestampClickDetail,
  ViewerEvents,
} from '@viewers/common/viewer_events';
import {CollapsibleSectionTitleComponent} from '@viewers/components/collapsible_section_title_component';
import {SearchBoxComponent} from '@viewers/components/search_box_component';
import {SelectWithFilterComponent} from '@viewers/components/select_with_filter_component';
import {assertDefined} from '@common/assert';
import {UserTimestamp} from '@common/time/user_timestamp';
import {
  LogFilter,
  LogSelectFilter,
  LogTextFilter,
} from '@viewers/common/log_filters';
import {SelectionModel} from '@angular/cdk/collections';
import {CdkMenuModule} from '@angular/cdk/menu';

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
    VariableHeightScrollDirective,
    CdkMenuModule,
  ],
  templateUrl: './log_component.ng.html',
  styleUrls: ['./log_component.css'],
})
export class LogComponent {
  emptyFilterValue = '';

  private lastClickedTimestamp: Timestamp | undefined;
  private menuEntered = false;

  readonly textSelection = new SelectionModel<LogEntry>(false, []);

  @Input() title: string | undefined;
  @Input() selectedIndex: number | undefined;
  @Input() scrollToIndex: number | undefined;
  @Input() currentIndex: number | undefined;
  @Input() headers: LogHeader[] = [];
  @Input() entries: LogEntry[] = [];
  @Input() showTimeControls = true;
  @Input() traceType: TraceType | undefined;
  @Input() showTraceEntryTimes = true;
  @Input() padEntries = true;
  @Input() isFetchingData = false;
  @Input() checkScrollViewportCount = 0;

  @Output() collapseButtonClicked = new EventEmitter();

  @ViewChild(CdkVirtualScrollViewport)
  scrollComponent?: CdkVirtualScrollViewport;

  constructor(
    @Inject(ElementRef) private readonly elementRef: ElementRef<HTMLElement>,
  ) {}

  isHeaderWithFilter(header: LogHeader): boolean {
    return header.filter !== undefined;
  }

  disableHeaderTooltip(header: HTMLElement): boolean {
    return !isElementOverflowing(header);
  }

  isClickableArray(value: LogFieldValue): boolean {
    return Array.isArray(value);
  }

  isString(item: LogFieldValue) {
    return typeof item === 'string';
  }

  showFieldButton(entry: LogEntry, field: LogField): boolean {
    const propagateEntryTimestamp =
      !!field.propagateEntryTimestamp && entry.traceEntry.hasValidTimestamp();
    return field.value instanceof Timestamp || propagateEntryTimestamp;
  }

  formatFieldButton(field: string | number | Timestamp): string | number {
    return field instanceof Timestamp ? this.formatTimestamp(field) : field;
  }

  areMultipleDatesPresent(): boolean {
    return (
      this.entries.at(0)?.traceEntry.getFullTrace().spansMultipleDates() ??
      false
    );
  }

  getFieldClass(field: LogField, index: number): string {
    return (
      field.spec.cssClass + ' cell' + (index % 2 === 0 ? ' alt-background' : '')
    );
  }

  formatTimestamp(timestamp: Timestamp) {
    if (!this.areMultipleDatesPresent()) {
      const fmtTime = timestamp.format();
      const parsedTime = new UserTimestamp(fmtTime).extractTime();
      if (!parsedTime) {
        return fmtTime;
      }
      return assertDefined(parsedTime);
    }
    return timestamp.format();
  }

  ngOnChanges(simpleChanges: SimpleChanges) {
    if (simpleChanges['checkScrollViewportCount']?.currentValue) {
      this.scrollComponent?.checkViewportSize();
    }
    if (
      this.scrollToIndex !== undefined &&
      this.lastClickedTimestamp !==
        this.entries.at(this.scrollToIndex)?.traceEntry.getTimestamp()
    ) {
      // scroll previous index to top, so when previous index is partially
      // rendered the target index is still fully rendered
      this.scrollComponent?.scrollToIndex(Math.max(0, this.scrollToIndex - 1));

      this.textSelection.clear();
      this.textSelection.toggle(this.entries[this.scrollToIndex]);
    }
  }

  async ngAfterContentInit() {
    await new Timer(10, 10).sleepMs();
    this.updateTableMarginEnd();
  }

  @HostListener('window:resize', ['$event'])
  onResize(_: Event) {
    this.updateTableMarginEnd();
    this.scrollComponent?.checkViewportSize();
  }

  onFilterChange(event: MatSelectChange, header: LogHeader) {
    this.emitEvent(
      ViewerEvents.LogFilterChange,
      new LogFilterChangeDetail(header, event.value),
    );
  }

  onSearchBoxChange(detail: TextFilter, header: LogHeader) {
    this.emitEvent(
      ViewerEvents.LogTextFilterChange,
      new LogTextFilterChangeDetail(header, detail),
    );
  }

  onEntryClicked(index: number) {
    const clickedEntry = assertDefined(this.entries[index]);
    this.textSelection.clear();
    this.textSelection.toggle(clickedEntry);
    this.emitEvent(ViewerEvents.LogEntryClick, index);
  }

  onGoToFirstEntryClick() {
    const firstEntry = this.entries.at(0);
    if (firstEntry) {
      this.scrollComponent?.scrollToIndex(0);
      this.emitEvent(
        ViewerEvents.TimestampClick,
        new TimestampClickDetail(firstEntry.traceEntry),
      );
      this.textSelection.clear();
      this.textSelection.toggle(firstEntry);
    }
  }

  onGoToCurrentEntryClick() {
    if (this.currentIndex !== undefined && this.scrollComponent) {
      this.scrollComponent.scrollToIndex(this.currentIndex);
      this.textSelection.clear();
      this.textSelection.toggle(this.entries[this.currentIndex]);
    }
  }

  onGoToLastEntryClick() {
    const lastIndex = this.entries.length - 1;
    const lastEntry = this.entries.at(lastIndex);
    if (lastEntry) {
      this.scrollComponent?.scrollToIndex(lastIndex);
      this.emitEvent(
        ViewerEvents.TimestampClick,
        new TimestampClickDetail(lastEntry.traceEntry),
      );
      this.textSelection.clear();
      this.textSelection.toggle(lastEntry);
    }
  }

  onTraceEntryTimestampClick(event: MouseEvent, entry: LogEntry) {
    event.stopPropagation();
    this.lastClickedTimestamp = entry.traceEntry.getTimestamp();
    this.emitEvent(
      ViewerEvents.TimestampClick,
      new TimestampClickDetail(entry.traceEntry),
    );
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
      this.emitEvent(ViewerEvents.ArrowDownPress);
    }
    if (event.key === KeyboardEventKey.ARROW_UP && logComponentVisible) {
      event.stopPropagation();
      event.preventDefault();
      this.emitEvent(ViewerEvents.ArrowUpPress);
    }
    if (
      event.key === KeyboardEventKey.ENTER &&
      logComponentVisible &&
      this.selectedIndex !== undefined
    ) {
      event.stopPropagation();
      event.preventDefault();
      this.emitEvent(
        ViewerEvents.TimestampClick,
        new TimestampClickDetail(this.entries[this.selectedIndex].traceEntry),
      );
    }
  }

  isCurrentEntry(index: number): boolean {
    return index === this.currentIndex;
  }

  isSelectedEntry(index: number): boolean {
    return this.selectedIndex === index;
  }

  isFixedSizeScrollViewport() {
    return this.traceType === TraceType.CUJS;
  }

  updateTableMarginEnd() {
    const tableHeader =
      this.elementRef.nativeElement.querySelector<HTMLElement>('.table-header');
    if (!tableHeader) {
      return;
    }
    const el = this.scrollComponent?.elementRef.nativeElement;
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

    if (this.traceType !== TraceType.PROTO_LOG) {
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

  private onRawTimestampClick(value: Timestamp) {
    this.emitEvent(
      ViewerEvents.TimestampClick,
      new TimestampClickDetail(undefined, value),
    );
  }

  private emitEvent(event: ViewerEvents, data?: object | number) {
    const customEvent = new CustomEvent(event, {
      bubbles: true,
      detail: data,
    });
    this.elementRef.nativeElement.dispatchEvent(customEvent);
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
          if (!isNaN(absoluteIndex) && this.entries[absoluteIndex]) {
            selectedEntries.push(this.entries[absoluteIndex]);
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
    if (entries.length === 0) {
      return '';
    }

    const formattedLines = entries.map((entry) => {
      const timestamp = this.formatTimestamp(entry.traceEntry.getTimestamp());

      const fieldValues = entry.fields.map((field) => {
        const value = field.value;
        let stringValue: string;

        if (value === null || value === undefined) {
          stringValue = ' ';
        } else if (Array.isArray(value)) {
          stringValue = value
            .map((item) => {
              if (
                typeof item === 'object' &&
                item !== null &&
                'propertyValue' in item
              ) {
                return String((item as ClickableProperty).propertyValue);
              }
              return String(item ?? '');
            })
            .join(', ');
        } else if (value instanceof Timestamp) {
          stringValue = this.formatTimestamp(value);
        } else {
          stringValue = String(value);
        }

        return stringValue.replace(/\n/g, '\t');
      });

      const allColumns = [timestamp, ...fieldValues];

      return allColumns.join('\t');
    });

    return formattedLines.join('\n');
  }
}

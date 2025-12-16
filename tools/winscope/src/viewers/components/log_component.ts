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
  ],
  templateUrl: './log_component.ng.html',
  styleUrls: ['./log_component.css'],
})
export class LogComponent {
  emptyFilterValue = '';
  private lastClickedTimestamp: Timestamp | undefined;

  @Input() title: string | undefined;
  @Input() selectedIndex: number | undefined;
  @Input() scrollToIndex: number | undefined;
  @Input() currentIndex: number | undefined;
  @Input() headers: LogHeader[] = [];
  @Input() entries: LogEntry[] = [];
  @Input() showCurrentTimeButton = true;
  @Input() traceType: TraceType | undefined;
  @Input() showTraceEntryTimes = true;
  @Input() padEntries = true;
  @Input() isFetchingData = false;
  @Input() checkScrollViewport = false;

  @Output() collapseButtonClicked = new EventEmitter();

  @ViewChild(CdkVirtualScrollViewport)
  scrollComponent?: CdkVirtualScrollViewport;

  constructor(
    @Inject(ElementRef) private elementRef: ElementRef<HTMLElement>,
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

  ngOnChanges() {
    if (this.checkScrollViewport) {
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
    }
  }

  async ngAfterContentInit() {
    await new Timer(10, 10).sleepMs();
    this.updateTableMarginEnd();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
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
    }
  }

  onGoToCurrentEntryClick() {
    if (this.currentIndex !== undefined && this.scrollComponent) {
      this.scrollComponent.scrollToIndex(this.currentIndex);
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
    return index === this.selectedIndex;
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
}

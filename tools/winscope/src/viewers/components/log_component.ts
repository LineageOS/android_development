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
} from 'common/dom';
import {Timestamp} from 'common/time/time';
import {Timer} from 'common/time/timer';
import {TraceType} from 'trace_api/trace_type';
import {TextFilter} from 'viewers/common/text_filter';
import {
  LogEntry,
  LogField,
  LogFieldValue,
  LogHeader,
} from 'viewers/common/ui_data_log';
import {VariableHeightScrollDirective} from 'viewers/common/variable_height_scroll_directive';
import {
  LogFilterChangeDetail,
  LogTextFilterChangeDetail,
  TimestampClickDetail,
  ViewerEvents,
} from 'viewers/common/viewer_events';
import {CollapsibleSectionTitleComponent} from 'viewers/components/collapsible_section_title_component';
import {SearchBoxComponent} from 'viewers/components/search_box_component';
import {SelectWithFilterComponent} from 'viewers/components/select_with_filter_component';
import {
  inlineButtonStyle,
  targetWindowButtonStyle,
  timeButtonStyle,
} from 'viewers/components/styles/clickable_property.styles';
import {currentElementStyle} from 'viewers/components/styles/current_element.styles';
import {logComponentStyles} from 'viewers/components/styles/log_component.styles';
import {selectedElementStyle} from 'viewers/components/styles/selected_element.styles';
import {
  viewerCardInnerStyle,
  viewerCardStyle,
} from 'viewers/components/styles/viewer_card.styles';
import {assertDefined} from 'common/assert';
import {UserTimestamp} from 'common/time/user_timestamp';

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
  template: `
    @if (title) {
      <div class="view-header">
        <div class="title-section">
          <collapsible-section-title
              class="log-title"
              [title]="title"
              (collapseButtonClicked)="collapseButtonClicked.emit()"></collapsible-section-title>
        </div>
      </div>
    }

    <div class="entries" [class.padded]="padEntries">
      @if (headers.length > 0) {
        <div class="headers table-header">
          @if (showTraceEntryTimes) {
            <div class="time time-controls cell">
              <button
                  color="primary"
                  mat-icon-button
                  class="time-button go-to-first-entry"
                  (click)="onGoToFirstEntryClick()"
                  matTooltip="Go to first entry"
                  matTooltipPosition="above">
                <mat-icon>first_page</mat-icon>
              </button>
              @if (showCurrentTimeButton) {
                <button
                    color="primary"
                    mat-icon-button
                    class="time-button go-to-current-entry"
                    (click)="onGoToCurrentEntryClick()"
                    matTooltip="Go to current entry"
                    matTooltipPosition="above">
                  <mat-icon>move_down</mat-icon>
                </button>
              }
              <button
                  color="primary"
                  mat-icon-button
                  class="time-button go-to-last-entry"
                  (click)="onGoToLastEntryClick()"
                  matTooltip="Go to last entry"
                  matTooltipPosition="above">
                  <mat-icon>last_page</mat-icon>
              </button>
            </div>
          }

          @for (header of headers; track $index) {
            @if (!isHeaderWithFilter(header)) {
              <div
                #headerEl
                class="mat-body-2 header text-no-overflow"
                [class]="header.spec.cssClass"
                [matTooltip]="header.spec.name"
                [matTooltipDisabled]="disableHeaderTooltip(headerEl)"
                matTooltipPosition="above">
              {{header.spec.name}}</div>
            } @else if (isHeaderWithFilter(header) && !showFiltersInTitle) {
              <div
                class="filter mat-body-2"
                [class]="header.spec.cssClass">
                @if ((header.filter.options?.length ?? 0) > 0) {
                  <select-with-filter
                      [label]="header.spec.name"
                      [options]="header.filter.options"
                      [outerFilterWidth]="header.filter.outerFilterWidthCss"
                      [innerFilterWidth]="header.filter.innerFilterWidthCss"
                      formFieldClass="log-select-filter mat-form-field-appearance-none no-ripple-field"
                      subscriptSizing="dynamic"
                      (selectChange)="onFilterChange($event, header)">
                  </select-with-filter>
                }
                @if (header.filter.textFilter) {
                  <search-box
                    [textFilter]="header.filter.textFilter"
                    [label]="header.spec.name"
                    [filterName]="header.spec.name"
                    [formFieldClass]="
                      'wide-field center-field mat-form-field-appearance-none no-ripple-field '
                       + header.spec.cssClass
                       + (header.filter.textFilter.filterString?.length === 0 ? ' mat-body-2' : '')
                    "
                    (filterChange)="onSearchBoxChange($event, header)"></search-box>
                }
              </div>
            }
          }
        </div>
      }

      @if (!isFetchingData && entries.length === 0) {
        <div class="placeholder-text mat-body-1"> No entries found. </div>
      }

      @if (isFetchingData) {
        <div class="fetching-data mat-body-1">
          <span class="message-with-spinner">
            <span>Fetching all data</span>
            <mat-spinner [diameter]="20"></mat-spinner>
          </span>
        </div>
      }

      @if (!isFixedSizeScrollViewport()) {
        <cdk-virtual-scroll-viewport
            variableHeightScroll
            class="scroll"
            [traceType]="traceType"
            [scrollItems]="entries">
          <ng-container
              *cdkVirtualFor="let entry of entries; let i = index"
              [ngTemplateOutlet]="content"
              [ngTemplateOutletContext]="{entry: entry, i: i}"> </ng-container>
        </cdk-virtual-scroll-viewport>
      }

      @if (isFixedSizeScrollViewport()) {
        <cdk-virtual-scroll-viewport
            [itemSize]="36"
            [minBufferPx]="1000"
            [maxBufferPx]="2000"
            class="scroll">
          <ng-container
              *cdkVirtualFor="let entry of entries; let i = index"
              [ngTemplateOutlet]="content"
              [ngTemplateOutletContext]="{entry: entry, i: i}"> </ng-container>
        </cdk-virtual-scroll-viewport>
      }

      <ng-template #content let-entry="entry" let-i="i">
        <div
            class="entry"
            [attr.item-id]="i"
            [class.current]="isCurrentEntry(i)"
            [class.selected]="isSelectedEntry(i)"
            (click)="onEntryClicked(i)">
          @if (showTraceEntryTimes) {
            <div class="time cell">
              <button
                  mat-button
                  class="time-button"
                  color="primary"
                  (click)="onTraceEntryTimestampClick($event, entry)"
                  [disabled]="!entry.traceEntry.hasValidTimestamp()">
                {{ formatTimestamp(entry.traceEntry.getTimestamp()) }}
              </button>
            </div>
          }

          @for (field of entry.fields; track $index) {
            <div [class]="field.spec.cssClass + ' cell'">
              @if (!showFieldButton(entry, field) && !isClickableArray(field.value)) {
                <span class="mat-body-1">{{ field.value }}</span>
              }
              @if (showFieldButton(entry, field)) {
                <button
                    mat-button
                    class="time-button"
                    color="primary"
                    (click)="onFieldButtonClick($event, entry, field)">
                  {{ formatFieldButton(field.value) }}
                </button>
              }
              @if (isClickableArray(field.value)) {
                @for (item of field.value; track $index) {
                    @if (isString(item)) {
                      <span class='mat-body-1'>{{item}}</span>
                    } @else {
                      <button
                        mat-button
                        class="window-button"
                        color="primary"
                        [matTooltip]="item.tooltip"
                        matTooltipPosition = "above"
                        matTooltipShowDelay = 100
                        (click)="item.onClick()">
                        {{ item.propertyValue }}
                      </button>
                    }
                }
              }

              @if (field.icon) {
                <mat-icon
                    aria-hidden="false"
                    class="icon-small"
                    [style]="{color: field.iconColor}"> {{field.icon}} </mat-icon>
              }
              @if (field.spec.canCopy) {
                <button
                    mat-icon-button
                    class="copy-button icon-button-small"
                    [cdkCopyToClipboard]="field.value.toString()">
                  <mat-icon>content_copy</mat-icon>
                </button>
              }
            </div>
          }
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .log-title {
        padding-bottom: 8px;
      }
      .view-header {
        display: flex;
        flex-direction: column;
        flex: 0 0 auto;
      }
      .message-with-spinner {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
      }
    `,
    selectedElementStyle,
    currentElementStyle,
    timeButtonStyle,
    targetWindowButtonStyle,
    inlineButtonStyle,
    viewerCardStyle,
    viewerCardInnerStyle,
    logComponentStyles,
  ],
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

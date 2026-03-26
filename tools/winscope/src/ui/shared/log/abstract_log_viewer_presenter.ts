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
import {KeyboardEventKey} from '@common/dom';
import {Timestamp} from '@common/time/time';
import {getLogger, Logger} from '@compat/logging';
import {Analytics} from '@logging/analytics';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent} from '@messaging/winscope_event_emitter';
import {CustomQueryType} from '@trace_api/custom_query';
import {Trace, TraceEntry} from '@trace_api/trace';
import {findCorrespondingEntry} from '@trace_api/trace_entry_finder';
import {ActiveTraceChanged, TracePositionUpdate} from '@trace_api/trace_events';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TracePosition} from '@trace_api/trace_position';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {DarkModeToggled} from '@ui/shared/events/misc_events';
import {PropertiesPresenter} from '@ui/shared/properties/properties_presenter';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';
import {flattenNodesToRows} from '@ui/shared/tree/ui_tree_node_helpers';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';
import {TimestampClickDetail} from '@ui/shared/viewers/viewer_event_details';

import {LogSelectFilter} from './log_filters';
import {LogPresenter} from './log_presenter';
import {LogEntry, LogHeader, UiDataLog} from './ui_data_log';

export type NotifyLogViewCallbackType<UiData> = (uiData: UiData) => void;
export type FilterOptionSorter = (a: string, b: string) => number;

export abstract class AbstractLogViewerPresenter<
  UiData extends UiDataLog,
  TraceEntryType,
> {
  protected static readonly VALUE_NA = 'N/A';
  protected emitAppEvent: EmitEvent = () => Promise.resolve();
  protected abstract logPresenter: LogPresenter<LogEntry>;
  protected propertiesPresenter?: PropertiesPresenter;
  protected keepCalculated?: boolean;
  protected filterOptionSorters: {
    [key: string]: FilterOptionSorter;
  } = {};
  private activeTrace?: Trace<unknown>;
  private isInitialized = false;
  protected readonly logger: Logger;

  protected constructor(
    protected readonly trace: Trace<TraceEntryType>,
    private readonly notifyViewCallback: NotifyLogViewCallbackType<UiData>,
    protected readonly uiData: UiData,
  ) {
    this.logger = getLogger('AbstractLogViewerPresenter');
    this.notifyViewChanged();
  }

  onDestroy() {
    // do nothing
  }

  setEmitEvent(callback: EmitEvent) {
    this.emitAppEvent = callback;
  }

  notifyViewChanged() {
    this.notifyViewCallback(this.uiData);
  }

  async onAppEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case TracePositionUpdate:
        return await this.onTracePositionUpdate(event as TracePositionUpdate);
      case DarkModeToggled:
        return await this.onDarkModeToggled(event as DarkModeToggled);
      case ActiveTraceChanged:
        return await this.onActiveTraceChanged(event as ActiveTraceChanged);
      default:
        this.logger.trace('Not processing event ' + event.constructor.name);
    }
  }

  async onSelectFilterChange(header: LogHeader, value: string[]) {
    this.logPresenter.applySelectFilterChange(header, value);
    await this.updatePropertiesTree();
    this.uiData.currentIndex = this.logPresenter.getCurrentIndex();
    this.uiData.selectedIndex = this.logPresenter.getSelectedIndex();
    this.uiData.scrollToIndex = this.logPresenter.getScrollToIndex();
    this.uiData.entries = this.logPresenter.getFilteredEntries();
    this.notifyViewChanged();
  }

  async onTextFilterChange(header: LogHeader, value: TextFilter) {
    this.logPresenter.applyTextFilterChange(header, value);
    await this.updatePropertiesTree();
    this.uiData.currentIndex = this.logPresenter.getCurrentIndex();
    this.uiData.selectedIndex = this.logPresenter.getSelectedIndex();
    this.uiData.scrollToIndex = this.logPresenter.getScrollToIndex();
    this.uiData.entries = this.logPresenter.getFilteredEntries();
    this.notifyViewChanged();
  }

  async onPropertiesUserOptionsChange(userOptions: UserOptions) {
    if (!this.propertiesPresenter) {
      return;
    }
    this.propertiesPresenter.applyPropertiesUserOptionsChange(userOptions);
    this.uiData.propertiesUserOptions =
      this.propertiesPresenter.getUserOptions();
    await this.updatePropertiesTree(false);
    this.notifyViewChanged();
  }

  async onPropertiesFilterChange(textFilter: TextFilter) {
    if (!this.propertiesPresenter) {
      return;
    }
    this.propertiesPresenter.applyPropertiesFilterChange(textFilter);
    await this.updatePropertiesTree(false);
    this.uiData.propertiesFilter = textFilter;
    this.notifyViewChanged();
  }

  async onTimestampClick(detail: TimestampClickDetail) {
    if (detail.entry) {
      await this.onLogTimestampClick(detail.entry);
    } else if (detail.timestamp) {
      await this.onRawTimestampClick(detail.timestamp);
    }
  }

  private async onLogTimestampClick(traceEntry: TraceEntry<unknown>) {
    await this.emitAppEvent(
      TracePositionUpdate.fromTraceEntry(traceEntry, true),
    );
  }

  private async onRawTimestampClick(timestamp: Timestamp) {
    await this.emitAppEvent(TracePositionUpdate.fromTimestamp(timestamp, true));
  }

  async onLogEntryClick(index: number) {
    this.logPresenter.applyLogEntryClick(index);
    this.updateIndicesUiData();
    await this.updatePropertiesTree();
    if (this.handleSpecificEntryClicks) {
      await this.handleSpecificEntryClicks();
    }
    this.notifyViewChanged();
  }

  async onArrowDownPress() {
    this.logPresenter.applyArrowDownPress();
    this.updateIndicesUiData();
    await this.updatePropertiesTree();
    this.notifyViewChanged();
  }

  async onArrowUpPress() {
    this.logPresenter.applyArrowUpPress();
    this.updateIndicesUiData();
    await this.updatePropertiesTree();
    this.notifyViewChanged();
  }

  async onPositionChangeByKeyPress(event: KeyboardEvent) {
    const currIndex = this.uiData.currentIndex;
    if (this.activeTrace === this.trace && currIndex !== undefined) {
      if (event.key === KeyboardEventKey.ARROW_RIGHT) {
        event.stopImmediatePropagation();
        if (currIndex < this.uiData.entries.length - 1) {
          const currTimestamp =
            this.uiData.entries[currIndex].traceEntry.getTimestamp();
          const nextEntry = this.uiData.entries
            .slice(currIndex + 1)
            .find((entry) => entry.traceEntry.getTimestamp() > currTimestamp);
          if (nextEntry) {
            return this.emitAppEvent(
              new TracePositionUpdate(
                TracePosition.fromTraceEntry(nextEntry.traceEntry),
                true,
              ),
            );
          }
        }
      } else {
        event.stopImmediatePropagation();
        if (currIndex > 0) {
          let prev = currIndex - 1;
          while (prev >= 0) {
            const prevEntry = this.uiData.entries[prev].traceEntry;
            if (prevEntry.hasValidTimestamp()) {
              return this.emitAppEvent(
                new TracePositionUpdate(
                  TracePosition.fromTraceEntry(prevEntry),
                  true,
                ),
              );
            }
            prev--;
          }
        }
      }
    }
  }

  protected refreshUiData() {
    this.uiData.headers = this.logPresenter.getHeaders();
    this.uiData.entries = this.logPresenter.getFilteredEntries();
    this.uiData.selectedIndex = this.logPresenter.getSelectedIndex();
    this.uiData.scrollToIndex = this.logPresenter.getScrollToIndex();
    this.uiData.currentIndex = this.logPresenter.getCurrentIndex();
    if (this.propertiesPresenter) {
      this.uiData.propertyNodes = this.flattenProperties(
        this.propertiesPresenter?.getFormattedTree(),
      );
      this.uiData.propertiesUserOptions =
        this.propertiesPresenter.getUserOptions();
      this.uiData.propertiesFilter = this.propertiesPresenter.getTextFilter();
    }
  }

  private async onTracePositionUpdate(event: TracePositionUpdate) {
    if (this.uiData.isFetchingData) {
      return;
    }
    if (!this.isInitialized) {
      this.uiData.isFetchingData = true;
      this.notifyViewChanged();
      if (this.initializeTraceSpecificData) {
        await this.initializeTraceSpecificData();
      }
      this.makeUiData().then(async () => {
        await this.applyTracePositionUpdate(event);
        this.uiData.isFetchingData = false;
        this.notifyViewChanged();
        this.isInitialized = true;
      });
    } else {
      await this.applyTracePositionUpdate(event);
    }
  }

  private async onDarkModeToggled(event: DarkModeToggled) {
    this.uiData.isDarkMode = event.isDarkMode;
    this.notifyViewChanged();
  }

  private async onActiveTraceChanged(event: ActiveTraceChanged) {
    this.activeTrace = event.trace;
    if (this.activeTrace === this.trace) {
      this.uiData.checkScrollViewportCount++;
      this.notifyViewChanged();
    }
  }

  private async applyTracePositionUpdate(event: TracePositionUpdate) {
    let entry: TraceEntry<TraceEntryType> | undefined;
    if (event.position.entry?.getFullTrace() === this.trace) {
      entry = event.position.entry as TraceEntry<TraceEntryType>;
    } else {
      entry = findCorrespondingEntry(this.trace, event.position);
    }
    this.logPresenter.applyTracePositionUpdate(entry);

    this.uiData.selectedIndex = this.logPresenter.getSelectedIndex();
    this.uiData.scrollToIndex = this.logPresenter.getScrollToIndex();
    this.uiData.currentIndex = this.logPresenter.getCurrentIndex();
    if (this.propertiesPresenter) {
      await this.updatePropertiesTree();
      this.uiData.propertyNodes = this.flattenProperties(
        this.propertiesPresenter?.getFormattedTree(),
      );
    }

    this.notifyViewChanged();
  }

  protected async updatePropertiesTree(updateDefaultAllowlist = true) {
    if (this.propertiesPresenter) {
      const traceName = TRACE_INFO[this.trace.type].name;
      const propertiesStartTime = Date.now();

      const tree = await this.getPropertiesTree();
      this.propertiesPresenter.setPropertiesTree(tree);
      if (updateDefaultAllowlist && this.updateDefaultAllowlist) {
        this.updateDefaultAllowlist(tree);
      }
      await this.propertiesPresenter.formatPropertiesTree(
        undefined,
        undefined,
        this.keepCalculated ?? false,
        this.trace.type,
      );
      this.uiData.propertyNodes = this.flattenProperties(
        this.propertiesPresenter?.getFormattedTree(),
      );
      Analytics.Navigation.logFetchComponentDataTime(
        'properties',
        traceName,
        false,
        Date.now() - propertiesStartTime,
      );
    }
  }

  private async makeUiData() {
    const headers = this.makeHeaders();
    const allEntries = await this.makeUiDataEntries(headers);
    if (this.updateFiltersInHeaders) {
      await this.updateFiltersInHeaders(headers, allEntries);
    }
    this.logPresenter.setAllEntries(allEntries);
    this.logPresenter.setHeaders(headers);
    this.refreshUiData();
  }

  private updateIndicesUiData() {
    this.uiData.selectedIndex = this.logPresenter.getSelectedIndex();
    this.uiData.currentIndex = this.logPresenter.getCurrentIndex();
    this.uiData.scrollToIndex = this.logPresenter.getScrollToIndex();
  }

  private async getPropertiesTree(): Promise<PropertyTreeNode | undefined> {
    const entries = this.logPresenter.getFilteredEntries();
    const selectedIndex = this.logPresenter.getSelectedIndex();
    const currentIndex = this.logPresenter.getCurrentIndex();
    if (selectedIndex !== undefined) {
      const entry = entries.at(selectedIndex);
      return entry?.getPropertiesTree
        ? await entry.getPropertiesTree()
        : undefined;
    }
    if (currentIndex !== undefined) {
      const entry = entries.at(currentIndex);
      return entry?.getPropertiesTree
        ? await entry.getPropertiesTree()
        : undefined;
    }
    return undefined;
  }

  protected flattenProperties(
    tree: UiPropertyTreeNode | undefined,
  ): Array<FlattenedTreeRow<UiPropertyTreeNode>> | undefined {
    if (!tree) {
      return undefined;
    }
    return flattenNodesToRows(
      [tree],
      true,
      false,
      assertDefined(this.propertiesPresenter).getHighlightedProperty(),
    );
  }

  protected async updateFilterByCustomQuery(header: LogHeader) {
    const filterValues = await this.trace.customQuery(
      CustomQueryType.LOG_TABLE_FILTER_VALUES,
      assertDefined(header.spec.columnType),
    );
    if (header.spec) {
      const sorter = this.filterOptionSorters[header.spec.name];
      if (sorter) {
        filterValues.sort(sorter);
      }
    }
    (header.filter as LogSelectFilter).options = filterValues;
    return;
  }

  protected abstract makeHeaders(): LogHeader[];
  protected abstract makeUiDataEntries(
    headers: LogHeader[],
  ): Promise<LogEntry[]>;
  protected initializeTraceSpecificData?(): Promise<void>;
  protected async handleSpecificEntryClicks?(): Promise<void>;
  protected async updateFiltersInHeaders?(
    headers: LogHeader[],
    allEntries: LogEntry[],
  ): Promise<void>;
  protected updateDefaultAllowlist?(tree: PropertyTreeNode | undefined): void;
}

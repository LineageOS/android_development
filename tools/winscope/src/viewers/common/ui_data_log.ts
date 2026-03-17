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

import {Timestamp} from '@common/time/time';
import {TraceEntry} from '@trace_api/trace';
import {LazyPropertiesStrategyType} from '@tree_node/properties_provider';

import {FlattenedTreeRow} from './flattened_tree_row';
import {LogFilter} from './log_filters';
import {TextFilter} from './text_filter';
import {UiPropertyTreeNode} from './ui_property_tree_node';
import {UserOptions} from './user_options';

export interface UiDataLog {
  entries: LogEntry[];
  selectedIndex: undefined | number;
  scrollToIndex: undefined | number;
  currentIndex: undefined | number;
  isFetchingData: boolean;
  checkScrollViewportCount: number;

  headers: LogHeader[];
  propertyNodes?: Array<FlattenedTreeRow<UiPropertyTreeNode>> | undefined;
  propertiesUserOptions?: UserOptions;
  propertiesFilter?: TextFilter;
  isDarkMode?: boolean;
}

export interface ColumnSpec {
  name: string;
  cssClass: string;
  columnType?: number;
  canCopy?: boolean;
}

export class LogHeader {
  constructor(
    public spec: ColumnSpec,
    public filter?: LogFilter,
  ) {}
}

export interface LogEntry {
  traceEntry: TraceEntry<unknown>;
  fields: LogField[];
  getPropertiesTree: LazyPropertiesStrategyType | undefined;
  formatForClipboard?: (timeOnly: boolean) => string;
}

export class LogField {
  constructor(
    readonly spec: ColumnSpec,
    readonly value: LogFieldValue,
    readonly icon?: string,
    readonly iconColor?: string,
    readonly propagateEntryTimestamp?: boolean,
    readonly tooltip?: string,
  ) {}

  format(timeOnly = false): string {
    if (this.value instanceof Timestamp) {
      return this.value.format(timeOnly);
    }
    return this.value.toString();
  }
}

export type LogFieldValue =
  | string
  | number
  | Timestamp
  | Array<string | ClickableProperty>;

export interface ClickableProperty {
  propertyValue: string;
  tooltip: string | undefined;
  onClick: () => void;
}

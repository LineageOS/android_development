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

import {TraceEntry} from '@trace_api/trace';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {LogEntry, LogField, LogHeader, UiDataLog,} from '@ui/shared/log/ui_data_log';

export class UiData implements UiDataLog {
  constructor(
    public headers: LogHeader[],
    public entries: LogEntry[],
    public selectedIndex: undefined | number,
    public currentIndex: undefined | number,
    public scrollToIndex: undefined | number,
  ) {}

  isFetchingData = false;
  checkScrollViewportCount = 0;

  static createEmpty() {
    return new UiData([], [], undefined, undefined, undefined);
  }
}

export class CujEntry implements LogEntry {
  readonly getPropertiesTree = undefined;

  constructor(
    public traceEntry: TraceEntry<HierarchyTreeNode>,
    public fields: LogField[],
  ) {}
}

export enum CujStatus {
  EXECUTED = 'EXECUTED',
  CANCELLED = 'CANCELLED',
}

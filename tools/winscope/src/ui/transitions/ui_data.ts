/*
 * Copyright (C) 2023 The Android Open Source Project
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
import {LazyPropertiesStrategyType} from '@tree_node/properties_provider';
import {LogEntry, LogField, LogHeader, UiDataLog,} from '@ui/shared/log/ui_data_log';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';
import {TextFilter} from '@ui/shared/user_input/text_filter';

export class UiData implements UiDataLog {
  constructor(
    public headers: LogHeader[],
    public entries: LogEntry[],
    public currentIndex: undefined | number,
    public selectedIndex: undefined | number,
    public scrollToIndex: undefined | number,
    public propertyNodes:
      | undefined
      | Array<FlattenedTreeRow<UiPropertyTreeNode>>,
  ) {}

  isFetchingData = false;
  checkScrollViewportCount = 0;
  propertiesFilter = new TextFilter();

  static createEmpty(): UiData {
    return new UiData([], [], undefined, undefined, undefined, undefined);
  }
}

export class TransitionsEntry implements LogEntry {
  constructor(
    public traceEntry: TraceEntry<HierarchyTreeNode>,
    public fields: LogField[],
    public getPropertiesTree: LazyPropertiesStrategyType | undefined,
  ) {}
}

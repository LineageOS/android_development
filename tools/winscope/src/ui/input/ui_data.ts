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
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {LazyPropertiesStrategyType} from '@tree_node/properties_provider';
import {LogEntry, LogField, LogHeader, UiDataLog,} from '@ui/shared/log/ui_data_log';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {DisplayIdentifier} from '@ui/shared/rects/display_identifier';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {RectSpec} from '@ui/shared/rects/rect_spec';
import {UiRect} from '@ui/shared/rects/ui_rect';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';

export class UiData implements UiDataLog {
  constructor(
    public headers: LogHeader[],
    public entries: LogEntry[],
    public selectedIndex: undefined | number,
    public scrollToIndex: undefined | number,
    public currentIndex: undefined | number,
    public propertyNodes:
      | undefined
      | Array<FlattenedTreeRow<UiPropertyTreeNode>>,
  ) {}

  isFetchingData = false;
  checkScrollViewportCount = 0;

  highlightedProperty: string = '';
  dispatchPropertyNodes:
    | Array<FlattenedTreeRow<UiPropertyTreeNode>>
    | undefined;

  rectsToDraw: UiRect[] | undefined;
  rectIdToShowState: Map<string, RectShowState> | undefined;
  highlightedRect = '';
  rectsUserOptions: UserOptions | undefined;
  displays: DisplayIdentifier[] = [];
  rectSpec: RectSpec | undefined;
  isDarkMode = false;
  propertiesFilter = new TextFilter();
  dispatchPropertiesFilter = new TextFilter();

  readonly dependencies: TraceType[] = [TraceType.INPUT_EVENT_MERGED];

  static createEmpty(): UiData {
    return new UiData([], [], undefined, undefined, undefined, undefined);
  }
}

export class InputEntry implements LogEntry {
  constructor(
    public traceEntry: TraceEntry<HierarchyTreeNode>,
    public fields: LogField[],
    public getPropertiesTree: LazyPropertiesStrategyType | undefined,
    public getDispatchPropertiesTree: LazyPropertiesStrategyType | undefined,
    public surfaceFlingerEntry: TraceEntry<HierarchyTreeNode> | undefined,
  ) {}
}

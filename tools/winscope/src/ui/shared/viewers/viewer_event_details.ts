/*
 * Copyright (C) 2022 The Android Open Source Project
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
import {TreeNode} from '@tree_node/tree_node';
import {LogHeader} from '@ui/shared/log/ui_data_log';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {TextFilter} from '@ui/shared/user_input/text_filter';

export class TimestampClickDetail {
  constructor(
    public entry?: TraceEntry<unknown>,
    public timestamp?: Timestamp,
  ) {}
}

export class LogFilterChangeDetail {
  constructor(
    public header: LogHeader,
    public value: string[],
  ) {}
}

export class LogTextFilterChangeDetail {
  constructor(
    public header: LogHeader,
    public filter: TextFilter,
  ) {}
}

export class SearchQueryClickDetail {
  constructor(
    public query: string,
    public uid: number,
  ) {}
}

export class SaveQueryClickDetail {
  constructor(
    public query: string,
    public name: string,
  ) {}
}

export class AdditionalPropertySelectedDetail {
  constructor(
    public name: string,
    public treeNode: TreeNode,
  ) {}
}

export class RectShowStateChangeDetail {
  constructor(
    public rectId: string,
    public state: RectShowState,
  ) {}
}

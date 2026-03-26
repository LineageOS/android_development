/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {Directive, output, viewChild} from '@angular/core';
import {ViewerComponent} from '@app/shared/viewers/viewer_component';
import {UiDataLog} from '@ui/shared/log/ui_data_log';
import {LogFilterChangeDetail, LogTextFilterChangeDetail,} from '@ui/shared/viewers/viewer_event_details';

import {LogComponent} from './log_component';

@Directive()
export class LogViewerComponent<
  T extends UiDataLog,
> extends ViewerComponent<T> {
  logComponent = viewChild(LogComponent);

  readonly onLogFilterChange = output<LogFilterChangeDetail>();
  readonly onLogTextFilterChange = output<LogTextFilterChangeDetail>();
  readonly onLogEntryClick = output<number>();
  readonly onArrowDownPress = output<void>();
  readonly onArrowUpPress = output<void>();
}

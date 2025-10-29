/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {AdbFiles} from 'trace_collection/adb_files';
import {WinscopeEvent, WinscopeEventType} from 'messaging/winscope_event';

export class AppInitialized implements WinscopeEvent {
  readonly type = WinscopeEventType.APP_INITIALIZED;
}

export class AppFilesCollected implements WinscopeEvent {
  readonly type = WinscopeEventType.APP_FILES_COLLECTED;
  constructor(readonly files: AdbFiles) {}
}

export class AppFilesUploaded implements WinscopeEvent {
  readonly type = WinscopeEventType.APP_FILES_UPLOADED;
  constructor(readonly files: File[]) {}
}

export class AppResetRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.APP_RESET_REQUEST;
}

export class AppTraceViewRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.APP_TRACE_VIEW_REQUEST;
  constructor(readonly discardLegacyTraces = false) {}
}

export class AppTraceViewRequestHandled implements WinscopeEvent {
  readonly type = WinscopeEventType.APP_TRACE_VIEW_REQUEST_HANDLED;
}

export class AppRefreshDumpsRequest implements WinscopeEvent {
  readonly type = WinscopeEventType.APP_REFRESH_DUMPS_REQUEST;
}

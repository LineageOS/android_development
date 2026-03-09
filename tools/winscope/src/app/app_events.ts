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

import {WinscopeEvent} from '@messaging/winscope_event';
import {AdbFiles} from '@trace_collection/adb_files';

export class AppInitialized implements WinscopeEvent {}

export class AppFilesCollected implements WinscopeEvent {
  constructor(readonly files: AdbFiles) {}
}

export class AppFilesUploaded implements WinscopeEvent {
  constructor(readonly files: File[]) {}
}

export class AppResetRequest implements WinscopeEvent {}

export class AppTraceViewRequest implements WinscopeEvent {
  constructor(readonly discardLegacyFiles = false) {}
}

export class AppTraceViewRequestHandled implements WinscopeEvent {}

export class AppRefreshDumpsRequest implements WinscopeEvent {}

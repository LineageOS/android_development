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

import {TraceType} from 'trace_api/trace_type';
import {PlaybackState} from 'viewers/common/playback/playback_state';
import {WinscopeEvent} from 'messaging/winscope_event';
import {TraceGeometryData} from 'parsers/trace_geometry_data';

export class PlaybackStateChangeRequest implements WinscopeEvent {
  constructor(
    readonly traceType: TraceType,
    readonly state: PlaybackState,
    readonly currentTraceIndex?: number,
  ) {}
}

export class PlaybackStateChangeHandled implements WinscopeEvent {
  constructor(
    readonly stateToReflect: PlaybackState,
    readonly traceType?: TraceType,
  ) {
    this.stateToReflect = stateToReflect;
    this.traceType = traceType;
  }
}

export class PlaybackSpeedChange implements WinscopeEvent {
  constructor(
    readonly traceType: TraceType,
    readonly speedValue: number,
  ) {}
}

export class PlaybackStateChangePropagate implements WinscopeEvent {
  constructor(
    readonly state: PlaybackState,
    readonly currentTraceIndex: number,
    readonly traceGeometryData: TraceGeometryData,
  ) {}
}

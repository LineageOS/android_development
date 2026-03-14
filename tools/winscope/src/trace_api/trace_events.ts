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

import {Timestamp} from '@common/time/time';
import {WinscopeEvent} from '@messaging/winscope_event';
import {PlaybackPrefetchedEntries} from '@trace_api/playback_prefetched_entries';
import {Trace, TraceEntry} from '@trace_api/trace';
import {TracePosition} from '@trace_api/trace_position';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';

export class TracePositionUpdate implements WinscopeEvent {
  constructor(
    readonly position: TracePosition,
    readonly updateTimeline = false,
    readonly prefetchedEntries?: PlaybackPrefetchedEntries,
  ) {}

  static fromTimestamp(
    timestamp: Timestamp,
    updateTimeline = false,
  ): TracePositionUpdate {
    const position = TracePosition.fromTimestamp(timestamp);
    return new TracePositionUpdate(position, updateTimeline);
  }

  static fromTraceEntry(
    entry: TraceEntry<unknown>,
    updateTimeline = false,
  ): TracePositionUpdate {
    const position = TracePosition.fromTraceEntry(entry);
    return new TracePositionUpdate(position, updateTimeline);
  }
}

export class TraceSearchRequest implements WinscopeEvent {
  constructor(readonly query: string) {}
}

export class TraceSearchFailed implements WinscopeEvent {}

export class TraceAddRequest implements WinscopeEvent {
  constructor(readonly trace: Trace<unknown>) {}
}

export class TraceRemoveRequest implements WinscopeEvent {
  constructor(readonly trace: Trace<unknown>) {}
}

export class InitializeTraceSearchRequest implements WinscopeEvent {}

export class TraceSearchInitialized implements WinscopeEvent {
  constructor(readonly views: string[]) {}
}

export class TraceSearchCompleted implements WinscopeEvent {}

export class ShowTraceUploadWarning implements WinscopeEvent {
  constructor(readonly message: string) {}
}

export class ActiveTraceChanged implements WinscopeEvent {
  constructor(readonly trace: Trace<unknown>) {}
}

export class ScreenRecordingChange implements WinscopeEvent {
  constructor(readonly trace: Trace<MediaBasedTraceEntry>) {}
}

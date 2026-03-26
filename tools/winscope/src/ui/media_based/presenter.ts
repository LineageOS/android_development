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

import {getLogger, Logger} from '@compat/logging';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent} from '@messaging/winscope_event_emitter';
import {Trace, TraceEntry} from '@trace_api/trace';
import {findCorrespondingEntry} from '@trace_api/trace_entry_finder';
import {ActiveTraceChanged, ScreenRecordingChange, TracePositionUpdate,} from '@trace_api/trace_events';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {PlaybackStateChangeHandled} from '@ui/shared/playback/events';
import {PlaybackState} from '@ui/shared/playback/playback_state';
import {ExpandedTimelineToggled} from '@ui/timeline/timeline_events';

import {UiData} from './ui_data';

export type NotifyHierarchyViewCallbackType<UiData> = (uiData: UiData) => void;

export class Presenter {
  private readonly uiData: UiData;
  private readonly traces: Array<Trace<MediaBasedTraceEntry>>;
  private readonly notifyViewCallback: NotifyHierarchyViewCallbackType<UiData>;
  private emitWinscopeEvent: EmitEvent = () => Promise.resolve();

  constructor(
    traces: Array<Trace<MediaBasedTraceEntry>>,
    notifyViewCallback: NotifyHierarchyViewCallbackType<UiData>,
    private readonly logger: Logger = getLogger('Presenter'),
  ) {
    this.traces = traces;
    this.notifyViewCallback = notifyViewCallback;
    this.uiData = new UiData(
      this.traces.map((trace) => trace.getDescriptors().join(', ')),
    );
    this.notifyViewChanged();
  }

  setEmitEvent(callback: EmitEvent) {
    this.emitWinscopeEvent = callback;
  }

  onDestroy() {
    // do nothing
  }

  notifyViewChanged() {
    this.notifyViewCallback(this.uiData);
  }

  async onAppEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case TracePositionUpdate:
        return await this.onTracePositionUpdate(event as TracePositionUpdate);
      case ExpandedTimelineToggled:
        return this.onExpandedTimelineToggled(event as ExpandedTimelineToggled);
      case PlaybackStateChangeHandled:
        return this.onPlaybackStateChangeHandled(
          event as PlaybackStateChangeHandled,
        );
      default:
        this.logger.trace('Not processing event ' + event.constructor.name);
    }
  }

  onOverlayDblClick(index: number) {
    const currTrace = this.traces.at(index);
    if (currTrace) {
      this.emitWinscopeEvent(new ActiveTraceChanged(currTrace));
    }
  }

  onOverlayScreenRecordingChange(index: number) {
    const currTrace = this.traces.at(index);
    if (currTrace) {
      this.emitWinscopeEvent(new ScreenRecordingChange(currTrace));
    }
  }

  private async onTracePositionUpdate(event: TracePositionUpdate) {
    if (this.uiData.forceMinimize) {
      return;
    }
    const traceEntries = this.traces
      .map((trace) => {
        if (
          event.prefetchedEntries?.screenRecording?.getFullTrace() === trace
        ) {
          return event.prefetchedEntries.screenRecording;
        }
        return findCorrespondingEntry(trace, event.position);
      })
      .filter((entry) => entry !== undefined) as Array<
      TraceEntry<MediaBasedTraceEntry>
    >;
    this.uiData.isFetchingEntries = true;
    this.notifyViewChanged();
    const entries = await Promise.all(
      traceEntries.map((entry) => {
        return entry.getValue();
      }),
    );
    this.uiData.isFetchingEntries = false;

    if (this.shouldUpdateTraceEntries(entries)) {
      this.uiData.currentTraceEntries = entries;
    }
    this.notifyViewChanged();
  }

  private onExpandedTimelineToggled(event: ExpandedTimelineToggled) {
    this.uiData.forceMinimize = event.isTimelineExpanded;
    this.notifyViewChanged();
  }

  private onPlaybackStateChangeHandled(event: PlaybackStateChangeHandled) {
    this.uiData.isInPlaybackMode =
      event.stateToReflect !== PlaybackState.PAUSED;
    this.notifyViewChanged();
  }

  private shouldUpdateTraceEntries(entries: MediaBasedTraceEntry[]): boolean {
    if (!this.uiData.isInPlaybackMode) {
      return true;
    }
    // In playback mode, we should only update trace entries if there are no entries
    // (playback trace has no corresponding SR entries for its current position) or if
    // there are prefetched CanvasEntry entries present. This condition does not hold
    // when the user changes the direction or position of playback whilst already running.
    return entries.length === 0 || entries.some((e) => e.frame !== undefined);
  }
}

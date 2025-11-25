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

import {
  ActiveTraceChanged,
  ScreenRecordingChange,
  TracePositionUpdate,
} from 'trace/trace_events';
import {WinscopeEvent} from 'messaging/winscope_event';
import {ExpandedTimelineToggled} from 'app/components/timeline/timeline_events';
import {EmitEvent} from 'messaging/winscope_event_emitter';
import {MediaBasedTraceEntry} from 'trace_api/media_based_trace_entry';
import {Trace, TraceEntry} from 'trace_api/trace';
import {findCorrespondingEntry} from 'trace_api/trace_entry_finder';
import {ViewerEvents} from 'viewers/common/viewer_events';
import {UiData} from './ui_data';
import {TraceType} from 'trace_api/trace_type';
import {PlaybackStateChangeHandled} from 'app/components/timeline/playback_events';
import {PlaybackState} from 'viewers/common/playback/playback_state';

export type NotifyHierarchyViewCallbackType<UiData> = (uiData: UiData) => void;

export class Presenter {
  private readonly uiData: UiData;
  private readonly traces: Array<Trace<MediaBasedTraceEntry>>;
  private readonly notifyViewCallback: NotifyHierarchyViewCallbackType<UiData>;
  private emitWinscopeEvent: EmitEvent = () => Promise.resolve();

  constructor(
    traces: Array<Trace<MediaBasedTraceEntry>>,
    notifyViewCallback: NotifyHierarchyViewCallbackType<UiData>,
  ) {
    this.traces = traces;
    this.notifyViewCallback = notifyViewCallback;
    this.uiData = new UiData(
      this.traces.map((trace) => trace.getDescriptors().join(', ')),
    );
    this.notifyViewCallback(this.uiData);
  }

  setEmitEvent(callback: EmitEvent) {
    this.emitWinscopeEvent = callback;
  }

  onDestroy() {
    // do nothing
  }

  addEventListeners(htmlElement: HTMLElement) {
    htmlElement.addEventListener(ViewerEvents.OverlayDblClick, (event) => {
      this.onOverlayDblClick((event as CustomEvent).detail);
    });
    htmlElement.addEventListener(
      ViewerEvents.OverlayMediaBasedTraceChange,
      (event) => {
        if (this.traces.at(0)?.type === TraceType.SCREEN_RECORDING) {
          this.onOverlayScreenRecordingChange((event as CustomEvent).detail);
        }
      },
    );
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
      // do nothing
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
    this.notifyViewCallback(this.uiData);
    const entries = await Promise.all(
      traceEntries.map((entry) => {
        return entry.getValue();
      }),
    );
    this.uiData.isFetchingEntries = false;

    if (this.shouldUpdateTraceEntries(entries)) {
      this.uiData.currentTraceEntries = entries;
    }
    this.notifyViewCallback(this.uiData);
  }

  private onExpandedTimelineToggled(event: ExpandedTimelineToggled) {
    this.uiData.forceMinimize = event.isTimelineExpanded;
    this.notifyViewCallback(this.uiData);
  }

  private onPlaybackStateChangeHandled(event: PlaybackStateChangeHandled) {
    this.uiData.isInPlaybackMode =
      event.stateToReflect !== PlaybackState.PAUSED;
    this.notifyViewCallback(this.uiData);
  }

  private shouldUpdateTraceEntries(entries: MediaBasedTraceEntry[]): boolean {
    if (!this.uiData.isInPlaybackMode) {
      return true;
    }
    // In playback mode, we should only update trace entries if there are no entries
    // (playback trace has no corresponding SR entries for its current position) or if
    // there are prefetched CanvasEntry entries present. This condition does not hold
    // when the user changes the direction or position of playback whilst already running.
    return entries.length === 0 || entries.some((e) => e.image !== undefined);
  }
}

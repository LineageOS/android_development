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

import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {Trace} from 'trace_api/trace';
import {EmitEvent} from 'messaging/winscope_event_emitter';
import {
  PlaybackStateChangeHandled,
  TracePositionUpdate,
} from 'messaging/winscope_event';
import {TracePosition} from 'trace_api/trace_position';
import {Timer} from 'common/time/timer';
import {TraceEntryEager} from 'trace_api/trace';
import {PlaybackState} from './playback_state';
import {MediaBasedTraceEntry} from 'trace_api/media_based_trace_entry';
import {findCorrespondingEntry} from 'trace_api/trace_entry_finder';
import {assertDefined} from 'common/assert';
import {CorrespondingEntries} from './corresponding_entries';
import {TraceType} from 'trace_api/trace_type';

export class PlaybackPresenter {
  private entryIndex = 0;
  private entrySleepTime = 50;
  private buffer: Array<
    TraceEntryEager<HierarchyTreeNode, HierarchyTreeNode | undefined>
  > = [];
  private readonly baseTime = 50;
  private emitWinscopeEvent: EmitEvent;
  private currPlaybackState: PlaybackState = PlaybackState.PAUSED;
  private correspondingEntriesMap = new Map<number, CorrespondingEntries>();
  private traceType: TraceType = TraceType.SURFACE_FLINGER;
  private currentScreenRecording: Trace<MediaBasedTraceEntry> | undefined;

  constructor(emitWinscopeEvent: EmitEvent) {
    this.emitWinscopeEvent = emitWinscopeEvent;
  }

  isPlaying() {
    return this.currPlaybackState !== PlaybackState.PAUSED;
  }

  async play(
    trace: Trace<HierarchyTreeNode>,
    currentPosition: number,
    requestedState: PlaybackState,
    screenRecordingTrace: Trace<MediaBasedTraceEntry> | undefined,
  ) {
    await this.buildMap(trace, screenRecordingTrace);
    this.traceType = trace.type;
    this.entryIndex = currentPosition;
    this.currPlaybackState = requestedState;
    if (
      this.currPlaybackState === PlaybackState.BACKWARDS &&
      this.entryIndex === 0
    ) {
      // if the user's cursor position is at 0 and they want to reverse play through the trace
      // change the index to the end of tracecons
      this.entryIndex = this.correspondingEntriesMap.size - 1;
    }
    if (
      this.correspondingEntriesMap.size > 0 &&
      this.entryIndex < this.correspondingEntriesMap.size
    ) {
      await this.emitWinscopeEvent(
        new PlaybackStateChangeHandled(this.currPlaybackState, this.traceType),
      );
      this.runPlaybackLoop();
    }
  }

  async changeSpeed(speedScale: number) {
    this.entrySleepTime = this.baseTime / speedScale;
  }

  async pause() {
    if (this.isPlaying()) {
      this.currPlaybackState = PlaybackState.PAUSED;
      await this.emitWinscopeEvent(
        new PlaybackStateChangeHandled(this.currPlaybackState, this.traceType),
      );
    }
  }

  private async runPlaybackLoop() {
    const lastIndex = this.correspondingEntriesMap.size - 1;

    let nextIndex;
    let reachedEndOfTrace = false;
    let lastEntry:
      | TraceEntryEager<HierarchyTreeNode, HierarchyTreeNode | undefined>
      | undefined;

    while (this.currPlaybackState !== PlaybackState.PAUSED) {
      const currentIndex = this.entryIndex;
      if (this.correspondingEntriesMap.get(currentIndex) === undefined) {
        return;
      }
      const entryMap = assertDefined(
        this.correspondingEntriesMap.get(currentIndex),
      );

      const traceEntryToUse =
        entryMap.traceEntry === lastEntry || entryMap.traceEntry === undefined
          ? entryMap.screenRecordingEntry
          : entryMap.traceEntry;

      lastEntry = entryMap.traceEntry;

      if (traceEntryToUse) {
        await this.emitWinscopeEvent(
          new TracePositionUpdate(
            TracePosition.fromTraceEntry(traceEntryToUse),
            true,
          ),
        );
      }
      //we debounce the trace position updates to allow time for UI to render
      await new Timer(this.entrySleepTime, this.entrySleepTime).sleepMs();

      if (this.currPlaybackState === PlaybackState.BACKWARDS) {
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          reachedEndOfTrace = true;
          this.entryIndex = 0;
        } else {
          this.entryIndex = nextIndex;
        }
      } else {
        nextIndex = currentIndex + 1;
        if (nextIndex > lastIndex) {
          reachedEndOfTrace = true;
          this.entryIndex = lastIndex;
        } else {
          this.entryIndex = nextIndex;
        }
      }

      if (reachedEndOfTrace && this.entryIndex === currentIndex) {
        break;
      }
    }
    await this.pause();
  }

  private async buildMap(
    trace: Trace<HierarchyTreeNode>,
    screenRecordingTrace: Trace<MediaBasedTraceEntry> | undefined,
  ) {
    if (this.buffer.length === 0) {
      const length = trace.lengthEntries;
      const allEagerTraceEntries = await trace.getRangeEntryValues({
        start: 0,
        end: length,
      });
      this.buffer = allEagerTraceEntries;
    }

    if (
      this.currentScreenRecording === screenRecordingTrace &&
      screenRecordingTrace !== undefined
    ) {
      return;
    }
    this.currentScreenRecording = screenRecordingTrace;
    let screenRecordingEntries:
      | Array<
          TraceEntryEager<
            MediaBasedTraceEntry,
            MediaBasedTraceEntry | undefined
          >
        >
      | undefined;
    let maximumEntryIndex: number;
    if (this.currentScreenRecording) {
      screenRecordingEntries =
        await this.currentScreenRecording.getRangeEntryValues({
          start: 0,
          end: this.currentScreenRecording.lengthEntries,
        });
      maximumEntryIndex = this.currentScreenRecording.lengthEntries;
    } else {
      maximumEntryIndex = trace.lengthEntries;
    }

    for (let entryIndex = 0; entryIndex < maximumEntryIndex; entryIndex++) {
      let correspondingEntries;

      if (screenRecordingEntries) {
        let eagerCorrespondingTraceEntry;

        const correspondingTraceEntry = findCorrespondingEntry(
          trace,
          TracePosition.fromTraceEntry(screenRecordingEntries[entryIndex]),
        );
        if (correspondingTraceEntry !== undefined) {
          eagerCorrespondingTraceEntry =
            this.buffer[correspondingTraceEntry.getIndex()];
        } else {
          eagerCorrespondingTraceEntry = undefined;
        }
        correspondingEntries = {
          screenRecordingEntry: screenRecordingEntries[entryIndex],
          traceEntry: eagerCorrespondingTraceEntry,
        };
      } else {
        correspondingEntries = {
          screenRecordingEntry: undefined,
          traceEntry: this.buffer[entryIndex],
        };
      }
      this.correspondingEntriesMap.set(entryIndex, correspondingEntries);
    }
  }
}

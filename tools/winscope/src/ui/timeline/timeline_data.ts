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

import {TimeRange, Timestamp} from '@common/time/time';
import {ComponentTimestampConverter} from '@common/time/timestamp_converter';
import {getLogger, Logger} from '@compat/logging';
import {Analytics} from '@logging/analytics';
import {UserNotifier} from '@services/user_notifier';
import {Trace, TraceEntry} from '@trace_api/trace';
import {findCorrespondingEntry} from '@trace_api/trace_entry_finder';
import {TracePosition} from '@trace_api/trace_position';
import {compareByDisplayOrder, isTraceTypeWithViewer, TraceType,} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {timestampToVideoTimeSeconds} from '@trace/media_based/helpers';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {makeWarningCannotParseAllTransitions} from '@ui/trace_loading/warnings';

/**
 * A container of all the timeline-related data.
 *
 * The timeline data is composed of the traces, plus a set of properties (e.g. the current
 * position) that are used to render the timeline UI.
 */
export class TimelineData {
  private traces = new Traces();
  private currentScreenRecordingTrace?: Trace<MediaBasedTraceEntry>;
  private firstEntry?: TraceEntry<unknown>;
  private lastEntry?: TraceEntry<unknown>;
  private explicitlySetPosition?: TracePosition;
  private explicitlySetSelection?: TimeRange;
  private explicitlySetZoomRange?: TimeRange;
  private lastReturnedCurrentPosition?: TracePosition;
  private lastReturnedFullTimeRange?: TimeRange;
  private lastReturnedCurrentEntries = new Map<
    Trace<unknown>,
    TraceEntry<unknown> | undefined
  >();
  private activeTrace: Trace<unknown> | undefined;
  // cached trace entries to avoid TP and object creation latencies each time transition timeline is redrawn
  private transitionEntries: Array<HierarchyTreeNode | undefined> = [];
  private timestampConverter: ComponentTimestampConverter | undefined;
  private isInitialized = false;

  constructor(private readonly logger: Logger = getLogger('TimelineData')) {}

  async initialize(
    traces: Traces,
    screenRecordingTrace: Trace<MediaBasedTraceEntry> | undefined,
    timestampConverter: ComponentTimestampConverter,
  ) {
    if (this.isInitialized) {
      throw new Error('can only initialize TimelineData once');
    }
    this.isInitialized = true;

    this.timestampConverter = timestampConverter;

    this.traces = new Traces();
    traces.forEachTrace((trace) => {
      // Filter out empty traces or dumps with invalid timestamp (would mess up the timeline)
      if (trace.lengthEntries === 0 || trace.isDumpWithoutTimestamp()) {
        return;
      }
      this.traces.addTrace(trace);
    });

    const transitionTrace = this.traces.getTrace<HierarchyTreeNode>(
      TraceType.TRANSITION,
    );
    if (transitionTrace) {
      this.transitionEntries = await transitionTrace.getAllEntryValues();
      if (this.transitionEntries.includes(undefined)) {
        UserNotifier.add(makeWarningCannotParseAllTransitions());
      }
    }

    this.currentScreenRecordingTrace =
      screenRecordingTrace ?? this.traces.getTrace(TraceType.SCREEN_RECORDING);
    this.firstEntry = this.findFirstEntry();
    this.lastEntry = this.findLastEntry();

    const tracesSortedByDisplayOrder = this.traces
      .mapTrace((trace) => trace)
      .filter((trace) => isTraceTypeWithViewer(trace.type))
      .sort((a, b) => {
        // do not set screen recording as active unless it is the only trace
        if (a.type === TraceType.SCREEN_RECORDING) return 1;
        if (b.type === TraceType.SCREEN_RECORDING) return -1;
        return compareByDisplayOrder(a.type, b.type);
      });
    if (tracesSortedByDisplayOrder.length > 0) {
      this.trySetActiveTrace(tracesSortedByDisplayOrder[0]);
    }
  }

  getTransitionEntries(): Array<HierarchyTreeNode | undefined> {
    return this.transitionEntries;
  }

  getTimestampConverter(): ComponentTimestampConverter {
    if (this.timestampConverter === undefined) {
      throw new Error('TimestampData is not initialized');
    }
    return this.timestampConverter;
  }

  getCurrentPosition(): TracePosition | undefined {
    if (this.explicitlySetPosition) {
      return this.explicitlySetPosition;
    }

    let currentPosition: TracePosition | undefined;
    if (this.firstEntry) {
      currentPosition = TracePosition.fromTraceEntry(this.firstEntry);
    }

    const firstActiveEntry = this.getFirstEntryOfActiveViewTrace();
    if (firstActiveEntry) {
      currentPosition = TracePosition.fromTraceEntry(firstActiveEntry);
    }

    if (
      this.lastReturnedCurrentPosition === undefined ||
      currentPosition === undefined ||
      !this.lastReturnedCurrentPosition.isEqual(currentPosition)
    ) {
      this.lastReturnedCurrentPosition = currentPosition;
    }

    return this.lastReturnedCurrentPosition;
  }

  setPosition(position: TracePosition | undefined) {
    if (!this.hasTimestamps()) {
      this.logger.warn(
        'Attempted to set position on traces with no timestamps/entries...',
      );
      return;
    }

    if (this.firstEntry && position) {
      if (
        this.firstEntry.getTimestamp().getValueNs() >
        position.timestamp.getValueNs()
      ) {
        this.explicitlySetPosition = TracePosition.fromTraceEntry(
          this.firstEntry,
        );
        return;
      }
    }

    if (this.lastEntry && position) {
      if (
        this.lastEntry.getTimestamp().getValueNs() <
        position.timestamp.getValueNs()
      ) {
        this.explicitlySetPosition = TracePosition.fromTraceEntry(
          this.lastEntry,
        );
        return;
      }
    }

    this.explicitlySetPosition = position;
  }

  makePositionFromActiveTrace(timestamp: Timestamp): TracePosition {
    if (!this.activeTrace) {
      return TracePosition.fromTimestamp(timestamp);
    }

    const entry = this.activeTrace.findClosestEntry(timestamp);
    if (!entry) {
      return TracePosition.fromTimestamp(timestamp);
    }

    return TracePosition.fromTraceEntry(entry, timestamp);
  }

  trySetActiveTrace(trace: Trace<unknown>): boolean {
    const isTraceWithValidTimestamps = this.traces.hasTrace(trace);
    if (this.activeTrace !== trace && isTraceWithValidTimestamps) {
      this.activeTrace = trace;
      return true;
    }
    return false;
  }

  getActiveTrace() {
    return this.activeTrace;
  }

  getFullTimeRange(): TimeRange {
    if (!this.firstEntry || !this.lastEntry) {
      throw new Error(
        'Trying to get full time range when there are no timestamps',
      );
    }

    const fullTimeRange = new TimeRange(
      this.firstEntry.getTimestamp(),
      this.lastEntry.getTimestamp(),
    );

    if (
      this.lastReturnedFullTimeRange === undefined ||
      this.lastReturnedFullTimeRange.startNs !== fullTimeRange.startNs ||
      this.lastReturnedFullTimeRange.endNs !== fullTimeRange.endNs
    ) {
      this.lastReturnedFullTimeRange = fullTimeRange;
    }

    return this.lastReturnedFullTimeRange;
  }

  getSelectionTimeRange(): TimeRange {
    if (this.explicitlySetSelection === undefined) {
      return this.getFullTimeRange();
    } else {
      return this.explicitlySetSelection;
    }
  }

  setSelectionTimeRange(selection: TimeRange) {
    this.explicitlySetSelection = selection;
  }

  getZoomRange(): TimeRange {
    if (this.explicitlySetZoomRange === undefined) {
      return this.getFullTimeRange();
    } else {
      return this.explicitlySetZoomRange;
    }
  }

  setZoom(zoomRange: TimeRange) {
    this.explicitlySetZoomRange = zoomRange;
  }

  getTraces(): Traces {
    return this.traces;
  }

  hasTrace(trace: Trace<unknown>): boolean {
    return this.traces.hasTrace(trace);
  }

  getCurrentScreenRecordingTrace(): Trace<MediaBasedTraceEntry> | undefined {
    return this.currentScreenRecordingTrace;
  }

  updateCurrentScreenRecordingTrace(value: Trace<MediaBasedTraceEntry>) {
    this.currentScreenRecordingTrace = value;
  }

  searchCorrespondingScreenRecordingTimeSeconds(
    position: TracePosition,
  ): number | undefined {
    const trace = this.traces.getTrace(TraceType.SCREEN_RECORDING);
    if (!trace) {
      return undefined;
    }

    const firstTimestamp = trace.getEntry(0).getTimestamp();
    const logger = getLogger('TimelineData');
    let entry;
    try {
      entry = findCorrespondingEntry(trace, position);
    } catch (e) {
      logger.warn(
        `Could not find corresponding entry: ${(e as Error).message}`,
      );
      Analytics.Error.logFrameMapError((e as Error).message);
    }
    if (!entry) {
      return undefined;
    }

    return timestampToVideoTimeSeconds(
      firstTimestamp.getValueNs(),
      entry.getTimestamp().getValueNs(),
    );
  }

  hasTimestamps(): boolean {
    return this.firstEntry !== undefined;
  }

  hasMoreThanOneDistinctTimestamp(): boolean {
    return (
      this.hasTimestamps() &&
      this.firstEntry?.getTimestamp().getValueNs() !==
        this.lastEntry?.getTimestamp().getValueNs()
    );
  }

  getPreviousEntryFor(trace: Trace<unknown>): TraceEntry<unknown> | undefined {
    if (trace.lengthEntries === 0) {
      return undefined;
    }

    const entry = this.findCurrentEntryFor(trace);
    if (!entry) {
      return undefined;
    }
    const currentIndex = entry.getIndex();
    if (currentIndex === undefined || currentIndex === 0) {
      return undefined;
    }

    return trace.getEntry(currentIndex - 1);
  }

  getNextEntryFor(trace: Trace<unknown>): TraceEntry<unknown> | undefined {
    if (trace.lengthEntries === 0) {
      return undefined;
    }

    const entry = this.findCurrentEntryFor(trace);
    if (!entry) {
      return trace.getEntry(0);
    }
    const currentIndex = entry.getIndex();
    if (currentIndex === undefined) {
      return trace.getEntry(0);
    }

    if (currentIndex + 1 >= trace.lengthEntries) {
      return undefined;
    }

    return trace.getEntry(currentIndex + 1);
  }

  findCurrentEntryFor(trace: Trace<unknown>): TraceEntry<unknown> | undefined {
    const position = this.getCurrentPosition();
    if (!position) {
      return undefined;
    }

    let entry;
    try {
      entry = findCorrespondingEntry(trace, position);
    } catch (e) {
      this.logger.warn(
        `Could not find corresponding entry: ${(e as Error).message}`,
      );
      Analytics.Error.logFrameMapError((e as Error).message);
    }

    if (
      this.lastReturnedCurrentEntries.get(trace)?.getIndex() !==
      entry?.getIndex()
    ) {
      this.lastReturnedCurrentEntries.set(trace, entry);
    }

    return this.lastReturnedCurrentEntries.get(trace);
  }

  moveToPreviousEntryFor(trace: Trace<unknown>) {
    const prevEntry = this.getPreviousEntryFor(trace);
    if (prevEntry !== undefined) {
      this.setPosition(TracePosition.fromTraceEntry(prevEntry));
    }
  }

  moveToNextEntryFor(trace: Trace<unknown>) {
    const nextEntry = this.getNextEntryFor(trace);
    if (nextEntry !== undefined) {
      this.setPosition(TracePosition.fromTraceEntry(nextEntry));
    }
  }

  private findFirstEntry(): TraceEntry<unknown> | undefined {
    let first: TraceEntry<unknown> | undefined;

    this.traces.forEachTrace((trace) => {
      let candidate: TraceEntry<unknown> | undefined;
      for (let i = 0; i < trace.lengthEntries; i++) {
        const entry = trace.getEntry(i);
        if (entry.hasValidTimestamp()) {
          candidate = entry;
          break;
        }
      }
      if (
        candidate &&
        (!first || candidate.getTimestamp() < first.getTimestamp())
      ) {
        first = candidate;
      }
    });

    return first;
  }

  private findLastEntry(): TraceEntry<unknown> | undefined {
    let last: TraceEntry<unknown> | undefined;

    this.traces.forEachTrace((trace) => {
      const candidate = trace.getEntry(trace.lengthEntries - 1);
      if (!last || candidate.getTimestamp() > last.getTimestamp()) {
        last = candidate;
      }
    });

    return last;
  }

  private getFirstEntryOfActiveViewTrace(): TraceEntry<unknown> | undefined {
    if (!this.activeTrace) {
      return undefined;
    }
    return this.activeTrace.getEntry(0);
  }
}

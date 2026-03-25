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

import {assertDefined} from '@common/assert';
import {makeConverterZeroRteOffsets} from '@common/time/testing/test_helpers';
import {TimeRange} from '@common/time/time';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {ParserBuilder} from '@trace_api/testing/parser_builder';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {TracesBuilder} from '@trace_api/testing/traces_builder';
import {TracePosition} from '@trace_api/trace_position';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {makeWarningCannotParseAllTransitions} from '@ui/trace_loading/warnings';

import {TimelineData} from './timeline_data';

describe('TimelineData', () => {
  let timelineData: TimelineData;

  const converter = makeConverterZeroRteOffsets();
  const timestamp0 = converter.makeTimestampFromRealNs(0n);
  const timestamp5 = converter.makeTimestampFromRealNs(5n);
  const timestamp9 = converter.makeTimestampFromRealNs(9n);
  const timestamp10 = converter.makeTimestampFromRealNs(10n);
  const timestamp11 = converter.makeTimestampFromRealNs(11n);

  const traces = new TracesBuilder()
    .setTimestamps(TraceType.PROTO_LOG, [timestamp9])
    .setTimestamps(TraceType.CUJS, [timestamp9])
    .setTimestamps(TraceType.SURFACE_FLINGER, [timestamp10])
    .setTimestamps(TraceType.SCREEN_RECORDING, [timestamp5])
    .setTimestamps(TraceType.WINDOW_MANAGER, [timestamp11])
    .setTimestamps(TraceType.TRANSACTIONS, [])
    .build();

  const traceSf = assertDefined(
    traces.getTrace<HierarchyTreeNode>(TraceType.SURFACE_FLINGER),
  );
  const traceWm = assertDefined(
    traces.getTrace<HierarchyTreeNode>(TraceType.WINDOW_MANAGER),
  );
  const traceSr = assertDefined(
    traces.getTrace<HierarchyTreeNode>(TraceType.SCREEN_RECORDING),
  );
  const traceSr2 = new TraceBuilder<MediaBasedTraceEntry>()
    .setEntries([])
    .build();

  const position10 = TracePosition.fromTraceEntry(
    assertDefined(
      traces.getTrace<HierarchyTreeNode>(TraceType.SURFACE_FLINGER),
    ).getEntry(0),
  );
  const position11 = TracePosition.fromTraceEntry(
    assertDefined(
      traces.getTrace<HierarchyTreeNode>(TraceType.WINDOW_MANAGER),
    ).getEntry(0),
  );
  const position1000 = TracePosition.fromTimestamp(
    converter.makeTimestampFromRealNs(1000n),
  );

  beforeEach(() => {
    timelineData = new TimelineData();
  });

  it('can be initialized without screen recording', () => {
    expect(timelineData.getCurrentPosition()).toBeUndefined();
    timelineData.initialize(traces, undefined, converter);
    expect(timelineData.getCurrentPosition()).toBeDefined();
    expect(timelineData.getCurrentScreenRecordingTrace()).toEqual(traceSr);
  });

  it('initializes with screen recording', () => {
    timelineData.initialize(traces, traceSr2, converter);
    expect(timelineData.getCurrentScreenRecordingTrace()).toEqual(traceSr2);
  });

  it('updates current screen recording', () => {
    timelineData.initialize(traces, undefined, converter);
    expect(timelineData.getCurrentScreenRecordingTrace()).toEqual(traceSr);
    timelineData.updateCurrentScreenRecordingTrace(traceSr2);
    expect(timelineData.getCurrentScreenRecordingTrace()).toEqual(traceSr2);
  });

  it('can only be initialized once', async () => {
    timelineData.initialize(traces, undefined, converter);
    await expectAsync(
      timelineData.initialize(traces, undefined, converter),
    ).toBeRejected();
  });

  describe('dumps', () => {
    const traces = new TracesBuilder()
      .setTimestamps(TraceType.SURFACE_FLINGER, [timestamp10, timestamp11])
      .setTimestamps(TraceType.WINDOW_MANAGER, [timestamp0])
      .build();

    const dumpWm = assertDefined(
      traces.getTrace<HierarchyTreeNode>(TraceType.WINDOW_MANAGER),
    );

    it('drops trace if it is a dump (will not display in timeline UI)', () => {
      timelineData.initialize(traces, undefined, converter);
      expect(
        timelineData.getTraces().getTrace(TraceType.WINDOW_MANAGER),
      ).toBeUndefined();
      expect(timelineData.getFullTimeRange().from).toBe(timestamp10);
      expect(timelineData.getFullTimeRange().to).toBe(timestamp11);
    });

    it('is robust to prev/next entry request of a dump', () => {
      timelineData.initialize(traces, undefined, converter);
      expect(timelineData.getPreviousEntryFor(dumpWm)).toBeUndefined();
      expect(timelineData.getNextEntryFor(dumpWm)).toBeUndefined();
    });
  });

  it('drops empty trace', () => {
    timelineData.initialize(traces, undefined, converter);
    expect(
      timelineData.getTraces().getTrace(TraceType.TRANSACTIONS),
    ).toBeUndefined();
  });

  it('sets first entry as that with valid timestamp', async () => {
    const traces = new TracesBuilder()
      .setTimestamps(TraceType.TRANSITION, [timestamp0, timestamp9])
      .setTimestamps(TraceType.SURFACE_FLINGER, [timestamp9, timestamp10])
      .build();
    await timelineData.initialize(traces, undefined, converter);
    expect(timelineData.getFullTimeRange().from).toEqual(timestamp9);
  });

  it('uses first entry of first active trace by default, excluding screen recording', () => {
    timelineData.initialize(traces, undefined, converter);
    expect(timelineData.getActiveTrace()).toEqual(traceSf);
    expect(timelineData.getCurrentPosition()).toEqual(position10);
  });

  it('defaults active trace to screen recording if it is the only trace', () => {
    const tracesOnlySr = new Traces();
    tracesOnlySr.addTrace(traceSr);
    timelineData.initialize(tracesOnlySr, undefined, converter);
    expect(timelineData.getActiveTrace()).toEqual(traceSr);
  });

  it('uses explicit position if set and valid within time range', () => {
    timelineData.initialize(traces, undefined, converter);
    expect(timelineData.getCurrentPosition()).toEqual(position10);

    timelineData.setPosition(position11);
    expect(timelineData.getCurrentPosition()).toEqual(position11);

    timelineData.trySetActiveTrace(traceSf);
    expect(timelineData.getCurrentPosition()).toEqual(position11);

    timelineData.trySetActiveTrace(traceWm);
    expect(timelineData.getCurrentPosition()).toEqual(position11);

    timelineData.setPosition(position1000);
    expect(timelineData.getCurrentPosition()).not.toEqual(position1000);
  });

  it('crops explicit position to within timeline range', () => {
    timelineData.initialize(traces, undefined, converter);

    timelineData.setPosition(TracePosition.fromTimestamp(timestamp0));
    expect(timelineData.getCurrentPosition()).toEqual(
      TracePosition.fromTraceEntry(traceSr.getEntry(0)),
    );

    timelineData.setPosition(position1000);
    expect(timelineData.getCurrentPosition()).toEqual(position11);
  });

  it('sets active trace and update current position accordingly', () => {
    timelineData.initialize(traces, undefined, converter);

    expect(timelineData.getCurrentPosition()).toEqual(position10);

    timelineData.trySetActiveTrace(traceWm);
    expect(timelineData.getCurrentPosition()).toEqual(position11);

    timelineData.trySetActiveTrace(traceSf);
    expect(timelineData.getCurrentPosition()).toEqual(position10);
  });

  it('does not set active trace if not present in timeline, or already set', () => {
    timelineData.initialize(traces, undefined, converter);

    expect(timelineData.getCurrentPosition()).toEqual(position10);

    let success = timelineData.trySetActiveTrace(traceWm);
    expect(timelineData.getActiveTrace()).toEqual(traceWm);
    expect(success).toBeTrue();

    success = timelineData.trySetActiveTrace(traceWm);
    expect(timelineData.getActiveTrace()).toEqual(traceWm);
    expect(success).toBeFalse();

    success = timelineData.trySetActiveTrace(
      makeEmptyTrace(TraceType.SURFACE_FLINGER),
    );
    expect(timelineData.getActiveTrace()).toEqual(traceWm);
    expect(success).toBeFalse();
  });

  describe('hasTimestamps()', () => {
    it('false for no traces', () => {
      expect(timelineData.hasTimestamps()).toBeFalse();
      const traces = new TracesBuilder().build();
      timelineData.initialize(traces, undefined, converter);
      expect(timelineData.hasTimestamps()).toBeFalse();
    });

    it('false for trace without timestamps', () => {
      const traces = new TracesBuilder()
        .setTimestamps(TraceType.SURFACE_FLINGER, [])
        .build();
      timelineData.initialize(traces, undefined, converter);
      expect(timelineData.hasTimestamps()).toBeFalse();
    });

    it('true for trace with timestamps', () => {
      const traces = new TracesBuilder()
        .setTimestamps(TraceType.SURFACE_FLINGER, [timestamp10])
        .build();
      timelineData.initialize(traces, undefined, converter);
      expect(timelineData.hasTimestamps()).toBeTrue();
    });
  });

  describe('hasMoreThanOneDistinctTimestamp()', () => {
    it('false for no traces', () => {
      expect(timelineData.hasMoreThanOneDistinctTimestamp()).toBeFalse();
      const traces = new TracesBuilder().build();
      timelineData.initialize(traces, undefined, converter);
      expect(timelineData.hasMoreThanOneDistinctTimestamp()).toBeFalse();
    });

    it('false for traces with single distinct timestamp', () => {
      const traces = new TracesBuilder()
        .setTimestamps(TraceType.SURFACE_FLINGER, [timestamp10])
        .setTimestamps(TraceType.WINDOW_MANAGER, [timestamp10])
        .build();
      timelineData.initialize(traces, undefined, converter);
      expect(timelineData.hasMoreThanOneDistinctTimestamp()).toBeFalse();
    });

    it('true for traces with multiple distinct timestamps', () => {
      const traces = new TracesBuilder()
        .setTimestamps(TraceType.SURFACE_FLINGER, [timestamp10])
        .setTimestamps(TraceType.WINDOW_MANAGER, [timestamp11])
        .build();
      timelineData.initialize(traces, undefined, converter);
      expect(timelineData.hasMoreThanOneDistinctTimestamp()).toBeTrue();
    });
  });

  it('getCurrentPosition() returns same object if no change to range', () => {
    timelineData.initialize(traces, undefined, converter);

    expect(timelineData.getCurrentPosition()).toBe(
      timelineData.getCurrentPosition(),
    );

    timelineData.setPosition(position11);

    expect(timelineData.getCurrentPosition()).toBe(
      timelineData.getCurrentPosition(),
    );
  });

  it('makePositionFromActiveTrace()', () => {
    timelineData.initialize(traces, undefined, converter);
    const time100 = converter.makeTimestampFromRealNs(100n);

    {
      timelineData.trySetActiveTrace(traceSf);
      const position = timelineData.makePositionFromActiveTrace(time100);
      expect(position.timestamp).toEqual(time100);
      expect(position.entry).toEqual(traceSf.getEntry(0));
    }

    {
      timelineData.trySetActiveTrace(traceWm);
      const position = timelineData.makePositionFromActiveTrace(time100);
      expect(position.timestamp).toEqual(time100);
      expect(position.entry).toEqual(traceWm.getEntry(0));
    }
  });

  it('getFullTimeRange() returns same object if no change to range', () => {
    timelineData.initialize(traces, undefined, converter);

    expect(timelineData.getFullTimeRange()).toBe(
      timelineData.getFullTimeRange(),
    );
  });

  it('getSelectionTimeRange() returns same object if no change to range', () => {
    timelineData.initialize(traces, undefined, converter);

    expect(timelineData.getSelectionTimeRange()).toBe(
      timelineData.getSelectionTimeRange(),
    );

    timelineData.setSelectionTimeRange(new TimeRange(timestamp0, timestamp5));

    expect(timelineData.getSelectionTimeRange()).toBe(
      timelineData.getSelectionTimeRange(),
    );
  });

  it('getZoomRange() returns same object if no change to range', () => {
    timelineData.initialize(traces, undefined, converter);

    expect(timelineData.getZoomRange()).toBe(timelineData.getZoomRange());

    timelineData.setZoom(new TimeRange(timestamp0, timestamp5));

    expect(timelineData.getZoomRange()).toBe(timelineData.getZoomRange());
  });

  it("getCurrentPosition() prioritizes active trace's first entry", () => {
    timelineData.initialize(traces, undefined, converter);
    timelineData.trySetActiveTrace(traceWm);

    expect(timelineData.getCurrentPosition()?.timestamp).toBe(timestamp11);
  });

  it('handles partially corrupted transitions trace', async () => {
    const userNotifierChecker = new UserNotifierChecker();

    const transition = new HierarchyTreeBuilder()
      .setId('TransitionsTraceEntry')
      .setName('transition')
      .build();

    const traces = new Traces();
    const trace = new TraceBuilder<HierarchyTreeNode | undefined>()
      .setType(TraceType.TRANSITION)
      .setParser(
        new ParserBuilder<HierarchyTreeNode | undefined>()
          .setEntries([transition, undefined])
          .setTimestamps([timestamp9, timestamp9])
          .build(),
      )
      .build();
    traces.addTrace(trace);

    await timelineData.initialize(traces, undefined, converter);
    userNotifierChecker.expectAdded([makeWarningCannotParseAllTransitions()]);
    expect(timelineData.getTransitionEntries()).toEqual([
      transition,
      undefined,
    ]);
  });
});

/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {makeRealTimestamp} from '@common/time/testing/test_helpers';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {extractFrames} from '@trace_api/testing/traces_test_helpers';

import {CustomQueryType} from './custom_query';
import {FrameMapper} from './frame_mapper';
import {AbsoluteFrameIndex} from './index_types';
import {Trace} from './trace';
import {TraceType} from './trace_type';
import {Traces} from './traces';

describe('FrameMapper', () => {
  const time0 = makeRealTimestamp(0n);
  const time1 = makeRealTimestamp(1n);
  const time2 = makeRealTimestamp(2n);
  const time3 = makeRealTimestamp(3n);
  const time4 = makeRealTimestamp(4n);
  const time5 = makeRealTimestamp(5n);
  const time6 = makeRealTimestamp(6n);
  const time7 = makeRealTimestamp(7n);
  const time8 = makeRealTimestamp(8n);
  const time10seconds = makeRealTimestamp(10n * 1000000000n);

  describe('ProtoLog <-> WindowManager', () => {
    let protoLog: Trace<unknown>;
    let windowManager: Trace<unknown>;
    let traces: Traces;

    beforeAll(async () => {
      // Frames              F0        F1
      //                 |<------>|  |<->|
      // PROTO_LOG:      0  1  2     3  4  5
      // WINDOW_MANAGER:          0     1
      // Time:           0  1  2  3  4  5  6
      protoLog = new TraceBuilder()
        .setType(TraceType.PROTO_LOG)
        .setEntries([
          'entry-0',
          'entry-1',
          'entry-2',
          'entry-3',
          'entry-4',
          'entry-5',
        ])
        .setTimestamps([time0, time1, time2, time4, time5, time6])
        .build();

      windowManager = new TraceBuilder()
        .setType(TraceType.WINDOW_MANAGER)
        .setEntries(['entry-0', 'entry-1'])
        .setTimestamps([time3, time5])
        .build();

      traces = new Traces();
      traces.addTrace(protoLog);
      traces.addTrace(windowManager);
      await new FrameMapper(traces).computeMapping();
    });

    it('associates entries/frames', async () => {
      const expectedFrames = new Map<
        AbsoluteFrameIndex,
        Map<TraceType, unknown[]>
      >();
      expectedFrames.set(
        0,
        new Map<TraceType, unknown[]>([
          [TraceType.PROTO_LOG, ['entry-0', 'entry-1', 'entry-2']],
          [TraceType.WINDOW_MANAGER, ['entry-0']],
        ]),
      );
      expectedFrames.set(
        1,
        new Map<TraceType, unknown[]>([
          [TraceType.PROTO_LOG, ['entry-3', 'entry-4']],
          [TraceType.WINDOW_MANAGER, ['entry-1']],
        ]),
      );

      expect(await extractFrames(traces)).toEqual(expectedFrames);
    });
  });

  describe('IME <-> WindowManager', () => {
    let ime: Trace<unknown>;
    let windowManager: Trace<unknown>;
    let traces: Traces;

    beforeAll(async () => {
      // IME:            0--1--2     3
      //                    |        |
      // WINDOW_MANAGER:    0        1  2
      // Time:           0  1  2  3  4  5
      ime = new TraceBuilder()
        .setType(TraceType.INPUT_METHOD_CLIENTS)
        .setEntries(['entry-0', 'entry-1', 'entry-2', 'entry-3'])
        .setTimestamps([time0, time1, time2, time4])
        .build();

      windowManager = new TraceBuilder()
        .setType(TraceType.WINDOW_MANAGER)
        .setEntries(['entry-0', 'entry-1', 'entry-2'])
        .setTimestamps([time1, time4, time5])
        .build();

      traces = new Traces();
      traces.addTrace(ime);
      traces.addTrace(windowManager);
      await new FrameMapper(traces).computeMapping();
    });

    it('associates entries/frames', async () => {
      const expectedFrames = new Map<
        AbsoluteFrameIndex,
        Map<TraceType, unknown[]>
      >();
      expectedFrames.set(
        0,
        new Map<TraceType, unknown[]>([
          [TraceType.INPUT_METHOD_CLIENTS, ['entry-0', 'entry-1', 'entry-2']],
          [TraceType.WINDOW_MANAGER, ['entry-0']],
        ]),
      );
      expectedFrames.set(
        1,
        new Map<TraceType, unknown[]>([
          [TraceType.INPUT_METHOD_CLIENTS, ['entry-3']],
          [TraceType.WINDOW_MANAGER, ['entry-1']],
        ]),
      );
      expectedFrames.set(
        2,
        new Map<TraceType, unknown[]>([
          [TraceType.INPUT_METHOD_CLIENTS, []],
          [TraceType.WINDOW_MANAGER, ['entry-2']],
        ]),
      );

      expect(await extractFrames(traces)).toEqual(expectedFrames);
    });
  });

  describe('WindowManager <-> Transactions', () => {
    let windowManager: Trace<unknown>;
    let transactions: Trace<unknown>;
    let traces: Traces;

    beforeAll(async () => {
      // WINDOW_MANAGER:     0  1     2  3
      //                     |  |     |    \
      // TRANSACTIONS:    0  1  2--3  4     5  ... 6  <-- ignored (not connected) because too far
      //                  |  |   |    |     |      |
      // Frames:          0  1   2    3     4  ... 5
      // Time:            0  1  2  3  4  5  6  ... 10s
      windowManager = new TraceBuilder()
        .setType(TraceType.WINDOW_MANAGER)
        .setEntries(['entry-0', 'entry-1', 'entry-2', 'entry-3'])
        .setTimestamps([time1, time2, time4, time5])
        .build();

      transactions = new TraceBuilder()
        .setType(TraceType.TRANSACTIONS)
        .setEntries([
          'entry-0',
          'entry-1',
          'entry-2',
          'entry-3',
          'entry-4',
          'entry-5',
          'entry-6',
        ])
        .setTimestamps([
          time0,
          time1,
          time2,
          time3,
          time4,
          time5,
          time10seconds,
        ])
        .setFrame(0, 0)
        .setFrame(1, 1)
        .setFrame(2, 2)
        .setFrame(3, 2)
        .setFrame(4, 3)
        .setFrame(5, 4)
        .setFrame(6, 5)
        .build();

      traces = new Traces();
      traces.addTrace(windowManager);
      traces.addTrace(transactions);
      await new FrameMapper(traces).computeMapping();
    });

    it('associates entries/frames', async () => {
      const expectedFrames = new Map<
        AbsoluteFrameIndex,
        Map<TraceType, unknown[]>
      >();
      expectedFrames.set(
        0,
        new Map<TraceType, unknown[]>([
          [TraceType.WINDOW_MANAGER, []],
          [TraceType.TRANSACTIONS, ['entry-0']],
        ]),
      );
      expectedFrames.set(
        1,
        new Map<TraceType, unknown[]>([
          [TraceType.WINDOW_MANAGER, ['entry-0']],
          [TraceType.TRANSACTIONS, ['entry-1']],
        ]),
      );
      expectedFrames.set(
        2,
        new Map<TraceType, unknown[]>([
          [TraceType.WINDOW_MANAGER, ['entry-1']],
          [TraceType.TRANSACTIONS, ['entry-2', 'entry-3']],
        ]),
      );
      expectedFrames.set(
        3,
        new Map<TraceType, unknown[]>([
          [TraceType.WINDOW_MANAGER, ['entry-2']],
          [TraceType.TRANSACTIONS, ['entry-4']],
        ]),
      );
      expectedFrames.set(
        4,
        new Map<TraceType, unknown[]>([
          [TraceType.WINDOW_MANAGER, ['entry-3']],
          [TraceType.TRANSACTIONS, ['entry-5']],
        ]),
      );
      expectedFrames.set(
        5,
        new Map<TraceType, unknown[]>([
          [TraceType.WINDOW_MANAGER, []],
          [TraceType.TRANSACTIONS, ['entry-6']],
        ]),
      );

      expect(await extractFrames(traces)).toEqual(expectedFrames);
    });
  });

  describe('ViewCapture <-> SurfaceFlinger', () => {
    let viewCapture: Trace<unknown>;
    let surfaceFlinger: Trace<unknown>;
    let traces: Traces;

    beforeAll(async () => {
      // VIEW_CAPTURE:   0  1  2---     3
      //                  \     \  \     \
      //                   \     \  \     \
      // SURFACE_FLINGER:   0     1  2     3
      // Time:           0  1  2  3  4  5  6
      viewCapture = new TraceBuilder()
        .setType(TraceType.VIEW_CAPTURE)
        .setEntries(['entry-0', 'entry-1', 'entry-2', 'entry-3'])
        .setTimestamps([time0, time1, time2, time5])
        .build();

      surfaceFlinger = new TraceBuilder()
        .setType(TraceType.SURFACE_FLINGER)
        .setEntries(['entry-0', 'entry-1', 'entry-2', 'entry-3'])
        .setTimestamps([time1, time3, time4, time6])
        .setFrame(0, 0)
        .setFrame(1, 1)
        .setFrame(2, 2)
        .setFrame(3, 3)
        .build();

      traces = new Traces();
      traces.addTrace(viewCapture);
      traces.addTrace(surfaceFlinger);
      await new FrameMapper(traces).computeMapping();
    });

    it('associates entries/frames', async () => {
      const expectedFrames = new Map<
        AbsoluteFrameIndex,
        Map<TraceType, unknown[]>
      >();
      expectedFrames.set(
        0,
        new Map<TraceType, unknown[]>([
          [TraceType.VIEW_CAPTURE, [await viewCapture.getEntry(0).getValue()]],
          [
            TraceType.SURFACE_FLINGER,
            [await surfaceFlinger.getEntry(0).getValue()],
          ],
        ]),
      );
      expectedFrames.set(
        1,
        new Map<TraceType, unknown[]>([
          [TraceType.VIEW_CAPTURE, [await viewCapture.getEntry(2).getValue()]],
          [
            TraceType.SURFACE_FLINGER,
            [await surfaceFlinger.getEntry(1).getValue()],
          ],
        ]),
      );
      expectedFrames.set(
        2,
        new Map<TraceType, unknown[]>([
          [TraceType.VIEW_CAPTURE, [await viewCapture.getEntry(2).getValue()]],
          [
            TraceType.SURFACE_FLINGER,
            [await surfaceFlinger.getEntry(2).getValue()],
          ],
        ]),
      );
      expectedFrames.set(
        3,
        new Map<TraceType, unknown[]>([
          [TraceType.VIEW_CAPTURE, [await viewCapture.getEntry(3).getValue()]],
          [
            TraceType.SURFACE_FLINGER,
            [await surfaceFlinger.getEntry(3).getValue()],
          ],
        ]),
      );

      expect(await extractFrames(traces)).toEqual(expectedFrames);
    });
  });

  const TRACES_WITH_VSYNC_IDS = [
    TraceType.TRANSACTIONS,
    TraceType.INPUT_EVENT_MERGED,
  ];

  TRACES_WITH_VSYNC_IDS.forEach((traceType) => {
    describe(`TraceType[${traceType}] <-> SurfaceFlinger`, () => {
      const sfTrace = new TraceBuilder()
        .setType(TraceType.SURFACE_FLINGER)
        .setEntries(['sfentry-0', 'sfentry-1', 'sfentry-2'])
        .setTimestamps([time0, time1, time2])
        .setParserCustomQueryResult(CustomQueryType.VSYNCID, [10n, 20n, 30n])
        .build();
      const entries = ['entry-0', 'entry-1', 'entry-2', 'entry-3', 'entry-4'];
      let trace: Trace<unknown>;
      let traces: Traces;

      it('associates entries/frames', async () => {
        // TRACE:          0  1--2        3  4
        //                  \     \        \
        //                   \     \        \
        // SURFACE_FLINGER:   0     1        2
        trace = new TraceBuilder()
          .setType(traceType)
          .setEntries(entries)
          .setTimestamps([time0, time1, time2, time5, time6])
          .setParserCustomQueryResult(CustomQueryType.VSYNCID, [
            10n,
            20n,
            20n,
            30n,
            40n,
          ])
          .build();
        await computeMapping();
        const expectedFrames = await getExpectedFrameMap([
          [[0], 0],
          [[1, 2], 1],
          [[3], 2],
        ]);
        expect(await extractFrames(traces)).toEqual(expectedFrames);
      });

      it('does not propagate mapping if all vsync ids invalid', async () => {
        trace = new TraceBuilder()
          .setType(traceType)
          .setEntries(['entry-0'])
          .setTimestamps([time1])
          .setParserCustomQueryResult(CustomQueryType.VSYNCID, [-1n])
          .build();

        const sfTrace = new TraceBuilder()
          .setType(TraceType.SURFACE_FLINGER)
          .setEntries(['entry-0'])
          .setTimestamps([time1])
          .setParserCustomQueryResult(CustomQueryType.VSYNCID, [1n])
          .build();

        await computeMapping(sfTrace);
        expect(sfTrace.getEntry(0).getFramesRange()).toBeDefined();
        expect(trace.hasFrameInfo()).toBeFalse();
      });

      it('skips invalid vsync ids', async () => {
        // SURFACE_FLINGER: 0  1  2
        //                  |   \  \___
        //                  |    \     \
        // TRACE:           0  1  2  3  4
        trace = new TraceBuilder()
          .setType(traceType)
          .setEntries(entries)
          .setTimestamps([time0, time1, time2, time3, time4])
          .setParserCustomQueryResult(CustomQueryType.VSYNCID, [
            10n,
            0n,
            20n,
            -1n,
            30n,
          ])
          .build();

        await computeMapping();
        const expectedFrames = await getExpectedFrameMap([
          [[0], 0],
          [[2], 1],
          [[4], 2],
        ]);
        expect(await extractFrames(traces)).toEqual(expectedFrames);
      });

      async function computeMapping(surfaceFlingerTrace = sfTrace) {
        traces = new Traces();
        traces.addTrace(trace);
        traces.addTrace(surfaceFlingerTrace);
        await new FrameMapper(traces).computeMapping();
      }

      async function getExpectedFrameMap(
        expected: Array<[number[], number]>,
      ): Promise<Map<AbsoluteFrameIndex, Map<TraceType, unknown[]>>> {
        const expectedFrames = new Map<
          AbsoluteFrameIndex,
          Map<TraceType, unknown[]>
        >();
        for (const [
          frameIndex,
          [traceIndexes, sfIndex],
        ] of expected.entries()) {
          const traceEntries = await Promise.all(
            traceIndexes.map((i) => trace.getEntry(i).getValue()),
          );
          const sfEntries = [await sfTrace.getEntry(sfIndex).getValue()];
          expectedFrames.set(
            frameIndex,
            new Map<TraceType, unknown[]>([
              [traceType, traceEntries],
              [TraceType.SURFACE_FLINGER, sfEntries],
            ]),
          );
        }
        return expectedFrames;
      }
    });
  });

  describe('SurfaceFlinger <-> ScreenRecording', () => {
    let surfaceFlinger: Trace<unknown>;
    let screenRecording: Trace<unknown>;
    let traces: Traces;

    beforeAll(async () => {
      // SURFACE_FLINGER:      0  1  2---  3     4  5  6
      //                              \  \  \        \
      //                               \  \  \        \
      // SCREEN_RECORDING:     0        1  2  3        4 ... 5 <-- ignored (not connected) because too far
      // Time:                 0  1  2  3  4  5  6  7  8     10s
      surfaceFlinger = new TraceBuilder()
        .setType(TraceType.SURFACE_FLINGER)
        .setEntries([
          'entry-0',
          'entry-1',
          'entry-2',
          'entry-3',
          'entry-4',
          'entry-5',
          'entry-6',
        ])
        .setTimestamps([time0, time1, time2, time4, time6, time7, time8])
        .build();

      screenRecording = new TraceBuilder()
        .setType(TraceType.SCREEN_RECORDING)
        .setEntries([
          'entry-0',
          'entry-1',
          'entry-2',
          'entry-3',
          'entry-4',
          'entry-5',
        ])
        .setTimestamps([time0, time3, time4, time5, time8, time10seconds])
        .build();

      traces = new Traces();
      traces.addTrace(surfaceFlinger);
      traces.addTrace(screenRecording);
      await new FrameMapper(traces).computeMapping();
    });

    it('associates entries/frames', async () => {
      const expectedFrames = new Map<
        AbsoluteFrameIndex,
        Map<TraceType, unknown[]>
      >();
      expectedFrames.set(
        0,
        new Map<TraceType, unknown[]>([
          [TraceType.SURFACE_FLINGER, []],
          [TraceType.SCREEN_RECORDING, ['entry-0']],
        ]),
      );
      expectedFrames.set(
        1,
        new Map<TraceType, unknown[]>([
          [TraceType.SURFACE_FLINGER, ['entry-2']],
          [TraceType.SCREEN_RECORDING, ['entry-1']],
        ]),
      );
      expectedFrames.set(
        2,
        new Map<TraceType, unknown[]>([
          [TraceType.SURFACE_FLINGER, ['entry-2']],
          [TraceType.SCREEN_RECORDING, ['entry-2']],
        ]),
      );
      expectedFrames.set(
        3,
        new Map<TraceType, unknown[]>([
          [TraceType.SURFACE_FLINGER, ['entry-3']],
          [TraceType.SCREEN_RECORDING, ['entry-3']],
        ]),
      );
      expectedFrames.set(
        4,
        new Map<TraceType, unknown[]>([
          [TraceType.SURFACE_FLINGER, ['entry-5']],
          [TraceType.SCREEN_RECORDING, ['entry-4']],
        ]),
      );
      expectedFrames.set(
        5,
        new Map<TraceType, unknown[]>([
          [TraceType.SURFACE_FLINGER, []],
          [TraceType.SCREEN_RECORDING, ['entry-5']],
        ]),
      );

      expect(await extractFrames(traces)).toEqual(expectedFrames);
    });
  });

  it('supports multiple traces with same type', async () => {
    // SURFACE_FLINGER_0:    0
    //                        \
    //                         \
    // SURFACE_FLINGER_1:    0  \
    //                        \ |
    //                         \|
    // SCREEN_RECORDING:        0
    // Time:                 0  1
    const surfaceFlinger0 = new TraceBuilder()
      .setType(TraceType.SURFACE_FLINGER)
      .setEntries(['entry-0'])
      .setTimestamps([time0])
      .build();

    const surfaceFlinger1 = new TraceBuilder()
      .setType(TraceType.SURFACE_FLINGER)
      .setEntries(['entry-0'])
      .setTimestamps([time0])
      .build();

    const screenRecording = new TraceBuilder()
      .setType(TraceType.SCREEN_RECORDING)
      .setEntries(['entry-0'])
      .setTimestamps([time1])
      .build();

    const traces = new Traces();
    traces.addTrace(surfaceFlinger0);
    traces.addTrace(surfaceFlinger1);
    traces.addTrace(screenRecording);
    await new FrameMapper(traces).computeMapping();

    expect(surfaceFlinger0.getEntry(0).getFramesRange()).toEqual({
      start: 0,
      end: 1,
    });
    expect(surfaceFlinger1.getEntry(0).getFramesRange()).toEqual({
      start: 0,
      end: 1,
    });
    expect(screenRecording.getEntry(0).getFramesRange()).toEqual({
      start: 0,
      end: 1,
    });
  });

  it('does not propagate mapping if frames range undefined', async () => {
    const validTs = time1.add(2000000000n);
    const transactions = new TraceBuilder()
      .setType(TraceType.TRANSACTIONS)
      .setEntries(['entry-0'])
      .setTimestamps([validTs])
      .setFrame(0, 0)
      .build();
    const windowManager = new TraceBuilder()
      .setType(TraceType.WINDOW_MANAGER)
      .setEntries(['entry-0'])
      .setTimestamps([time0])
      .build();
    const ime = new TraceBuilder()
      .setType(TraceType.INPUT_METHOD_MANAGER_SERVICE)
      .setEntries(['entry-0'])
      .setTimestamps([validTs])
      .build();

    const traces = new Traces();
    traces.addTrace(transactions);
    traces.addTrace(windowManager);
    traces.addTrace(ime);
    await new FrameMapper(traces).computeMapping();

    expect(transactions.getEntry(0).getFramesRange()).toBeDefined();
    expect(windowManager.getEntry(0).getFramesRange()).toBeDefined();
    expect(ime.hasFrameInfo()).toBeFalse();
  });
});

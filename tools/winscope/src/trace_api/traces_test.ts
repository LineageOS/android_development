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

import {assertDefined} from '@common/assert';
import {makeRealTimestamp} from '@common/time/testing/test_helpers';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {extractEntries as extractTraceEntries, makeEmptyTrace,} from '@trace_api/testing/trace_test_helpers';
import {TracesBuilder} from '@trace_api/testing/traces_builder';
import {extractEntries, extractFrames, extractTraces,} from '@trace_api/testing/traces_test_helpers';

import {FrameMapBuilder} from './frame_map_builder';
import {AbsoluteFrameIndex} from './index_types';
import {TraceType} from './trace_type';
import {Traces} from './traces';

describe('Traces', () => {
  let traces: Traces;

  const time1 = makeRealTimestamp(1n);
  const time2 = makeRealTimestamp(2n);
  const time3 = makeRealTimestamp(3n);
  const time4 = makeRealTimestamp(4n);
  const time5 = makeRealTimestamp(5n);
  const time6 = makeRealTimestamp(6n);
  const time7 = makeRealTimestamp(7n);
  const time8 = makeRealTimestamp(8n);
  const time9 = makeRealTimestamp(9n);
  const time10 = makeRealTimestamp(10n);

  const extractedEntriesEmpty: ReadonlyMap<TraceType, Array<{}>> = new Map([
    [TraceType.TEST_TRACE_STRING, []],
    [TraceType.TEST_TRACE_NUMBER, []],
  ]);
  const extractedEntriesFull: ReadonlyMap<TraceType, Array<{}>> = new Map([
    [TraceType.TEST_TRACE_STRING, ['0', '1', '2', '3', '4']],
    [TraceType.TEST_TRACE_NUMBER, [0, 1, 2, 3, 4]],
  ]);
  const extractedFramesEmpty: ReadonlyMap<
    AbsoluteFrameIndex,
    Map<TraceType, Array<{}>>
  > = new Map();
  const extractedFramesFull: ReadonlyMap<
    AbsoluteFrameIndex,
    Map<TraceType, Array<{}>>
  > = new Map([
    [
      0,
      new Map<TraceType, Array<{}>>([
        [TraceType.TEST_TRACE_STRING, ['0']],
        [TraceType.TEST_TRACE_NUMBER, [0]],
      ]),
    ],
    [
      1,
      new Map<TraceType, Array<{}>>([
        [TraceType.TEST_TRACE_STRING, ['1', '2']],
        [TraceType.TEST_TRACE_NUMBER, [1]],
      ]),
    ],
    [
      2,
      new Map<TraceType, Array<{}>>([
        [TraceType.TEST_TRACE_STRING, ['3']],
        [TraceType.TEST_TRACE_NUMBER, [2, 3]],
      ]),
    ],
    [
      3,
      new Map<TraceType, Array<{}>>([
        [TraceType.TEST_TRACE_STRING, ['4']],
        [TraceType.TEST_TRACE_NUMBER, [4]],
      ]),
    ],
    [
      4,
      new Map<TraceType, Array<{}>>([
        [TraceType.TEST_TRACE_STRING, ['4']],
        [TraceType.TEST_TRACE_NUMBER, [4]],
      ]),
    ],
  ]);

  beforeAll(() => {
    // Time:               1  2  3  4  5  6  7  8  9 10
    //
    // TEST_TRACE_STRING:  0     1--2     3        4
    //                      \        \     \        \
    //                       \        \     \        \
    // TEST_TRACE_NUMBER:     0        1     2--3     4
    //                         \        \        \     \
    //                          \        \        \     \
    // Frame on screen:          0        1        2     3---4
    traces = new Traces();
    traces.addTrace(
      new TraceBuilder<string>()
        .setType(TraceType.TEST_TRACE_STRING)
        .setEntries(['0', '1', '2', '3', '4'])
        .setTimestamps([time1, time3, time4, time6, time9])
        .setFrame(0, 0)
        .setFrame(1, 1)
        .setFrame(2, 1)
        .setFrame(3, 2)
        .setFrame(4, 3)
        .setFrame(4, 4)
        .build(),
    );
    traces.addTrace(
      new TraceBuilder<number>()
        .setType(TraceType.TEST_TRACE_NUMBER)
        .setEntries([0, 1, 2, 3, 4])
        .setTimestamps([time2, time5, time7, time8, time10])
        .setFrame(0, 0)
        .setFrame(1, 1)
        .setFrame(2, 2)
        .setFrame(3, 2)
        .setFrame(4, 3)
        .setFrame(4, 4)
        .build(),
    );
  });

  it('getTrace()', async () => {
    expect(
      await extractTraceEntries(
        assertDefined(traces.getTrace(TraceType.TEST_TRACE_STRING)),
      ),
    ).toEqual(
      extractedEntriesFull.get(TraceType.TEST_TRACE_STRING) as string[],
    );
    expect(
      await extractTraceEntries(
        assertDefined(traces.getTrace(TraceType.TEST_TRACE_NUMBER)),
      ),
    ).toEqual(
      extractedEntriesFull.get(TraceType.TEST_TRACE_NUMBER) as number[],
    );
    expect(traces.getTrace(TraceType.SURFACE_FLINGER)).toBeUndefined();
  });

  it('getTraces()', async () => {
    expect(traces.getTraces(TraceType.TEST_TRACE_NUMBER)).toEqual([
      assertDefined(traces.getTrace(TraceType.TEST_TRACE_NUMBER)),
    ]);
  });

  it('deleteTrace()', () => {
    const trace0 = makeEmptyTrace(TraceType.TEST_TRACE_STRING);
    const trace1 = makeEmptyTrace(TraceType.TEST_TRACE_NUMBER);

    const traces = new Traces();
    traces.addTrace(trace0);
    traces.addTrace(trace1);

    expect(extractTraces(traces)).toEqual([trace0, trace1]);

    traces.deleteTrace(trace0);
    expect(extractTraces(traces)).toEqual([trace1]);

    traces.deleteTrace(trace1);
    expect(extractTraces(traces)).toEqual([]);

    traces.deleteTrace(trace1);
    expect(extractTraces(traces)).toEqual([]);
  });

  it('hasTrace()', () => {
    const trace0 = makeEmptyTrace(TraceType.TEST_TRACE_STRING);
    const trace1 = makeEmptyTrace(TraceType.TEST_TRACE_NUMBER);

    const traces = new Traces();
    traces.addTrace(trace0);

    expect(traces.hasTrace(trace0)).toBeTrue();
    expect(traces.hasTrace(trace1)).toBeFalse();
  });

  it('sliceTime()', async () => {
    // empty
    {
      const slice = traces.sliceTime(time3, time3);
      expect(await extractEntries(slice)).toEqual(
        new Map(extractedEntriesEmpty),
      );
    }
    // full
    {
      const slice = traces.sliceTime();
      expect(await extractEntries(slice)).toEqual(
        new Map(extractedEntriesFull),
      );
    }
    // middle
    {
      const slice = traces.sliceTime(time4, time8);
      expect(await extractEntries(slice)).toEqual(
        new Map<TraceType, Array<{}>>([
          [TraceType.TEST_TRACE_STRING, ['2', '3']],
          [TraceType.TEST_TRACE_NUMBER, [1, 2]],
        ]),
      );
    }
    // slice away front
    {
      const slice = traces.sliceTime(time8);
      expect(await extractEntries(slice)).toEqual(
        new Map<TraceType, Array<{}>>([
          [TraceType.TEST_TRACE_STRING, ['4']],
          [TraceType.TEST_TRACE_NUMBER, [3, 4]],
        ]),
      );
    }
    // slice away back
    {
      const slice = traces.sliceTime(undefined, time8);
      expect(await extractEntries(slice)).toEqual(
        new Map<TraceType, Array<{}>>([
          [TraceType.TEST_TRACE_STRING, ['0', '1', '2', '3']],
          [TraceType.TEST_TRACE_NUMBER, [0, 1, 2]],
        ]),
      );
    }
  });

  it('sliceFrames()', async () => {
    // empty
    {
      const slice = traces.sliceFrames(1, 1);
      expect(await extractFrames(slice)).toEqual(new Map(extractedFramesEmpty));
    }
    // full
    {
      const slice = traces.sliceFrames();
      expect(await extractFrames(slice)).toEqual(new Map(extractedFramesFull));
    }
    // middle
    {
      const slice = traces.sliceFrames(1, 4);
      const expectedFrames: Map<
        AbsoluteFrameIndex,
        Map<TraceType, Array<{}>>
      > = new Map([
        [1, assertDefined(extractedFramesFull.get(1))],
        [2, assertDefined(extractedFramesFull.get(2))],
        [3, assertDefined(extractedFramesFull.get(3))],
      ]);
      expect(await extractFrames(slice)).toEqual(expectedFrames);
    }
    // slice away front
    {
      const slice = traces.sliceFrames(2);
      const expectedFrames: Map<
        AbsoluteFrameIndex,
        Map<TraceType, Array<{}>>
      > = new Map([
        [2, assertDefined(extractedFramesFull.get(2))],
        [3, assertDefined(extractedFramesFull.get(3))],
        [4, assertDefined(extractedFramesFull.get(4))],
      ]);
      expect(await extractFrames(slice)).toEqual(expectedFrames);
    }
    // slice away back
    {
      const slice = traces.sliceFrames(undefined, 2);
      const expectedFrames: Map<
        AbsoluteFrameIndex,
        Map<TraceType, Array<{}>>
      > = new Map([
        [0, assertDefined(extractedFramesFull.get(0))],
        [1, assertDefined(extractedFramesFull.get(1))],
      ]);
      expect(await extractFrames(slice)).toEqual(expectedFrames);
    }
  });

  it('mapTrace()', async () => {
    const promises = traces.mapTrace(async (trace) => {
      const expectedEntries = extractedEntriesFull.get(trace.type) as Array<{}>;
      const actualEntries = await extractTraceEntries(trace);
      expect(actualEntries).toEqual(expectedEntries);
    });
    await Promise.all(promises);
  });

  it('mapFrame()', async () => {
    expect(await extractFrames(traces)).toEqual(new Map(extractedFramesFull));
  });

  it('supports empty traces', async () => {
    const traces = new TracesBuilder()
      .setEntries(TraceType.TEST_TRACE_STRING, [])
      .setFrameMap(
        TraceType.TEST_TRACE_STRING,
        new FrameMapBuilder(0, 0).build(),
      )

      .setEntries(TraceType.TEST_TRACE_NUMBER, [])
      .setFrameMap(
        TraceType.TEST_TRACE_NUMBER,
        new FrameMapBuilder(0, 0).build(),
      )
      .build();

    expect(await extractEntries(traces)).toEqual(
      new Map(extractedEntriesEmpty),
    );
    expect(await extractFrames(traces)).toEqual(new Map(extractedFramesEmpty));

    expect(await extractEntries(traces.sliceTime(time1, time10))).toEqual(
      new Map(extractedEntriesEmpty),
    );
    expect(await extractFrames(traces.sliceTime(time1, time10))).toEqual(
      new Map(extractedFramesEmpty),
    );

    expect(await extractEntries(traces.sliceFrames(0, 10))).toEqual(
      new Map(extractedEntriesEmpty),
    );
    expect(await extractFrames(traces.sliceFrames(0, 10))).toEqual(
      new Map(extractedFramesEmpty),
    );
  });

  it('supports unavailable frame mapping', async () => {
    const traces = new TracesBuilder()
      .setEntries(TraceType.TEST_TRACE_STRING, ['entry-0'])
      .setTimestamps(TraceType.TEST_TRACE_STRING, [time1])
      .setFrameMap(TraceType.TEST_TRACE_STRING, undefined)

      .setEntries(TraceType.TEST_TRACE_NUMBER, [0])
      .setTimestamps(TraceType.TEST_TRACE_NUMBER, [time1])
      .setFrameMap(TraceType.TEST_TRACE_NUMBER, undefined)
      .build();

    const expectedEntries = new Map<TraceType, Array<{}>>([
      [TraceType.TEST_TRACE_STRING, ['entry-0']],
      [TraceType.TEST_TRACE_NUMBER, [0]],
    ]);

    expect(await extractEntries(traces)).toEqual(expectedEntries);
    expect(await extractEntries(traces.sliceTime())).toEqual(expectedEntries);

    expect(() => {
      traces.sliceFrames();
    }).toThrow();
    expect(() => {
      traces.forEachFrame(() => {});
    }).toThrow();
    expect(() => {
      traces.mapFrame(() => {});
    }).toThrow();
  });

  it('supports multiple traces with same type', () => {
    const traceShort = new TraceBuilder<number>()
      .setType(TraceType.TEST_TRACE_NUMBER)
      .setEntries([0])
      .build();
    const traceLong = new TraceBuilder<number>()
      .setType(TraceType.TEST_TRACE_NUMBER)
      .setEntries([1, 2])
      .build();

    const traces = new Traces();
    traces.addTrace(traceShort);
    traces.addTrace(traceLong);

    expect(traces.getTraces(TraceType.TEST_TRACE_NUMBER)).toEqual([
      traceShort,
      traceLong,
    ]);
    expect(traces.getTrace(TraceType.TEST_TRACE_NUMBER)).toEqual(traceLong);
  });
});

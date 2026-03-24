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

import {makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {TraceBuilder} from '@trace_api/testing/trace_builder';

describe('TraceEntry', () => {
  beforeAll(() => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
  });

  it('getFullTrace()', () => {
    const trace = new TraceBuilder<string>()
      .setTimestamps([makeRealTimestamp(10n), makeRealTimestamp(11n)])
      .setEntries(['entry-0', 'entry-1'])
      .build();
    expect(trace.getEntry(0).getFullTrace()).toEqual(trace);
    expect(trace.sliceEntries(0, 1).getEntry(0).getFullTrace()).toEqual(trace);
  });

  it('getIndex()', () => {
    const trace = new TraceBuilder<string>()
      .setTimestamps([
        makeRealTimestamp(10n),
        makeRealTimestamp(11n),
        makeRealTimestamp(12n),
        makeRealTimestamp(13n),
      ])
      .setEntries(['entry-0', 'entry-1', 'entry-2', 'entry-3'])
      .build();
    expect(trace.getEntry(0).getIndex()).toBe(0);
    expect(trace.sliceEntries(2, 4).getEntry(0).getIndex()).toBe(2);
    expect(trace.sliceEntries(2, 4).getEntry(1).getIndex()).toBe(3);
  });

  it('getTimestamp()', () => {
    const trace = new TraceBuilder<string>()
      .setTimestamps([makeRealTimestamp(10n), makeRealTimestamp(11n)])
      .setEntries(['entry-0', 'entry-1'])
      .build();
    expect(trace.getEntry(0).getTimestamp()).toEqual(makeRealTimestamp(10n));
    expect(trace.getEntry(1).getTimestamp()).toEqual(makeRealTimestamp(11n));
  });

  it('getFramesRange()', () => {
    const trace = new TraceBuilder<string>()
      .setTimestamps([
        makeRealTimestamp(10n),
        makeRealTimestamp(11n),
        makeRealTimestamp(12n),
        makeRealTimestamp(13n),
        makeRealTimestamp(14n),
        makeRealTimestamp(15n),
      ])
      .setEntries([
        'entry-0',
        'entry-1',
        'entry-2',
        'entry-3',
        'entry-4',
        'entry-5',
      ])
      .setFrame(0, 0)
      .setFrame(0, 1)
      .setFrame(1, 1)
      .setFrame(2, 1)
      .setFrame(3, 2)
      .setFrame(5, 4)
      .build();
    expect(trace.getEntry(0).getFramesRange()).toEqual({start: 0, end: 2});
    expect(trace.getEntry(1).getFramesRange()).toEqual({start: 1, end: 2});
    expect(trace.getEntry(2).getFramesRange()).toEqual({start: 1, end: 2});
    expect(trace.getEntry(3).getFramesRange()).toEqual({start: 2, end: 3});
    expect(trace.getEntry(4).getFramesRange()).toBeUndefined();
    expect(trace.getEntry(5).getFramesRange()).toEqual({start: 4, end: 5});
  });

  it('getValue()', async () => {
    const trace = new TraceBuilder<string>()
      .setTimestamps([makeRealTimestamp(10n), makeRealTimestamp(11n)])
      .setEntries(['entry-0', 'entry-1'])
      .build();
    expect(await trace.getEntry(0).getValue()).toBe('entry-0');
    expect(await trace.getEntry(1).getValue()).toBe('entry-1');
  });
});

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

import {
  makeZeroTimestamp,
  timestampEqualityTester,
} from '@test/unit/time_test_helpers';
import {TraceType} from '@trace_api/trace_type';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {LegacyFileReaderProvider} from '@test/unit/fixture_utils';

describe('FileReaderTransitionsWm', () => {
  let reader: LegacyFileReader;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    reader = await new LegacyFileReaderProvider()
      .addFile('traces/elapsed_and_real_timestamp/wm_transition_trace.pb')
      .get();
  });

  it('has expected trace type', () => {
    expect(reader.getTraceType()).toEqual(TraceType.WM_TRANSITION);
  });

  it('provides timestamps', () => {
    const timestamps = reader.getTimestamps();
    expect(timestamps.length).toBe(8);
    const expected = makeZeroTimestamp();
    timestamps.forEach((timestamp) => expect(timestamp).toEqual(expected));
  });

  it('converst to valid perfetto packets', async () => {
    const packets = reader.convertToPerfettoPackets(0);
    expect(packets.length).toBe(8);
    expect(packets[0].shellTransition).toBeDefined();
    const transition = packets[0].shellTransition;
    expect(transition?.id).toBe(6);
    expect(transition?.startTransactionId?.toString()).toBe('13086765351818');
    expect(transition?.sendTimeNs?.toString()).toBe('57649646973488');
  });
});

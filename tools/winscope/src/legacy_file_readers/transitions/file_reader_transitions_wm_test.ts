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
import {setupJspbTesting} from '@compat/test/protobuf';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {LegacyFileReaderProvider} from '@legacy_file_readers/testing/fixture_utils';
import {TraceType} from '@trace_api/trace_type';

import {FileReaderTransitionsWm} from './file_reader_transitions_wm';

describe('FileReaderTransitionsWm', () => {
  let reader: LegacyFileReader;

  beforeAll(async () => {
    setupJspbTesting();
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    reader = await new LegacyFileReaderProvider([
      FileReaderTransitionsWm.createInstance,
    ])
      .addFile('traces/elapsed_and_real_timestamp/wm_transition_trace.pb')
      .get();
  });

  it('has expected trace type', () => {
    expect(reader.getTraceType()).toEqual(TraceType.WM_TRANSITION);
  });

  it('provides timestamps', () => {
    const timestamps = reader.getTimestamps();
    const zeroTs = makeRealTimestamp(0n);
    const expected = [
      makeRealTimestamp(1683188477603625811n),
      zeroTs,
      zeroTs,
      zeroTs,
      makeRealTimestamp(1683188479251408771n),
      makeRealTimestamp(1683188481345218790n),
      zeroTs,
      zeroTs,
    ];
    expect(timestamps).toEqual(expected);
  });

  it('converst to valid perfetto packets', async () => {
    const packets = reader.convertToPerfettoPackets(0);
    expect(packets.length).toBe(8);
    expect(packets[0].getShellTransition()).toBeDefined();
    const transition = packets[0].getShellTransition();
    expect(transition?.getId()).toBe(6);
    expect(transition?.getStartTransactionId()?.toString()).toBe(
      '13086765351818',
    );
    expect(transition?.getSendTimeNs()?.toString()).toBe('57649646973488');
  });
});

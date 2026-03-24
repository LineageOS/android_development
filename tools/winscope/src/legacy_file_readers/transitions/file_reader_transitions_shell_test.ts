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
import {makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {setupJspbTesting} from '@compat/test/protobuf';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {LegacyFileReaderProvider} from '@legacy_file_readers/testing/fixture_utils';
import {TraceType} from '@trace_api/trace_type';

import {FileReaderTransitionsShell} from './file_reader_transitions_shell';

describe('FileReaderTransitionsShell', () => {
  let reader: LegacyFileReader;

  beforeAll(async () => {
    setupJspbTesting();
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    reader = await new LegacyFileReaderProvider([
      FileReaderTransitionsShell.createInstance,
    ])
      .addFile('traces/elapsed_and_real_timestamp/shell_transition_trace.pb')
      .get();
  });

  it('has expected trace type', () => {
    expect(reader.getTraceType()).toEqual(TraceType.SHELL_TRANSITION);
  });

  it('provides timestamps', () => {
    const timestamps = reader.getTimestamps();
    const zeroTs = makeRealTimestamp(0n);
    const expected = [
      makeRealTimestamp(1683188477607285317n),
      makeRealTimestamp(1683188477785406289n),
      zeroTs,
      makeRealTimestamp(1683188479256449868n),
      zeroTs,
      zeroTs,
    ];
    expect(timestamps).toEqual(expected);
  });

  it('converts to valid perfetto packets', async () => {
    const packets = reader.convertToPerfettoPackets(0);
    expect(packets.length).toBe(7);
    const handlerPacket = packets[0];

    const mapping = assertDefined(
      handlerPacket.getShellHandlerMappings()?.getMappingList(),
    );

    expect(mapping.length).toBe(2);
    expect(mapping[0].getId()).toBe(2);
    expect(mapping[0].getName()).toBe(
      'com.android.wm.shell.transition.DefaultMixedHandler',
    );
    expect(mapping[1].getId()).toBe(3);
    expect(mapping[1].getName()).toBe(
      'com.android.wm.shell.recents.RecentsTransitionHandler',
    );

    expect(packets[1].getShellTransition()).toBeDefined();
    const transition = packets[1].getShellTransition();
    expect(transition?.getId()).toBe(6);
    expect(transition?.getDispatchTimeNs()?.toString()).toBe('57649649922341');
    expect(transition?.getHandler()).toBe(2);
  });
});

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

import {assertDefined} from 'common/assert';
import {com} from 'protos/transitions/udc/static';
import {LegacyParserProvider} from 'test/unit/fixture_utils';
import {
  makeRealTimestamp,
  timestampEqualityTester,
} from 'test/unit/time_test_helpers';
import {CoarseVersion} from 'trace_api/coarse_version';
import {Parser} from 'trace_api/parser';
import {TraceType} from 'trace_api/trace_type';
import {ParserTransitionsShell} from './parser_transitions_shell';

describe('ParserTransitionsShell', () => {
  let parser: Parser<com.android.wm.shell.Transition>;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = await new LegacyParserProvider()
      .addFile('traces/elapsed_and_real_timestamp/shell_transition_trace.pb')
      .getParser<com.android.wm.shell.Transition>();
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(TraceType.SHELL_TRANSITION);
  });

  it('has expected coarse version', () => {
    expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LEGACY);
  });

  it('provides timestamps', () => {
    const timestamps = assertDefined(parser.getTimestamps());
    const expected = [
      makeRealTimestamp(1683188477607285317n),
      makeRealTimestamp(1683130827957362976n),
      makeRealTimestamp(1683130827957362976n),
      makeRealTimestamp(1683188479256449868n),
      makeRealTimestamp(1683130827957362976n),
      makeRealTimestamp(1683130827957362976n),
    ];
    expect(timestamps).toEqual(expected);
  });

  it('provides decoded proto', async () => {
    const entry = await parser.getEntry(0);
    expect(entry.id).toBe(6);
    expect(entry.dispatchTimeNs.toString()).toBe('57649649922341');
    expect(entry.handler).toBe(2);
  });

  it('creates shell mapping packet', async () => {
    expect(parser).toBeInstanceOf(ParserTransitionsShell);
    const mappingPacketEnc = (
      parser as unknown as ParserTransitionsShell
    ).createHandlerMappingPacket(2);

    expect(mappingPacketEnc.trustedPacketSequenceId).toEqual(2);
    const mapping = assertDefined(
      mappingPacketEnc.shellHandlerMappings?.mapping,
    );

    expect(mapping.length).toBe(2);
    expect(mapping[0].id).toBe(2);
    expect(mapping[0].name).toBe(
      'com.android.wm.shell.transition.DefaultMixedHandler',
    );
    expect(mapping[1].id).toBe(3);
    expect(mapping[1].name).toBe(
      'com.android.wm.shell.recents.RecentsTransitionHandler',
    );
  });
});

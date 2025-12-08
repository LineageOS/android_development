/*
 * Copyright (C) 2024 The Android Open Source Project
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
import {getPerfettoParser} from 'test/unit/fixture_utils';
import {
  makeRealTimestamp,
  timestampEqualityTester,
} from 'test/unit/time_test_helpers';
import {TraceBuilder} from 'test/unit/trace_builder';
import {ProtologColumnType} from 'trace/protolog/protolog_column_type';
import {CustomQueryType} from 'trace_api/custom_query';
import {Parser} from 'trace_api/parser';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';

describe('PerfettoParserProtolog', () => {
  let parser: Parser<HierarchyTreeNode>;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = await getPerfettoParser(
      TraceType.PROTO_LOG,
      'traces/perfetto/protolog.perfetto-trace',
    );
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(TraceType.PROTO_LOG);
  });

  it('provides timestamps', () => {
    const timestamps = assertDefined(parser.getTimestamps());

    expect(timestamps.length).toBe(3);

    const expected = [
      makeRealTimestamp(1713866817780323315n),
      makeRealTimestamp(1713866817780323415n),
      makeRealTimestamp(1713866817780323445n),
    ];
    expect(timestamps.slice(0, 3)).toEqual(expected);
  });

  it('retrieves all entries', async () => {
    const entries = await parser.getAllEntries();
    expect(entries.length).toBe(3);
    expect(entries.every((entry) => entry !== undefined)).toBeTrue();
  });

  it('reconstructs human-readable log message (REAL time)', async () => {
    const message = await parser.getEntry(0);

    expect(
      assertDefined(message.getEagerPropertyByName('message')).formattedValue(),
    ).toBe(
      'Test message with different int formats: 888, 0o1570, 0x378, 888.000000, 8.880000e+02.',
    );
    expect(
      assertDefined(message.getEagerPropertyByName('ts')).formattedValue(),
    ).toBe('2024-04-23, 10:06:57.780');
    expect(
      assertDefined(message.getEagerPropertyByName('tag')).formattedValue(),
    ).toBe('MySecondGroup');
    expect(
      assertDefined(message.getEagerPropertyByName('level')).formattedValue(),
    ).toBe('WARN');
    expect(
      assertDefined(
        message.getEagerPropertyByName('location'),
      ).formattedValue(),
    ).toBe('file1');

    const message2 = await parser.getEntry(1);
    expect(message2.getEagerPropertyByName('location')).toBeUndefined();
  });

  it('messages are ordered by timestamp', async () => {
    let prevEntryTs = 0n;
    for (let i = 0; i < parser.getLengthEntries(); i++) {
      const ts = assertDefined(
        (await parser.getEntry(i))
          .getEagerPropertyByName('ts')
          ?.getValue<bigint>(),
      );
      expect(ts >= prevEntryTs).toBeTrue();
      prevEntryTs = ts;
    }
  });

  it('timestamps are ordered', () => {
    let prevEntryTs = 0n;
    for (const ts of assertDefined(parser.getTimestamps())) {
      expect(ts.getValueNs() >= prevEntryTs).toBeTrue();
      prevEntryTs = ts.getValueNs();
    }
  });

  it('supports LOG_TABLE_FILTER_VALUES custom query', async () => {
    const trace = new TraceBuilder()
      .setType(TraceType.PROTO_LOG)
      .setParser(parser)
      .build();
    const traceEntries = trace.sliceEntries(0, 3);

    const tags = await traceEntries.customQuery(
      CustomQueryType.LOG_TABLE_FILTER_VALUES,
      ProtologColumnType.TAG,
    );
    expect(tags).toEqual(['MyFirstGroup', 'MySecondGroup', 'MyThirdGroup']);

    const levels = await traceEntries.customQuery(
      CustomQueryType.LOG_TABLE_FILTER_VALUES,
      ProtologColumnType.LEVEL,
    );
    expect(levels).toEqual(['DEBUG', 'ERROR', 'WARN']);

    const locations = await traceEntries.customQuery(
      CustomQueryType.LOG_TABLE_FILTER_VALUES,
      ProtologColumnType.LOCATION,
    );
    expect(locations).toEqual(['<NO_LOC>', 'file1']);
  });
});

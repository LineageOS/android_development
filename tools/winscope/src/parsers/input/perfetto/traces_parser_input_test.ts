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
import {getTracesParser} from 'test/unit/fixture_utils';
import {
  makeRealTimestamp,
  timestampEqualityTester,
} from 'test/unit/time_test_helpers';
import {TraceBuilder} from 'test/unit/trace_builder';
import {UserNotifierChecker} from 'test/unit/user_notifier_checker';
import {CoarseVersion} from 'trace_api/coarse_version';
import {CustomQueryType} from 'trace_api/custom_query';
import {Parser} from 'trace_api/parser';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {PropertyTreeNode} from 'tree_node/property_tree_node';

describe('TracesParserInput', () => {
  let parser: Parser<HierarchyTreeNode>;
  let userNotifierChecker: UserNotifierChecker;

  beforeAll(() => {
    userNotifierChecker = new UserNotifierChecker();
  });

  beforeEach(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = (
      await getTracesParser(['traces/perfetto/input-events.perfetto-trace'])
    ).tracesParser as Parser<HierarchyTreeNode>;
    userNotifierChecker.reset();
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(TraceType.INPUT_EVENT_MERGED);
  });

  it('has expected coarse version', () => {
    expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
  });

  it('has expected descriptors', () => {
    expect(parser.getDescriptors()).toEqual(['input-events.perfetto-trace']);
  });

  it('provides timestamps', () => {
    const timestamps = assertDefined(parser.getTimestamps());
    const expected = [
      makeRealTimestamp(1718386903800330430n),
      makeRealTimestamp(1718386903800330430n),
      makeRealTimestamp(1718386903821511338n),
      makeRealTimestamp(1718386903827304592n),
      makeRealTimestamp(1718386903836681382n),
      makeRealTimestamp(1718386903841727281n),
      makeRealTimestamp(1718386905115026232n),
      makeRealTimestamp(1718386905123057319n),
    ];
    expect(timestamps).toEqual(expected);
  });

  it('retrieves all entries', async () => {
    const entries = await parser.getAllEntries();
    expect(entries.length).toBe(8);
    expect(entries.every((entry) => entry !== undefined)).toBeTrue();
  });

  it('provides correct entries from individual event traces', async () => {
    const keyEvent = await parser.getEntry(6);
    expect(keyEvent.getEagerPropertyByName('eventId')?.getValue()).toEqual(
      759309047n,
    );
    expect(keyEvent.getEagerPropertyByName('type')?.formattedValue()).toEqual(
      'KEY',
    );

    const motionEvent = await parser.getEntry(0);
    expect(motionEvent.getEagerPropertyByName('eventId')?.getValue()).toEqual(
      330184796n,
    );
    expect(motionEvent.getEagerPropertyByName('type')?.formattedValue()).toBe(
      'MOTION',
    );
  });

  it('supports VSYNCID custom query', async () => {
    const trace = new TraceBuilder()
      .setType(TraceType.INPUT_EVENT_MERGED)
      .setParser(parser)
      .build();
    const entries = await trace
      .sliceEntries(4, 7)
      .customQuery(CustomQueryType.VSYNCID);
    const values = entries.map((entry) => entry.getValue());
    expect(values).toEqual([89113n, 89113n, 89114n]);
    userNotifierChecker.expectNone();
  });

  it('supports VSYNCID custom query with missing vsync_ids', async () => {
    const missingVsyncIdsParser = (
      await getTracesParser([
        'traces/perfetto/input-missing-vsync-ids.perfetto-trace',
      ])
    ).tracesParser as Parser<PropertyTreeNode>;
    const trace = new TraceBuilder()
      .setType(TraceType.INPUT_EVENT_MERGED)
      .setParser(missingVsyncIdsParser)
      .build();
    const entries = await trace.customQuery(CustomQueryType.VSYNCID);
    expect(entries).toHaveSize(missingVsyncIdsParser.getLengthEntries());
  });
});

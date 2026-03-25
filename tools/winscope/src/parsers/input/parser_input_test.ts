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

import {makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {getParserInput} from '@parsers/fixture_utils';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {CoarseVersion} from '@trace_api/coarse_version';
import {CustomQueryType} from '@trace_api/custom_query';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

describe('ParserInput', () => {
  let parser: Parser<HierarchyTreeNode>;

  beforeEach(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
  });

  describe('key and motion events', () => {
    beforeEach(async () => {
      parser = await getParserInput(
        'traces/perfetto/input-events.perfetto-trace',
      );
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
      const timestamps = parser.getTimestamps();
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
      expect(
        keyEvent.getEagerPropertyByName('eventId')?.getValue()?.toString(),
      ).toEqual('759309047');
      expect(keyEvent.getEagerPropertyByName('type')?.formattedValue()).toEqual(
        'KEY',
      );

      const motionEvent = await parser.getEntry(0);
      expect(
        motionEvent.getEagerPropertyByName('eventId')?.getValue()?.toString(),
      ).toEqual('330184796');
      expect(motionEvent.getEagerPropertyByName('type')?.formattedValue()).toBe(
        'MOTION',
      );
    });

    it('supports VSYNCID custom query', async () => {
      const userNotifierChecker = new UserNotifierChecker();
      const entries = await parser.customQuery(CustomQueryType.VSYNCID, {
        start: 4,
        end: 7,
      });
      expect(entries).toEqual([89113n, 89113n, 89114n]);
      userNotifierChecker.expectNone();
    });

    it('supports VSYNCID custom query with missing vsync_ids', async () => {
      const missingVsyncIdsParser = await getParserInput(
        'traces/perfetto/input-missing-vsync-ids.perfetto-trace',
      );
      const entries = await missingVsyncIdsParser.customQuery(
        CustomQueryType.VSYNCID,
        {
          start: 0,
          end: missingVsyncIdsParser.getLengthEntries(),
        },
      );
      expect(entries).toHaveSize(missingVsyncIdsParser.getLengthEntries());
    });
  });

  describe('key events', () => {
    beforeEach(async () => {
      parser = await getParserInput(
        'traces/perfetto/input-key-events.perfetto-trace',
      );
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.INPUT_EVENT_MERGED);
    });

    it('has expected coarse version', () => {
      expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
    });

    it('has expected descriptors', () => {
      expect(parser.getDescriptors()).toEqual([
        'input-key-events.perfetto-trace',
      ]);
    });

    it('provides timestamps', () => {
      const timestamps = parser.getTimestamps();
      const expected = [
        makeRealTimestamp(1718386905115026232n),
        makeRealTimestamp(1718386905123057319n),
      ];
      expect(timestamps).toEqual(expected);
    });

    it('retrieves all entries', async () => {
      const entries = await parser.getAllEntries();
      expect(entries.length).toBe(2);
      expect(
        entries.every((entry) => {
          return (
            entry?.getEagerPropertyByName('type')?.formattedValue() === 'KEY'
          );
        }),
      ).toBeTrue();
    });
  });

  describe('motion events', () => {
    beforeEach(async () => {
      parser = await getParserInput(
        'traces/perfetto/input-motion-events.perfetto-trace',
      );
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.INPUT_EVENT_MERGED);
    });

    it('has expected coarse version', () => {
      expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
    });

    it('has expected descriptors', () => {
      expect(parser.getDescriptors()).toEqual([
        'input-motion-events.perfetto-trace',
      ]);
    });

    it('provides timestamps', () => {
      const timestamps = parser.getTimestamps();
      const expected = [
        makeRealTimestamp(1718386903800330430n),
        makeRealTimestamp(1718386903800330430n),
        makeRealTimestamp(1718386903821511338n),
        makeRealTimestamp(1718386903827304592n),
        makeRealTimestamp(1718386903836681382n),
        makeRealTimestamp(1718386903841727281n),
      ];
      expect(timestamps).toEqual(expected);
    });

    it('retrieves all entries', async () => {
      const entries = await parser.getAllEntries();
      expect(entries.length).toBe(6);
      expect(
        entries.every((entry) => {
          return (
            entry?.getEagerPropertyByName('type')?.formattedValue() === 'MOTION'
          );
        }),
      ).toBeTrue();
    });
  });
});

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
import {getPerfettoParser} from '@parsers/fixture_utils';
import {CoarseVersion} from '@trace_api/coarse_version';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

describe('PerfettoParserTransitions', () => {
  describe('valid trace', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      parser = (
        await getPerfettoParser(
          TraceType.TRANSITION,
          'traces/perfetto/shell_transitions_trace.perfetto-trace',
        )
      ).parser;
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.TRANSITION);
    });

    it('has expected coarse version', () => {
      expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
    });

    it('provides timestamps', () => {
      const expected = [
        makeRealTimestamp(1700573425441880645n),
        makeRealTimestamp(1700573426515461660n),
        makeRealTimestamp(1700573433038142327n),
        makeRealTimestamp(1700573433279358351n),
        makeRealTimestamp(1700573433279359351n),
      ];
      const actual = parser.getTimestamps();
      expect(actual).toEqual(expected);
    });

    it('retrieves all entries', async () => {
      const entries = await parser.getAllEntries();
      expect(entries.length).toBe(5);
      expect(entries.every((entry) => entry !== undefined)).toBeTrue();
    });

    it('extracts eager properties', async () => {
      const entry0 = await parser.getEntry(0);

      expect(
        entry0.getEagerPropertyByName('transitionId')?.getValue()?.toString(),
      ).toBe('32');
      expect(
        entry0.getEagerPropertyByName('transitionType')?.formattedValue(),
      ).toBe('OPEN');

      expect(
        entry0.getEagerPropertyByName('createTimeNs')?.formattedValue(),
      ).toBe('2023-11-21, 13:30:25.429');
      expect(
        entry0.getEagerPropertyByName('sendTimeNs')?.formattedValue(),
      ).toBe('2023-11-21, 13:30:25.442');
      expect(
        entry0.getEagerPropertyByName('dispatchTimeNs')?.formattedValue(),
      ).toBe('2023-11-21, 13:30:25.448');
      expect(
        entry0.getEagerPropertyByName('finishTimeNs')?.formattedValue(),
      ).toBe('2023-11-21, 13:30:25.970');
      expect(
        entry0.getEagerPropertyByName('durationNs')?.formattedValue(),
      ).toBe('522 ms');

      const layerParticipants: bigint[] = assertDefined(
        entry0.getEagerPropertyByName('layers'),
      )
        .getAllChildren()
        .map((child) => child.getValue())
        .filter((value): value is bigint => value !== undefined);
      expect(layerParticipants.length).toBe(2);
      expect(layerParticipants).toContain(47n);
      expect(layerParticipants).toContain(398n);

      const windowParticipants: bigint[] = assertDefined(
        entry0.getEagerPropertyByName('windows'),
      )
        .getAllChildren()
        .map((child) => child.getValue())
        .filter((value): value is bigint => value !== undefined);
      expect(windowParticipants.length).toBe(2);
      expect(windowParticipants).toContain(159077656n);
      expect(windowParticipants).toContain(193491296n);

      expect(entry0.getEagerPropertyByName('handler')?.formattedValue()).toBe(
        'com.android.wm.shell.transition.DefaultMixedHandler',
      );
      expect(entry0.getEagerPropertyByName('status')?.formattedValue()).toBe(
        'PLAYED',
      );

      const entry1 = await parser.getEntry(1);
      expect(entry1.getEagerPropertyByName('flags')?.formattedValue()).toBe(
        'TRANSIT_FLAG_IS_RECENTS',
      );

      const entry3 = await parser.getEntry(3);
      expect(
        entry3.getEagerPropertyByName('shellAbortTimeNs')?.formattedValue(),
      ).toBe('2023-11-21, 13:30:33.280');
      expect(
        entry3.getEagerPropertyByName('mergeTimeNs')?.formattedValue(),
      ).toBe('2023-11-21, 13:30:33.280');

      const entry4 = await parser.getEntry(4);
      expect(
        entry4.getEagerPropertyByName('wmAbortTimeNs')?.formattedValue(),
      ).toBe('2023-11-21, 13:30:33.279');
    });

    it('decodes lazy transition properties', async () => {
      const entry0 = await parser.getEntry(0);

      const properties = await entry0.getAllProperties();

      expect(properties.getChildByName('id')?.getValue<number>()).toBe(32);
      expect(properties.getChildByName('createTimeNs')?.formattedValue()).toBe(
        '2023-11-21, 13:30:25.429',
      );
      expect(properties.getChildByName('sendTimeNs')?.formattedValue()).toBe(
        '2023-11-21, 13:30:25.442',
      );
      expect(properties.getChildByName('finishTimeNs')?.formattedValue()).toBe(
        '2023-11-21, 13:30:25.970',
      );
      expect(entry0.getEagerPropertyByName('status')?.getValue<string>()).toBe(
        'played',
      );

      expect(
        assertDefined(
          properties.getChildByName('startingWindowRemoveTimeNs'),
        ).formattedValue(),
      ).toBe('2023-11-21, 13:30:25.565');
      expect(
        assertDefined(
          properties.getChildByName('startTransactionId'),
        ).formattedValue(),
      ).toBe('5811090758076');
      expect(
        assertDefined(
          properties.getChildByName('finishTransactionId'),
        ).formattedValue(),
      ).toBe('5811090758077');
      expect(
        assertDefined(properties.getChildByName('type')).formattedValue(),
      ).toBe('OPEN');

      const changes = assertDefined(
        properties.getChildByName('changes'),
      ).getAllChildren();
      expect(changes.length).toBe(2);
      expect(
        assertDefined(changes[0].getChildByName('layerId')).formattedValue(),
      ).toBe('398');
      expect(
        assertDefined(changes[1].getChildByName('layerId')).formattedValue(),
      ).toBe('47');
      expect(
        assertDefined(changes[0].getChildByName('mode')).formattedValue(),
      ).toBe('TO_FRONT');
      expect(
        assertDefined(changes[1].getChildByName('mode')).formattedValue(),
      ).toBe('TO_BACK');
      expect(
        assertDefined(changes[0].getChildByName('flags')).formattedValue(),
      ).toBe('FLAG_MOVED_TO_TOP');
      expect(
        assertDefined(changes[1].getChildByName('flags')).formattedValue(),
      ).toBe('FLAG_SHOW_WALLPAPER');

      expect(
        properties.getChildByName('dispatchTimeNs')?.formattedValue(),
      ).toBe('2023-11-21, 13:30:25.448');
      expect(properties.getChildByName('mergeRequestTime')).toBeUndefined();
      expect(properties.getChildByName('mergeTime')).toBeUndefined();
      expect(properties.getChildByName('shellAbortTimeNs')).toBeUndefined();
      expect(properties.getChildByName('mergeTarget')).toBeUndefined();
      expect(
        assertDefined(properties.getChildByName('handler')).formattedValue(),
      ).toBe('com.android.wm.shell.transition.DefaultMixedHandler');

      const entry1 = await parser.getEntry(1);
      expect(
        (await entry1.getAllProperties())
          .getChildByName('flags')
          ?.formattedValue(),
      ).toBe('TRANSIT_FLAG_IS_RECENTS');

      const entry3 = await parser.getEntry(3);
      const properties3 = await entry3.getAllProperties();
      expect(
        properties3.getChildByName('shellAbortTimeNs')?.formattedValue(),
      ).toBe('2023-11-21, 13:30:33.280');
      expect(properties3.getChildByName('mergeTimeNs')?.formattedValue()).toBe(
        '2023-11-21, 13:30:33.280',
      );

      const entry4 = await parser.getEntry(4);
      expect(
        (await entry4.getAllProperties())
          .getChildByName('wmAbortTimeNs')
          ?.formattedValue(),
      ).toBe('2023-11-21, 13:30:33.279');
    });
  });
});

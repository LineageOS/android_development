/*
 * Copyright (C) 2025 The Android Open Source Project
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
import {NonPerfettoParserProvider} from '@parsers/fixture_utils';
import {CoarseVersion} from '@trace_api/coarse_version';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {CUJ_TYPE_FORMATTER, DEFAULT_PROPERTY_FORMATTER, TIMESTAMP_NODE_FORMATTER,} from '@trace/formatters';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';

describe('ParserCujs', () => {
  describe('trace with monotonically increasing timestamps', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      parser = (await new NonPerfettoParserProvider()
        .addFile('traces/elapsed_and_real_timestamp/eventlog.winscope')
        .get()) as Parser<HierarchyTreeNode>;
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.CUJS);
    });

    it('has expected coarse version', () => {
      expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LEGACY);
    });

    it('has expected descriptors', () => {
      expect(parser.getDescriptors()).toEqual(['eventlog.winscope']);
    });

    it('has expected timestamps', () => {
      const expected = [
        makeRealTimestamp(1681207048025446000n),
        makeRealTimestamp(1681207048025551000n),
        makeRealTimestamp(1681207048025580000n),
      ];

      const timestamps = parser.getTimestamps();
      expect(timestamps.length).toBe(16);
      expect(timestamps.slice(0, 3)).toEqual(expected);
    });

    it('contains parsed jank CUJ events', async () => {
      const entry = await parser.getEntry(2);

      const expected = new PropertyTreeBuilder()
        .setRootId('CujTrace')
        .setName('cuj')
        .setIsRoot(true)
        .setChildren([
          {
            name: 'cujType',
            value: 66,
            formatter: CUJ_TYPE_FORMATTER,
          },
          {
            name: 'startTimestamp',
            value: makeRealTimestamp(1681207048025580000n),
            formatter: TIMESTAMP_NODE_FORMATTER,
          },
          {
            name: 'endTimestamp',
            value: makeRealTimestamp(1681207048643085000n),
            formatter: TIMESTAMP_NODE_FORMATTER,
          },
          {
            name: 'canceled',
            value: true,
            formatter: DEFAULT_PROPERTY_FORMATTER,
          },
        ])
        .build();
      expected.setIsRoot(true);

      expect(await entry.getAllProperties()).toEqual(expected);
    });
  });

  describe('trace with timestamps not monotonically increasing', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      parser = (await new NonPerfettoParserProvider()
        .addFile(
          'traces/elapsed_and_real_timestamp/eventlog_timestamps_not_monotonically_increasing.winscope',
        )
        .get()) as Parser<HierarchyTreeNode>;
    });

    it('sorts entries to make timestamps monotonically increasing', () => {
      const expected = [makeRealTimestamp(1681207048025446000n)];
      expect(parser.getTimestamps()).toEqual(expected);
    });

    it('contains parsed events', async () => {
      const entry = await parser.getEntry(0);

      const expected = new PropertyTreeBuilder()
        .setRootId('CujTrace')
        .setName('cuj')
        .setIsRoot(true)
        .setChildren([
          {
            name: 'cujType',
            value: 11,
            formatter: CUJ_TYPE_FORMATTER,
          },
          {
            name: 'startTimestamp',
            value: makeRealTimestamp(1681207048025446000n),
            formatter: TIMESTAMP_NODE_FORMATTER,
          },
          {
            name: 'endTimestamp',
            value: makeRealTimestamp(1681207048642792000n),
            formatter: TIMESTAMP_NODE_FORMATTER,
          },
          {
            name: 'canceled',
            value: true,
            formatter: DEFAULT_PROPERTY_FORMATTER,
          },
        ])
        .build();
      expected.setIsRoot(true);

      expect(await entry.getAllProperties()).toEqual(expected);
    });
  });

  describe('trace with no CUJ events', () => {
    it('fails due to empty trace', async () => {
      const provider = new NonPerfettoParserProvider().addFile(
        'traces/elapsed_and_real_timestamp/eventlog_no_cujs.winscope',
      );
      await expectAsync(provider.get()).toBeRejected();
    });
  });
});

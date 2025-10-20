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
import {getTracesParser} from 'test/unit/fixture_utils';
import {
  makeRealTimestamp,
  timestampEqualityTester,
  UTC_CONVERTER,
} from 'test/unit/time_test_helpers';
import {PropertyTreeBuilder} from 'test/unit/property_tree_builder';
import {
  CUJ_TYPE_FORMATTER,
  DEFAULT_PROPERTY_FORMATTER,
  TIMESTAMP_NODE_FORMATTER,
} from 'trace/formatters';
import {CoarseVersion} from 'trace_api/coarse_version';
import {Parser} from 'trace_api/parser';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';

describe('TracesParserCujs', () => {
  let parser: Parser<HierarchyTreeNode>;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = (
      await getTracesParser([
        'traces/elapsed_and_real_timestamp/eventlog.winscope',
      ])
    ).tracesParser as Parser<HierarchyTreeNode>;
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

  it('provides timestamps', () => {
    const expected = [
      makeRealTimestamp(1681207048025446000n),
      makeRealTimestamp(1681207048025551000n),
      makeRealTimestamp(1681207048025580000n),
    ];

    const timestamps = assertDefined(parser.getTimestamps());
    expect(timestamps.length).toBe(16);
    expect(timestamps.slice(0, 3)).toEqual(expected);
  });

  it('contains parsed CUJ events', async () => {
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
          value: UTC_CONVERTER.makeTimestampFromNs(1681207048025580000n),
          formatter: TIMESTAMP_NODE_FORMATTER,
        },
        {
          name: 'endTimestamp',
          value: UTC_CONVERTER.makeTimestampFromNs(1681207048643085000n),
          formatter: TIMESTAMP_NODE_FORMATTER,
        },
        {name: 'canceled', value: true, formatter: DEFAULT_PROPERTY_FORMATTER},
      ])
      .build();
    expected.setIsRoot(true);

    expect(await entry.getAllProperties()).toEqual(expected);
  });
});

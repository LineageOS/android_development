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
import {getPerfettoParser} from '@parsers/fixture_utils';
import {CoarseVersion} from '@trace_api/coarse_version';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {DEFAULT_PROPERTY_FORMATTER, TIMESTAMP_NODE_FORMATTER,} from '@trace/formatters';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertySource} from '@tree_node/property_tree_node';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';

describe('ParserCujs', () => {
  let parser: Parser<HierarchyTreeNode>;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = (
      await getPerfettoParser(
        TraceType.CUJS,
        'traces/perfetto/cujs.perfetto-trace',
      )
    ).parser;
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(TraceType.CUJS);
  });

  it('has expected coarse version', () => {
    expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
  });

  it('has expected descriptors', () => {
    expect(parser.getDescriptors()).toEqual(['cujs.perfetto-trace']);
  });

  it('provides timestamps', () => {
    const expected = [
      makeRealTimestamp(1754580961363780030n),
      makeRealTimestamp(1754580962747188031n),
      makeRealTimestamp(1754580962769690133n),
    ];
    expect(parser.getTimestamps()).toEqual(expected);
  });

  it('contains parsed CUJ events', async () => {
    const entries = await parser.getAllEntries();

    const expected = new PropertyTreeBuilder()
      .setRootId('CujTrace')
      .setName('cuj')
      .setIsRoot(true)
      .setChildren([
        {
          name: 'cujType',
          value: 'LAUNCHER_APP_CLOSE_TO_HOME',
          formatter: DEFAULT_PROPERTY_FORMATTER,
          source: PropertySource.TP,
        },
        {
          name: 'ts',
          value: makeRealTimestamp(1754580962747188031n),
          formatter: TIMESTAMP_NODE_FORMATTER,
        },
        {
          name: 'endTimestamp',
          value: makeRealTimestamp(1754580963548041327n),
          formatter: TIMESTAMP_NODE_FORMATTER,
        },
        {
          name: 'canceled',
          value: false,
          source: PropertySource.TP,
          formatter: DEFAULT_PROPERTY_FORMATTER,
        },
      ])
      .build();
    expected.setIsRoot(true);

    expect(await entries[1]?.getAllProperties()).toEqual(expected);
  });
});

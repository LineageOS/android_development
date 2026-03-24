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
import {getPerfettoParser} from '@parsers/fixture_utils';
import {CoarseVersion} from '@trace_api/coarse_version';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

describe('PerfettoParserInputMethodManagerService', () => {
  let parser: Parser<HierarchyTreeNode>;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = (
      await getPerfettoParser(
        TraceType.INPUT_METHOD_MANAGER_SERVICE,
        'traces/perfetto/ime.perfetto-trace',
      )
    ).parser;
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(
      TraceType.INPUT_METHOD_MANAGER_SERVICE,
    );
  });

  it('has expected coarse version', () => {
    expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
  });

  it('provides timestamps', () => {
    const timestamps = parser.getTimestamps();
    expect(timestamps.length).toBe(7);
    const expected = [
      makeRealTimestamp(1714659587704398638n),
      makeRealTimestamp(1714659588929259723n),
      makeRealTimestamp(1714659588964769244n),
    ];
    expect(timestamps.slice(0, 3)).toEqual(expected);
  });

  it('retrieves trace entry', async () => {
    const entry = await parser.getEntry(0);
    expect(entry).toBeInstanceOf(HierarchyTreeNode);
    expect(entry.id).toBe('InputMethodManagerServiceTraceProto entry');
  });
});

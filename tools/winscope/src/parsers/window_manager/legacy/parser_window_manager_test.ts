/*
 * Copyright (C) 2022 The Android Open Source Project
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
import {LegacyParserProvider} from 'test/unit/fixture_utils';
import {
  makeRealTimestamp,
  makeElapsedTimestamp,
  timestampEqualityTester,
} from 'test/unit/time_test_helpers';
import {TraceBuilder} from 'test/unit/trace_builder';
import {CoarseVersion} from 'trace_api/coarse_version';
import {CustomQueryType} from 'trace_api/custom_query';
import {Parser} from 'trace_api/parser';
import {Trace} from 'trace_api/trace';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';

describe('ParserWindowManager', () => {
  describe('trace with real timestamps', () => {
    let parser: Parser<HierarchyTreeNode>;
    let trace: Trace<HierarchyTreeNode>;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      parser = await new LegacyParserProvider()
        .addFile('traces/elapsed_and_real_timestamp/WindowManager.pb')
        .getParser<HierarchyTreeNode>();
      trace = new TraceBuilder<HierarchyTreeNode>()
        .setType(TraceType.WINDOW_MANAGER)
        .setParser(parser)
        .build();
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
    });

    it('has expected coarse version', () => {
      expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LEGACY);
    });

    it('provides timestamps', () => {
      const expected = [
        makeRealTimestamp(1659107089075566202n),
        makeRealTimestamp(1659107089999048990n),
        makeRealTimestamp(1659107090010194213n),
      ];
      expect(assertDefined(parser.getTimestamps()).slice(0, 3)).toEqual(
        expected,
      );
    });

    it('retrieves trace entry', async () => {
      const entry = await parser.getEntry(1);
      expect(entry).toBeInstanceOf(HierarchyTreeNode);
      expect(entry.id).toBe('WindowManagerState root');
    });

    it('supports WM_WINDOWS_TOKEN_AND_TITLE custom query', async () => {
      const tokenAndTitles = await trace
        .sliceEntries(0, 1)
        .customQuery(CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE);
      expect(tokenAndTitles.length).toBe(69);
      expect(tokenAndTitles).toContain({token: 'c06766f', title: 'Leaf:36:36'});
    });
  });

  describe('trace with only elapsed timestamps', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      parser = await new LegacyParserProvider()
        .addFile('traces/elapsed_timestamp/WindowManager.pb')
        .getParser<HierarchyTreeNode>();
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
    });

    it('provides timestamps', () => {
      const expected = [
        makeElapsedTimestamp(850254319343n),
        makeElapsedTimestamp(850763506110n),
        makeElapsedTimestamp(850782750048n),
      ];
      expect(parser.getTimestamps()).toEqual(expected);
    });

    it('retrieves trace entry', async () => {
      const entry = await parser.getEntry(1);
      expect(entry).toBeInstanceOf(HierarchyTreeNode);
      expect(entry.id).toBe('WindowManagerState root');
    });
  });

  describe('critical mode trace', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      parser = await new LegacyParserProvider()
        .addFile(
          'traces/elapsed_and_real_timestamp/window_trace_critical.winscope',
        )
        .getParser<HierarchyTreeNode>();
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
    });

    it('provides timestamps', () => {
      const expected = [
        makeRealTimestamp(1721405245732015868n),
        makeRealTimestamp(1721405246510267496n),
        makeRealTimestamp(1721405246549639200n),
      ];
      expect(parser.getTimestamps()?.slice(0, 3)).toEqual(expected);
    });

    it('retrieves trace entry', async () => {
      const entry = await parser.getEntry(0);
      expect(entry).toBeInstanceOf(HierarchyTreeNode);
      expect(entry.id).toBe('WindowManagerState root');
    });
  });
});

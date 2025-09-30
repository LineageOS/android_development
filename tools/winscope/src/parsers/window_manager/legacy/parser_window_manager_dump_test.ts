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

import {perfetto} from 'protos/perfetto/trace/static';
import {LegacyParserProvider} from 'test/unit/fixture_utils';
import {
  getTimestampConverter,
  makeElapsedTimestamp,
  timestampEqualityTester,
} from 'test/unit/time_test_helpers';
import Long from 'long';
import {TraceBuilder} from 'test/unit/trace_builder';
import {CoarseVersion} from 'trace_api/coarse_version';
import {CustomQueryType} from 'trace_api/custom_query';
import {Parser} from 'trace_api/parser';
import {Trace} from 'trace_api/trace';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';

describe('ParserWindowManagerDump', () => {
  let parser: Parser<HierarchyTreeNode>;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    parser = await new LegacyParserProvider()
      .addFile('traces/elapsed_timestamp/dump_WindowManager.pb')
      .getParser<HierarchyTreeNode>();
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
  });

  it('has expected coarse version', () => {
    expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LEGACY);
  });

  it('provides timestamp (always zero)', () => {
    const expected = [makeElapsedTimestamp(0n)];
    expect(parser.getTimestamps()).toEqual(expected);
  });

  it('does not apply timezone info', async () => {
    const parserWithTimezoneInfo = await new LegacyParserProvider()
      .addFile('traces/elapsed_timestamp/dump_WindowManager.pb')
      .setTimestampConverter(getTimestampConverter(true))
      .getParser<HierarchyTreeNode>();
    expect(parserWithTimezoneInfo.getTraceType()).toEqual(
      TraceType.WINDOW_MANAGER,
    );

    expect(parser.getTimestamps()).toEqual([makeElapsedTimestamp(0n)]);
  });

  it('does not provide entry', () => {
    expect(parser.getEntry).toThrow();
  });

  it('converts to valid perfetto packets', async () => {
    const packets = parser.convertToPerfettoPackets!(10);
    expect(packets.length).toBe(1);
    expect(packets[0].trustedPacketSequenceId).toBe(10);
    expect(
      packets[0].winscopeExtensions?.[
        '.perfetto.protos.WinscopeExtensionsImpl.windowmanager'
      ]?.windowManagerService,
    ).toBeDefined();
    const ts = Long.fromInt(0);
    ts.unsigned = true;
    expect(packets[0].timestamp).toEqual(ts);
    expect(packets[0].timestampClockId).toEqual(
      perfetto.protos.ClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
    );
  });

  describe('converts to valid perfetto trace', () => {
    let perfettoParser: Parser<HierarchyTreeNode>;
    let perfettoTrace: Trace<HierarchyTreeNode>;

    beforeAll(async () => {
      perfettoParser = await new LegacyParserProvider()
        .addFile('traces/elapsed_timestamp/dump_WindowManager.pb')
        .setConvertToPerfetto(true)
        .getParser<HierarchyTreeNode>();
      perfettoTrace = new TraceBuilder<HierarchyTreeNode>()
        .setType(TraceType.WINDOW_MANAGER)
        .setParser(perfettoParser)
        .build();
    });

    it('provides timestamps', () => {
      const expected = [makeElapsedTimestamp(0n)];
      expect(perfettoParser.getTimestamps()).toEqual(expected);
    });

    it('retrieves trace entry', async () => {
      const entry = await perfettoParser.getEntry(0);
      expect(entry).toBeInstanceOf(HierarchyTreeNode);
      expect(
        (await entry.getAllProperties())
          .getChildByName('windowManagerService')
          ?.getChildByName('focusedApp')
          ?.getValue(),
      ).toBe('com.google.android.apps.nexuslauncher/.NexusLauncherActivity');
    });

    it('supports WM_WINDOWS_TOKEN_AND_TITLE custom query', async () => {
      const tokenAndTitles = await perfettoTrace.customQuery(
        CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE,
      );
      expect(tokenAndTitles.length).toBe(73);
      expect(tokenAndTitles).toContain({
        token: 212572070,
        title: 'Leaf:36:36',
      });
    });
  });
});

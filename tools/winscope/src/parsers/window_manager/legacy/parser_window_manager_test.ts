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
import {assertDefined} from '@common/assert';
import {LegacyParserProvider} from '@test/unit/fixture_utils';
import {
  makeRealTimestamp,
  makeElapsedTimestamp,
  timestampEqualityTester,
} from '@test/unit/time_test_helpers';
import {TraceBuilder} from '@test/unit/trace_builder';
import {CoarseVersion} from '@trace_api/coarse_version';
import {CustomQueryType} from '@trace_api/custom_query';
import {Parser} from '@trace_api/parser';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import Long from 'long';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {ClockSnapshot} from '@compat/perfetto';

describe('ParserWindowManager', () => {
  describe('trace with real timestamps', () => {
    let realParser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      realParser = await new LegacyParserProvider()
        .addFile('traces/elapsed_and_real_timestamp/WindowManager.pb')
        .getParser<HierarchyTreeNode>();
    });

    it('has expected trace type', () => {
      expect(realParser.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
    });

    it('has expected coarse version', () => {
      expect(realParser.getCoarseVersion()).toEqual(CoarseVersion.LEGACY);
    });

    it('provides timestamps', () => {
      const expected = [
        makeRealTimestamp(1659107089075566202n),
        makeRealTimestamp(1659107089999048990n),
        makeRealTimestamp(1659107090010194213n),
      ];
      expect(assertDefined(realParser.getTimestamps()).slice(0, 3)).toEqual(
        expected,
      );
    });

    it('does not provide entry', () => {
      expect(realParser.getEntry).toThrow();
    });

    it('converts to valid perfetto packets', async () => {
      const packets = realParser.convertToPerfettoPackets!(10);
      expect(packets.length).toBe(27);
      expect(packets[0].trustedPacketSequenceId).toBe(10);
      expect(
        packets[0].winscopeExtensions?.[
          '.perfetto.protos.WinscopeExtensionsImpl.windowmanager'
        ]?.windowManagerService,
      ).toBeDefined();
      const ts = Long.fromString(BigInt(14474594000).toString());
      ts.unsigned = true;
      expect(packets[0].timestamp).toEqual(ts);
      expect(packets[0].timestampClockId).toEqual(
        ClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );
    });

    describe('converts to valid perfetto trace', () => {
      let perfettoParser: Parser<HierarchyTreeNode>;
      let perfettoTrace: Trace<HierarchyTreeNode>;

      beforeAll(async () => {
        perfettoParser = await new LegacyParserProvider()
          .addFile('traces/elapsed_and_real_timestamp/WindowManager.pb')
          .setConvertToPerfetto(true)
          .getParser<HierarchyTreeNode>();
        perfettoTrace = new TraceBuilder<HierarchyTreeNode>()
          .setType(TraceType.WINDOW_MANAGER)
          .setParser(perfettoParser)
          .build();
      });

      it('provides timestamps', () => {
        const expected = [
          makeRealTimestamp(1659107089075566202n),
          makeRealTimestamp(1659107089999048990n),
          makeRealTimestamp(1659107090010194213n),
        ];
        expect(
          assertDefined(perfettoParser.getTimestamps()).slice(0, 3),
        ).toEqual(expected);
      });

      it('provides entry', async () => {
        const entry = await perfettoParser.getEntry(1);
        expect(entry).toBeInstanceOf(HierarchyTreeNode);
        expect(
          (await entry.getAllProperties())
            .getChildByName('windowManagerService')
            ?.getChildByName('focusedApp')
            ?.getValue(),
        ).toBe('com.google.android.apps.nexuslauncher/.NexusLauncherActivity');
      });

      it('supports WM_WINDOWS_TOKEN_AND_TITLE custom query', async () => {
        const tokenAndTitles = await perfettoTrace
          .sliceEntries(0, 1)
          .customQuery(CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE);
        expect(tokenAndTitles.length).toBe(72);
        expect(tokenAndTitles).toContain({
          token: 201750127,
          title: 'Leaf:36:36',
        });
      });
    });
  });

  describe('trace with only elapsed timestamps', () => {
    let elapsedParser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      elapsedParser = await new LegacyParserProvider()
        .addFile('traces/elapsed_timestamp/WindowManager.pb')
        .getParser<HierarchyTreeNode>();
    });

    it('has expected trace type', () => {
      expect(elapsedParser.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
    });

    it('provides timestamps', () => {
      const expected = [
        makeElapsedTimestamp(850254319343n),
        makeElapsedTimestamp(850763506110n),
        makeElapsedTimestamp(850782750048n),
      ];
      expect(elapsedParser.getTimestamps()).toEqual(expected);
    });

    it('converts to valid perfetto packets', async () => {
      const packets = elapsedParser.convertToPerfettoPackets!(10);
      expect(packets.length).toBe(3);
      expect(packets[0].trustedPacketSequenceId).toBe(10);
      expect(
        packets[0].winscopeExtensions?.[
          '.perfetto.protos.WinscopeExtensionsImpl.windowmanager'
        ]?.windowManagerService,
      ).toBeDefined();
      const ts = Long.fromString(BigInt(850254319343).toString());
      ts.unsigned = true;
      expect(packets[0].timestamp).toEqual(ts);
      expect(packets[0].timestampClockId).toEqual(
        ClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );
    });
  });

  describe('critical mode trace', () => {
    let criticalParser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      criticalParser = await new LegacyParserProvider()
        .addFile(
          'traces/elapsed_and_real_timestamp/window_trace_critical.winscope',
        )
        .getParser<HierarchyTreeNode>();
    });

    it('has expected trace type', () => {
      expect(criticalParser.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
    });

    it('provides timestamps', () => {
      const expected = [
        makeRealTimestamp(1721405245732015868n),
        makeRealTimestamp(1721405246510267496n),
        makeRealTimestamp(1721405246549639200n),
      ];
      expect(criticalParser.getTimestamps()?.slice(0, 3)).toEqual(expected);
    });
  });
});

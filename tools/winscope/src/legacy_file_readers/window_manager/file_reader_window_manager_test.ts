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
import {makeConverterNoRteOffsets, makeElapsedTimestamp, makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {PerfettoClockSnapshot, WinscopeExtensionsImpl} from '@compat/protobuf';
import {setupJspbTesting} from '@compat/test/protobuf';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {convertToPerfettoTrace, LegacyFileReaderProvider,} from '@legacy_file_readers/testing/fixture_utils';
import {CustomQueryType} from '@trace_api/custom_query';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {FileReaderWindowManager} from './file_reader_window_manager';

describe('FileReaderWindowManager', () => {
  beforeAll(() => {
    setupJspbTesting();
    jasmine.addCustomEqualityTester(timestampEqualityTester);
  });

  describe('trace with real timestamps', () => {
    let readerRealTs: LegacyFileReader;

    beforeAll(async () => {
      readerRealTs = await new LegacyFileReaderProvider([
        FileReaderWindowManager.createInstance,
      ])
        .addFile('traces/elapsed_and_real_timestamp/WindowManager.pb')
        .get();
    });

    it('has expected trace type', () => {
      expect(readerRealTs.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
    });

    it('provides timestamps', () => {
      const expected = [
        makeRealTimestamp(1659107089075566202n),
        makeRealTimestamp(1659107089999048990n),
        makeRealTimestamp(1659107090010194213n),
      ];
      expect(readerRealTs.getTimestamps().slice(0, 3)).toEqual(expected);
    });

    it('converts to valid perfetto packets', async () => {
      const packets = readerRealTs.convertToPerfettoPackets(10);
      const data = packets[0]
        .getWinscopeExtensions()
        ?.getExtension(WinscopeExtensionsImpl.windowmanager);
      expect(packets.length).toBe(27);
      expect(packets[0].getTrustedPacketSequenceId()).toBe(10);
      expect(data?.getWindowManagerService()).toBeDefined();
      expect(packets[0].getTimestamp()?.toString()).toEqual('14474594000');
      expect(packets[0].getTimestampClockId()).toEqual(
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );
    });

    describe('converts to valid perfetto trace', () => {
      let perfettoParser: Parser<HierarchyTreeNode>;

      beforeAll(async () => {
        perfettoParser = (
          await convertToPerfettoTrace(
            [readerRealTs],
            makeConverterNoRteOffsets(),
          )
        )[0];
      });

      it('provides timestamps', () => {
        const expected = [
          makeRealTimestamp(1659107089075566202n),
          makeRealTimestamp(1659107089999048990n),
          makeRealTimestamp(1659107090010194213n),
        ];
        expect(perfettoParser.getTimestamps().slice(0, 3)).toEqual(expected);
      });

      it('provides entry', async () => {
        const entry = await perfettoParser.getEntry(1);
        expect(entry).toBeInstanceOf(HierarchyTreeNode);
        expect(
          (await entry.getAllProperties())
            .getChildByName('windowManagerService')
            ?.getChildByName('focusedApp')
            ?.getValue<string>(),
        ).toBe('com.google.android.apps.nexuslauncher/.NexusLauncherActivity');
      });

      it('supports WM_WINDOWS_TOKEN_AND_TITLE custom query', async () => {
        const tokenAndTitles = await perfettoParser.customQuery(
          CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE,
          {start: 0, end: 1},
        );
        expect(tokenAndTitles.length).toBe(72);
        expect(tokenAndTitles).toContain({
          token: 201750127,
          title: 'Leaf:36:36',
        });
      });
    });
  });

  describe('trace with only elapsed timestamps', () => {
    let readerElapsedTs: LegacyFileReader;

    beforeAll(async () => {
      readerElapsedTs = await new LegacyFileReaderProvider([
        FileReaderWindowManager.createInstance,
      ])
        .addFile('traces/elapsed_timestamp/WindowManager.pb')
        .get();
    });

    it('has expected trace type', () => {
      expect(readerElapsedTs.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
    });

    it('provides timestamps', () => {
      const expected = [
        makeElapsedTimestamp(850254319343n),
        makeElapsedTimestamp(850763506110n),
        makeElapsedTimestamp(850782750048n),
      ];
      expect(readerElapsedTs.getTimestamps()).toEqual(expected);
    });

    it('converts to valid perfetto packets', async () => {
      const packets = readerElapsedTs.convertToPerfettoPackets(10);
      const data = packets[0]
        .getWinscopeExtensions()
        ?.getExtension(WinscopeExtensionsImpl.windowmanager);
      expect(packets.length).toBe(3);
      expect(packets[0].getTrustedPacketSequenceId()).toBe(10);
      expect(data?.getWindowManagerService()).toBeDefined();
      expect(packets[0].getTimestamp()?.toString()).toEqual('850254319343');
      expect(packets[0].getTimestampClockId()).toEqual(
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );
    });
  });

  describe('critical mode trace', () => {
    let readerCritical: LegacyFileReader;

    beforeAll(async () => {
      readerCritical = await new LegacyFileReaderProvider([
        FileReaderWindowManager.createInstance,
      ])
        .addFile(
          'traces/elapsed_and_real_timestamp/window_trace_critical.winscope',
        )
        .get();
    });

    it('has expected trace type', () => {
      expect(readerCritical.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
    });

    it('provides timestamps', () => {
      const expected = [
        makeRealTimestamp(1721405245732015868n),
        makeRealTimestamp(1721405246510267496n),
        makeRealTimestamp(1721405246549639200n),
      ];
      expect(readerCritical.getTimestamps().slice(0, 3)).toEqual(expected);
    });
  });
});

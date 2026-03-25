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

import {makeConverterNoRteOffsets, makeConverterWithUtcOffset, makeElapsedTimestamp, makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {PerfettoClockSnapshot, WinscopeExtensionsImpl} from '@compat/protobuf';
import {setupJspbTesting} from '@compat/test/protobuf';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {convertToPerfettoTrace, LegacyFileReaderProvider,} from '@legacy_file_readers/testing/fixture_utils';
import {CustomQueryType} from '@trace_api/custom_query';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {FileReaderWindowManagerDump} from './file_reader_window_manager_dump';

describe('FileReaderWindowManagerDump', () => {
  let reader: LegacyFileReader;

  beforeAll(async () => {
    setupJspbTesting();
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    reader = await new LegacyFileReaderProvider([
      FileReaderWindowManagerDump.createInstance,
    ])
      .addFile('traces/elapsed_timestamp/dump_WindowManager.pb')
      .get();
  });

  it('has expected trace type', () => {
    expect(reader.getTraceType()).toEqual(TraceType.WINDOW_MANAGER);
  });

  it('provides timestamp (always zero)', () => {
    const expected = [makeElapsedTimestamp(0n)];
    expect(reader.getTimestamps()).toEqual(expected);
  });

  it('does not apply timezone info', async () => {
    const readerWithTimezoneInfo = await new LegacyFileReaderProvider([
      FileReaderWindowManagerDump.createInstance,
    ])
      .addFile('traces/elapsed_timestamp/dump_WindowManager.pb')
      .setTimestampConverter(await makeConverterWithUtcOffset())
      .get();
    expect(readerWithTimezoneInfo.getTraceType()).toEqual(
      TraceType.WINDOW_MANAGER,
    );
    expect(readerWithTimezoneInfo.getTimestamps()).toEqual([
      makeRealTimestamp(0n),
    ]);
  });

  it('converts to valid perfetto packets', async () => {
    const packets = reader.convertToPerfettoPackets(10);
    const data = packets[0]
      .getWinscopeExtensions()
      ?.getExtension(WinscopeExtensionsImpl.windowmanager);
    expect(packets.length).toBe(1);
    expect(packets[0].getTrustedPacketSequenceId()).toBe(10);
    expect(data?.getWindowManagerService()).toBeDefined();
    expect(packets[0].getTimestamp()?.toString()).toEqual('0');
    expect(packets[0].getTimestampClockId()).toEqual(
      PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
    );
  });

  describe('converts to valid perfetto trace', () => {
    let perfettoParser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      perfettoParser = (
        await convertToPerfettoTrace([reader], makeConverterNoRteOffsets())
      )[0];
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
          ?.getValue<string>(),
      ).toBe('com.google.android.apps.nexuslauncher/.NexusLauncherActivity');
    });

    it('supports WM_WINDOWS_TOKEN_AND_TITLE custom query', async () => {
      const tokenAndTitles = await perfettoParser.customQuery(
        CustomQueryType.WM_WINDOWS_TOKEN_AND_TITLE,
        {start: 0, end: 1},
      );
      expect(tokenAndTitles.length).toBe(73);
      expect(tokenAndTitles).toContain({
        token: 212572070,
        title: 'Leaf:36:36',
      });
    });
  });
});

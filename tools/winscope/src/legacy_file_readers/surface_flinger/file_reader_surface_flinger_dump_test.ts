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

import {makeConverterNoRteOffsets, makeConverterWithUtcOffset, makeElapsedTimestamp, makeRealTimestamp, makeZeroTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {PerfettoClockSnapshot} from '@compat/protobuf';
import {setupJspbTesting} from '@compat/test/protobuf';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {convertToPerfettoTrace, LegacyFileReaderProvider,} from '@legacy_file_readers/testing/fixture_utils';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {TraceType} from '@trace_api/trace_type';

import {FileReaderSurfaceFlinger} from './file_reader_surface_flinger';

describe('FileReaderSurfaceFlingerDump', () => {
  let userNotifierChecker: UserNotifierChecker;

  beforeAll(() => {
    setupJspbTesting();
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    userNotifierChecker = new UserNotifierChecker();
  });

  describe('trace with real timestamps', () => {
    let reader: LegacyFileReader;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      reader = await new LegacyFileReaderProvider([
        FileReaderSurfaceFlinger.createInstance,
      ])
        .addFile('traces/elapsed_and_real_timestamp/dump_SurfaceFlinger.pb')
        .get();
    });

    afterEach(() => {
      userNotifierChecker.expectNone();
      userNotifierChecker.reset();
    });

    it('has expected trace type', () => {
      expect(reader.getTraceType()).toEqual(TraceType.SURFACE_FLINGER);
    });

    it('provides timestamps (always zero)', () => {
      const expected = [makeElapsedTimestamp(0n)];
      expect(reader.getTimestamps()).toEqual(expected);
    });

    it('does not apply timezone info', async () => {
      const readerWithTimezoneInfo = await new LegacyFileReaderProvider([
        FileReaderSurfaceFlinger.createInstance,
      ])
        .addFile('traces/elapsed_and_real_timestamp/dump_SurfaceFlinger.pb')
        .setTimestampConverter(await makeConverterWithUtcOffset())
        .get();
      const expected = [makeRealTimestamp(0n)];
      expect(readerWithTimezoneInfo.getTimestamps()).toEqual(expected);
    });

    it('converts to valid perfetto packets', async () => {
      const packets = reader.convertToPerfettoPackets(10);
      expect(packets.length).toBe(1);
      expect(packets[0].getTimestamp()?.toString()).toEqual('0');
      expect(packets[0].getTimestampClockId()).toEqual(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
      );
      expect(packets[0].getTrustedPacketSequenceId()).toBe(10);
      expect(
        packets[0]
          .getSurfaceflingerLayersSnapshot()
          ?.getLayers()
          ?.getLayersList()?.length,
      ).toBe(94);
    });

    it('converts to valid perfetto trace', async () => {
      await checkValidPerfettoTraceConversion(reader, 95);
    });
  });

  describe('trace with only elapsed timestamps', () => {
    let reader: LegacyFileReader;

    beforeAll(async () => {
      reader = await new LegacyFileReaderProvider([
        FileReaderSurfaceFlinger.createInstance,
      ])
        .addFile('traces/elapsed_timestamp/dump_SurfaceFlinger.pb')
        .get();
    });

    it('has expected trace type', () => {
      expect(reader.getTraceType()).toEqual(TraceType.SURFACE_FLINGER);
    });

    it('provides timestamp (always zero)', () => {
      const expected = [makeElapsedTimestamp(0n)];
      expect(reader.getTimestamps()).toEqual(expected);
    });

    it('converts to valid perfetto packets', async () => {
      const packets = reader.convertToPerfettoPackets(10);
      expect(packets.length).toBe(1);
      expect(packets[0].getTimestamp()?.toString()).toEqual('0');
      expect(packets[0].getTimestampClockId()).toEqual(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
      );
      expect(packets[0].getTrustedPacketSequenceId()).toBe(10);
      expect(
        packets[0]
          .getSurfaceflingerLayersSnapshot()
          ?.getLayers()
          ?.getLayersList()?.length,
      ).toBe(91);
    });

    it('converts to valid perfetto trace', async () => {
      await checkValidPerfettoTraceConversion(reader, 92);
    });
  });

  async function checkValidPerfettoTraceConversion(
    readerToConvert: LegacyFileReader,
    nodeCount: number,
  ) {
    const perfettoParser = (
      await convertToPerfettoTrace(
        [readerToConvert],
        makeConverterNoRteOffsets(),
      )
    )[0];
    const expected = [makeZeroTimestamp()];
    expect(perfettoParser.getTimestamps()).toEqual(expected);
    const entry = await perfettoParser.getEntry(0);
    let count = 0;
    entry.forEachNodeDfs(() => count++);
    expect(count).toEqual(nodeCount);
  }
});

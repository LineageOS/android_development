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
import {TIME_UNIT_TO_NANO} from 'common/time/time_units';
import {LegacyParserProvider} from 'test/unit/fixture_utils';
import {
  makeRealTimestamp,
  timestampEqualityTester,
} from 'test/unit/time_test_helpers';
import {CoarseVersion} from 'trace_api/coarse_version';
import {MediaBasedTraceEntry} from 'trace_api/media_based_trace_entry';
import {Parser} from 'trace_api/parser';
import {TraceType} from 'trace_api/trace_type';

describe('ParserScreenRecording', () => {
  let parser: Parser<MediaBasedTraceEntry>;

  describe('metadata v2', () => {
    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      parser = await new LegacyParserProvider()
        .addFile(
          'traces/elapsed_and_real_timestamp/screen_recording_metadata_v2.mp4',
        )
        .getParser<MediaBasedTraceEntry>();
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.SCREEN_RECORDING);
    });

    it('has expected coarse version', () => {
      expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
    });

    it('provides timestamps', () => {
      const timestamps = assertDefined(parser.getTimestamps());

      expect(timestamps.length).toBe(123);

      const expected = [
        makeRealTimestamp(1666361048792787045n),
        makeRealTimestamp(1666361048807348045n),
        makeRealTimestamp(1666361048827119045n),
      ];
      expect(timestamps.slice(0, 3)).toEqual(expected);
    });

    it('retrieves trace entry', async () => {
      {
        const entry = await parser.getEntry(0);
        expect(entry).toBeInstanceOf(MediaBasedTraceEntry);
        expect(Number(entry.videoTimeSeconds)).toBeCloseTo(0);
      }
      {
        const entry = await parser.getEntry(parser.getLengthEntries() - 1);
        expect(entry).toBeInstanceOf(MediaBasedTraceEntry);
        expect(Number(entry.videoTimeSeconds)).toBeCloseTo(1.371077, 0.001);
      }
    });
  });

  describe('metadata v3', () => {
    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      parser = await new LegacyParserProvider()
        .addFile(
          'traces/elapsed_and_real_timestamp/screen_recording_metadata_v3.mp4',
        )
        .getParser<MediaBasedTraceEntry>();
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.SCREEN_RECORDING);
    });

    it('has expected coarse version', () => {
      expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
    });

    it('provides timestamps', () => {
      const timestamps = assertDefined(parser.getTimestamps());
      expect(timestamps.length).toBe(105);
      const expected = [
        makeRealTimestamp(1755862820270527000n),
        makeRealTimestamp(1755862820414660000n),
        makeRealTimestamp(1755862820431423000n),
        makeRealTimestamp(1755862820447282000n),
        makeRealTimestamp(1755862820464489000n),
      ];
      expect(timestamps.slice(0, 5)).toEqual(expected);
    });

    it('retrieves trace entry', async () => {
      {
        const entry = await parser.getEntry(0);
        expect(entry).toBeInstanceOf(MediaBasedTraceEntry);
        expect(Number(entry.videoTimeSeconds)).toBeCloseTo(0);
      }
      {
        const entry = await parser.getEntry(parser.getLengthEntries() - 1);
        expect(entry).toBeInstanceOf(MediaBasedTraceEntry);
        expect(Number(entry.videoTimeSeconds)).toBeCloseTo(3.251884, 0.001);
      }
    });
  });

  describe('separate metadata file', () => {
    const elapsedNs = 5n;
    const realtoElapsedNs = 10n;
    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      parser = await new LegacyParserProvider()
        .addFile(
          'traces/elapsed_and_real_timestamp/screen_recording_no_metadata.mp4',
        )
        .setMetadata({
          screenRecordingOffsets: {
            elapsedRealTimeNanos: elapsedNs,
            realToElapsedTimeOffsetNanos: realtoElapsedNs,
          },
        })
        .getParser<MediaBasedTraceEntry>();
    });

    it('throws error if metadata not provided', async () => {
      const parsers = await new LegacyParserProvider()
        .addFile(
          'traces/elapsed_and_real_timestamp/screen_recording_no_metadata.mp4',
        )
        .getParsers();
      expect(parsers.length).toBe(0);
    });

    it('sets real to boot time offset', () => {
      expect(parser.getRealToBootTimeOffsetNs()).toBe(10n);
    });

    it('provides timestamps', () => {
      const timestamps = assertDefined(parser.getTimestamps());
      expect(timestamps.length).toBe(158);

      const totalOffset = elapsedNs + realtoElapsedNs;
      const expected = [
        makeRealTimestamp(599300000n + totalOffset),
        makeRealTimestamp(599400000n + totalOffset),
        makeRealTimestamp(1066066666n + totalOffset),
      ];
      expect(timestamps.slice(0, 3)).toEqual(expected);
    });

    it('retrieves trace entry', async () => {
      {
        const entry = await parser.getEntry(0);
        expect(entry).toBeInstanceOf(MediaBasedTraceEntry);
        expect(Number(entry.videoTimeSeconds)).toBeCloseTo(0);
      }
      {
        const entry = await parser.getEntry(parser.getLengthEntries() - 1);
        expect(entry).toBeInstanceOf(MediaBasedTraceEntry);
        expect(Number(entry.videoTimeSeconds)).toBeCloseTo(4.192109, 0.001);
      }
    });
  });

  describe('start time in filename', () => {
    const startTimeMs = 1732721670187;
    const startTimeNs = BigInt(startTimeMs) * BigInt(TIME_UNIT_TO_NANO.ms);

    describe('with Android screen recording format', () => {
      checkStartTimeInFilename(
        `test/screen-20250627-115432-${startTimeMs}.mp4`,
      );

      it('fails to parse invalid format', async () => {
        await checkFailsToParseFilename('screen.mp4'); // missing date, time, start time
        await checkFailsToParseFilename('screen-20250627.mp4'); // missing time, start time
        await checkFailsToParseFilename('screen-20250627-115432.mp4'); // missing start time

        await checkFailsToParseFilename('screen-2025627-115432-123321.mp4'); // invalid date
        await checkFailsToParseFilename('screen-20250627-15432-123321.mp4'); // invalid time
        await checkFailsToParseFilename('screen-20250627-115432-123a321.mp4'); // invalid start time
      });
    });

    describe('with date and UID format', () => {
      checkStartTimeInFilename(
        `test/2025-06-27_11-54-32-1234567890abcdef1234567890abcdef-${startTimeMs}-screen.mp4`,
      );

      it('fails to parse invalid format', async () => {
        // datetime missing underscore
        await checkFailsToParseFilename(
          '2025-06-2711-54-32-1234567890abcdef1234567890abcdef-123321-screen.mp4',
        );

        // invalid date
        await checkFailsToParseFilename(
          '2025-6-27_11-54-32-1234567890abcdef1234567890abcdef-123321-screen.mp4',
        );

        // invalid time
        await checkFailsToParseFilename(
          '2025-06-27_11-4-32-1234567890abcdef1234567890abcdef-123321-screen.mp4',
        );

        // invalid uid
        await checkFailsToParseFilename(
          '2025-06-27_11-54-32-123a321-123321-screen.mp4',
        );

        // missing suffix
        await checkFailsToParseFilename(
          '2025-06-27_11-54-32-1234567890abcdef1234567890abcdef-123321.mp4',
        );

        // invalid suffix
        await checkFailsToParseFilename(
          '2025-06-27_11-54-32-1234567890abcdef1234567890abcdef-123321-screenrecord.mp4',
        );

        // invalid start time
        await checkFailsToParseFilename(
          '2025-06-27_11-54-32-1234567890abcdef1234567890abcdef-123a321-screenrecord.mp4',
        );
      });
    });

    function checkStartTimeInFilename(filename: string) {
      beforeAll(async () => {
        jasmine.addCustomEqualityTester(timestampEqualityTester);
        parser = await new LegacyParserProvider()
          .addFile(
            'traces/elapsed_and_real_timestamp/screen_recording_no_metadata.mp4',
            filename,
          )
          .getParser<MediaBasedTraceEntry>();
      });

      it('sets real to boot time offset', () => {
        expect(parser.getRealToBootTimeOffsetNs()).toBe(0n);
      });

      it('provides timestamps', () => {
        const timestamps = assertDefined(parser.getTimestamps());
        expect(timestamps.length).toBe(158);

        const expected = [
          makeRealTimestamp(599300000n + startTimeNs),
          makeRealTimestamp(599400000n + startTimeNs),
          makeRealTimestamp(1066066666n + startTimeNs),
        ];
        expect(timestamps.slice(0, 3)).toEqual(expected);
      });

      it('retrieves trace entry', async () => {
        {
          const entry = await parser.getEntry(0);
          expect(entry).toBeInstanceOf(MediaBasedTraceEntry);
          expect(Number(entry.videoTimeSeconds)).toBeCloseTo(0);
        }
        {
          const entry = await parser.getEntry(parser.getLengthEntries() - 1);
          expect(entry).toBeInstanceOf(MediaBasedTraceEntry);
          expect(Number(entry.videoTimeSeconds)).toBeCloseTo(4.192109, 0.001);
        }
      });
    }

    async function checkFailsToParseFilename(filename: string) {
      const parsers = await new LegacyParserProvider()
        .addFile(
          'traces/elapsed_and_real_timestamp/screen_recording_no_metadata.mp4',
          filename,
        )
        .getParsers();
      expect(parsers.length).toBe(0);
    }
  });
});

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

import {makeElapsedTimestamp} from '@common/time/testing/test_helpers';
import {NonPerfettoParserProvider} from '@parsers/fixture_utils';
import {CoarseVersion} from '@trace_api/coarse_version';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {MediaBasedTraceEntry, VideoEntry,} from '@trace/media_based/media_based_trace_entry';

import {spyOnThumbnailGenerator, waitForThumbnailGeneration,} from './test_helpers';

describe('ParserScreenRecordingLegacy', () => {
  let parser: Parser<MediaBasedTraceEntry>;
  let thumbnailSpy: jasmine.Spy;

  beforeAll(async () => {
    thumbnailSpy = spyOnThumbnailGenerator();
    parser = (await new NonPerfettoParserProvider()
      .addFile('traces/elapsed_timestamp/screen_recording.mp4')
      .get()) as Parser<MediaBasedTraceEntry>;
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(TraceType.SCREEN_RECORDING);
  });

  it('has expected coarse version', () => {
    expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LEGACY);
  });

  it('provides timestamps', () => {
    const timestamps = parser.getTimestamps();

    expect(timestamps.length).toBe(85);

    let expected = [
      makeElapsedTimestamp(19446131807000n),
      makeElapsedTimestamp(19446158500000n),
      makeElapsedTimestamp(19446167117000n),
    ];
    expect(timestamps.slice(0, 3)).toEqual(expected);

    expected = [
      makeElapsedTimestamp(19448470076000n),
      makeElapsedTimestamp(19448487525000n),
      makeElapsedTimestamp(19448501007000n),
    ];
    expect(timestamps.slice(timestamps.length - 3, timestamps.length)).toEqual(
      expected,
    );
  });

  it('retrieves trace entry', async () => {
    {
      const entry = await parser.getEntry(0);
      expect(entry).toBeInstanceOf(VideoEntry);
      expect(Number(entry.videoTimeSeconds)).toBeCloseTo(0);
    }
    {
      const entry = await parser.getEntry(parser.getLengthEntries() - 1);
      expect(entry).toBeInstanceOf(VideoEntry);
      expect(Number(entry.videoTimeSeconds)).toBeCloseTo(2.37, 0.001);
    }
  });

  it('generates thumbnail', async () => {
    await waitForThumbnailGeneration(thumbnailSpy);
    const entry0 = await parser.getEntry(0);
    expect(entry0.thumbnail).toBeDefined();
    const entry1 = await parser.getEntry(1);
    expect(entry1.thumbnail).toEqual(entry0.thumbnail);
  });
});

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

import {getFixtureFile} from '@common/testing/io_helpers';
import {makeConverterNoRteOffsets, makeConverterWithUtcOffset, makeElapsedTimestamp, makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {CoarseVersion} from '@trace_api/coarse_version';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';
import {CanvasEntry} from '@trace/media_based/media_based_trace_entry';

import {ParserScreenshot} from './parser_screenshot';

describe('ParserScreenshot', () => {
  let parser: ParserScreenshot;
  let file: File;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    file = await getFixtureFile('traces/screenshot/screenshot.png');
    parser = new ParserScreenshot(
      new TraceFile(file),
      makeConverterNoRteOffsets(),
    );
    await parser.parse();
    parser.createTimestamps();
  });

  it('has expected trace type', () => {
    expect(parser.getTraceType()).toEqual(TraceType.SCREENSHOT);
  });

  it('has expected coarse version', () => {
    expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LATEST);
  });

  it('provides timestamps', () => {
    const timestamps = parser.getTimestamps();
    const expected = makeElapsedTimestamp(0n);
    expect(timestamps).toEqual([expected]);
  });

  it('does not apply timezone info', async () => {
    const parserWithTimezoneInfo = new ParserScreenshot(
      new TraceFile(file),
      await makeConverterWithUtcOffset(),
    );
    await parserWithTimezoneInfo.parse();
    parserWithTimezoneInfo.createTimestamps();

    const timestamps = parserWithTimezoneInfo.getTimestamps();
    const expected = makeRealTimestamp(0n);
    expect(timestamps).toEqual([expected]);
  });

  it('retrieves entry', async () => {
    const entry = await parser.getEntry(0);
    expect(entry).toBeInstanceOf(CanvasEntry);
    expect(entry.frame).toBeDefined();
    expect(entry.frame?.size).toEqual({width: 1080, height: 2400});
  });
});

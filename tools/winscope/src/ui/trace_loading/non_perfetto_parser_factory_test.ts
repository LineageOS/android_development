/*
 * Copyright (C) 2026 The Android Open Source Project
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
import {makeConverterNoRteOffsets} from '@common/time/testing/test_helpers';
import {ParserCujs} from '@parsers/cujs/non_perfetto/parser_cujs';
import {makeWarningInvalidNonPerfettoTrace} from '@parsers/helpers/warnings';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {CoarseVersion} from '@trace_api/coarse_version';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

import {NonPerfettoParserFactory} from './non_perfetto_parser_factory';

describe('NonPerfettoParserFactory', () => {
  let screenshotFile: TraceFile;
  let cujFile: TraceFile;
  let userNotifierChecker: UserNotifierChecker;

  beforeAll(async () => {
    screenshotFile = new TraceFile(
      await getFixtureFile('traces/screenshot/screenshot.png'),
    );
    cujFile = new TraceFile(
      await getFixtureFile(
        'traces/elapsed_and_real_timestamp/eventlog.winscope',
      ),
    );
  });

  beforeEach(() => {
    userNotifierChecker = new UserNotifierChecker();
  });

  afterEach(() => {
    userNotifierChecker.expectNone();
  });

  it('creates screenshot parser', async () => {
    await processFiles([screenshotFile], [TraceType.SCREENSHOT]);
  });

  it('creates CUJ parser', async () => {
    await processFiles([cujFile], [TraceType.CUJS]);
  });

  it('creates screen recording parser', async () => {
    const file = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/screen_recording_metadata_v2.mp4',
    );
    await checkScreenRecording(file, CoarseVersion.LATEST);
  });

  it('creates screen recording legacy parser', async () => {
    const file = await getFixtureFile(
      'traces/elapsed_timestamp/screen_recording.mp4',
    );
    await checkScreenRecording(file, CoarseVersion.LEGACY);
  });

  it('creates multiple parsers', async () => {
    await processFiles(
      [cujFile, screenshotFile],
      [TraceType.CUJS, TraceType.SCREENSHOT],
    );
  });

  it('creates valid parser and returns unsupported file', async () => {
    const unsupportedFile = new TraceFile(
      await getFixtureFile('traces/elapsed_timestamp/SurfaceFlinger.pb'),
    );
    await processFiles(
      [unsupportedFile, cujFile],
      [TraceType.CUJS],
      [unsupportedFile],
    );
  });

  it('warns for empty trace but does not return file', async () => {
    spyOn(ParserCujs.prototype, 'getLengthEntries').and.returnValue(0);
    await processFiles([cujFile], []);
    userNotifierChecker.expectAdded([
      makeWarningInvalidNonPerfettoTrace(
        [cujFile.getDescriptor()],
        'Trace is empty',
      ),
    ]);
    userNotifierChecker.reset();
  });

  async function checkScreenRecording(file: File, version: CoarseVersion) {
    const tFile = new TraceFile(file);
    const processed = await processFiles([tFile], [TraceType.SCREEN_RECORDING]);
    expect(processed.supportedFiles[0].getCoarseVersion()).toEqual(version);
  }

  async function processFiles(
    files: TraceFile[],
    types: TraceType[],
    unsupportedFiles: TraceFile[] = [],
  ) {
    const processedFiles = await new NonPerfettoParserFactory().processFiles(
      files,
      makeConverterNoRteOffsets(),
      {},
    );
    expect(processedFiles.supportedFiles.map((p) => p.getTraceType())).toEqual(
      types,
    );
    expect(processedFiles.unsupportedFiles).toEqual(unsupportedFiles);
    return processedFiles;
  }
});

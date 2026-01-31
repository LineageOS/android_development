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

import {createZipArchive} from '@common/io';
import {ProgressListenerStub} from '@messaging/progress_listener_stub';
import {UserWarning} from '@messaging/user_warning';
import {
  makeWarningCorruptedArchive,
  makeWarningNoValidFiles,
  makeWarningUnsupportedFileFormat,
} from './warnings';
import {BugreportFileSelected} from '@app/misc_events';
import {getFixtureFile} from '@test/unit/common/io_helpers';
import {
  ASIA_TIMEZONE_INFO,
  timestampEqualityTester,
  UTC_CONVERTER,
} from '@common/time/test_helpers';
import {UserNotifierChecker} from '@test/unit/user_notifier_checker';
import {TraceType} from '@trace_api/trace_type';
import {TraceProcessorProxy} from '@trace_processor/trace_processor';
import {FilesSource} from './files_source';
import {FileLoader, FileLoaderResult} from './file_loader';
import {TraceFileIdentifier} from './trace_file_identifier';
import {makeWarningInvalidPerfettoTrace} from '@parsers/helpers/warnings';
import {FileReader} from '@trace_api/file_reader';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {
  makeSpyRowIterator,
  makeSpyQueryResult,
} from '@trace_processor/test_utils';

describe('FileLoader', () => {
  let legacySfFile: File;
  let legacyWmFile: File;
  let brMainEntryFile: File;
  let brCodenameFile: File;
  let brSfFile: File;
  let jpgFile: File;
  let perfettoFileProtolog: File;
  let elapsedFile: File;

  let progressListener: ProgressListenerStub;
  let fileLoader: FileLoader;
  let userNotifierChecker: UserNotifierChecker;

  beforeAll(async () => {
    userNotifierChecker = new UserNotifierChecker();
    legacySfFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/SurfaceFlinger.pb',
    );
    legacyWmFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/WindowManager.pb',
    );
    brMainEntryFile = await getFixtureFile(
      'bugreports/main_entry.txt',
      'main_entry.txt',
    );
    brCodenameFile = await getFixtureFile(
      'bugreports/bugreport-codename_beta-UPB2.230407.019-2023-05-30-14-33-48.txt',
      'bugreport-codename_beta-UPB2.230407.019-2023-05-30-14-33-48.txt',
    );
    brSfFile = await getFixtureFile(
      'traces/perfetto/layers_trace.perfetto-trace',
      'FS/data/misc/wmtrace/surface_flinger.bp',
    );
    jpgFile = await getFixtureFile('invalid_files/winscope_homepage.jpg');
    perfettoFileProtolog = await getFixtureFile(
      'traces/perfetto/protolog.perfetto-trace',
    );
    elapsedFile = await getFixtureFile(
      'traces/elapsed_timestamp/SurfaceFlinger.pb',
    );
  });

  beforeEach(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);

    progressListener = new ProgressListenerStub();
    spyOn(progressListener, 'onProgressUpdate');
    fileLoader = new FileLoader(UTC_CONVERTER);
  });

  afterEach(() => {
    userNotifierChecker.expectNone();
    userNotifierChecker.reset();
  });

  it('can load valid trace files', async () => {
    const result = await loadFiles(
      [legacySfFile, legacyWmFile],
      FilesSource.TEST,
    );
    expectLoadResult(result, 2, []);
    const fileReaders = getAllReaders(result);
    expect(
      fileReaders
        .find((r) => r.getTraceType() === TraceType.WINDOW_MANAGER)
        ?.getLengthEntries(),
    ).toBeGreaterThan(0);
    expect(
      fileReaders
        .find((r) => r.getTraceType() === TraceType.SURFACE_FLINGER)
        ?.getLengthEntries(),
    ).toBeGreaterThan(0);
  });

  it('can load valid gzipped file and archive', async () => {
    const gzippedFile = await getFixtureFile('archives/WindowManager.pb.gz');
    const gzippedArchive = await getFixtureFile(
      'archives/WindowManager.zip.gz',
    );
    const result = await loadFiles(
      [gzippedFile, gzippedArchive],
      FilesSource.TEST,
    );

    expectLoadResult(result, 2, []);
    const fileReaders = getAllReaders(result);
    expect(
      fileReaders.every(
        (reader) => reader.getTraceType() === TraceType.WINDOW_MANAGER,
      ),
    ).toBeTrue();
  });

  it('detects bugreports and filters out files based on their directory', async () => {
    const bugreportFiles = [
      brMainEntryFile,
      brCodenameFile,
      brSfFile,
      await getFixtureFile(
        'traces/elapsed_and_real_timestamp/WindowManager.pb',
        'FS/data/misc/ignored-dir/window_manager.pb',
      ),
    ];

    const bugreportArchive = new File(
      [await createZipArchive(bugreportFiles)],
      'bugreport.zip',
    );

    // Corner case:
    // Another file is loaded along the bugreport -> the file must not be ignored
    //
    // Note:
    // The even weirder corner case where two bugreports are loaded at the same time is
    // currently not properly handled.
    const otherFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/InputMethodClients.pb',
      'would-be-ignored-if-was-in-bugreport-archive/input_method_clients.pb',
    );

    const result = await loadFiles([bugreportArchive, otherFile]);

    expectLoadResult(result, 2, [], new TimestampConverter(ASIA_TIMEZONE_INFO));
    checkLoadedFileReaders(result, [
      TraceType.INPUT_METHOD_CLIENTS,
      TraceType.SURFACE_FLINGER,
    ]);
  });

  it('detects bugreports and extracts timezone info', async () => {
    const bugreportFiles = [brMainEntryFile, brCodenameFile, brSfFile];
    const bugreportArchive = new File(
      [await createZipArchive(bugreportFiles)],
      'bugreport.zip',
    );

    const result = await loadFiles([bugreportArchive]);
    expectLoadResult(result, 1, [], new TimestampConverter(ASIA_TIMEZONE_INFO));
  });

  it('forwards winscope events to file identifier', async () => {
    const setEmitEventSpy = spyOn(
      TraceFileIdentifier.prototype,
      'setEmitEvent',
    );
    const emitEventSpy = jasmine.createSpy();
    fileLoader.setEmitEvent(emitEventSpy);
    expect(setEmitEventSpy).toHaveBeenCalledOnceWith(emitEventSpy);

    const onEventSpy = spyOn(TraceFileIdentifier.prototype, 'onWinscopeEvent');
    const testEvent = new BugreportFileSelected('f1');
    fileLoader.onWinscopeEvent(testEvent);
    expect(onEventSpy).toHaveBeenCalledOnceWith(testEvent);
  });

  it('is robust to corrupted archive', async () => {
    const corruptedArchive = await getFixtureFile(
      'invalid_files/corrupted_archive.zip',
    );
    const result = await loadFiles([corruptedArchive]);
    expectLoadResult(result, 0, [
      makeWarningCorruptedArchive(corruptedArchive),
      makeWarningNoValidFiles(),
    ]);
  });

  it('is robust to invalid trace files', async () => {
    const invalidFiles = [jpgFile];
    const result = await loadFiles(invalidFiles);
    expectLoadResult(result, 0, [
      makeWarningUnsupportedFileFormat('winscope_homepage.jpg'),
    ]);
  });

  it('notifies for unsupported file uploaded with file', async () => {
    const result = await loadFiles([jpgFile, perfettoFileProtolog]);
    expectLoadResult(result, 1, [
      makeWarningUnsupportedFileFormat('winscope_homepage.jpg'),
    ]);
  });

  it('is robust to invalid perfetto trace files', async () => {
    const invalidFiles = [
      await getFixtureFile('invalid_files/invalid_protolog.perfetto-trace'),
    ];
    const result = await loadFiles(invalidFiles);
    expectLoadResult(result, 0, [
      makeWarningInvalidPerfettoTrace('invalid_protolog.perfetto-trace', [
        'Perfetto trace has no Winscope trace entries',
      ]),
    ]);
  });

  it('surfaces information about packet loss', async () => {
    let result = await loadFiles([perfettoFileProtolog]);
    expect(result.lostPerfettoPackets).toBe(0);

    const spyIter = makeSpyRowIterator();
    spyIter.get.withArgs('value').and.returnValue(2n);
    const queryResultObj = makeSpyQueryResult(spyIter);
    queryResultObj.numRows.and.returnValue(1);

    const spy = spyOn(TraceProcessorProxy.prototype, 'query').and.callThrough();
    spy
      .withArgs(
        'SELECT name, value FROM stats ' +
          "WHERE name = 'traced_buf_trace_writer_packet_loss'",
      )
      .and.returnValue(Promise.resolve(queryResultObj));
    result = await loadFiles([perfettoFileProtolog]);
    expect(result.lostPerfettoPackets).toBe(2);

    queryResultObj.numRows.and.returnValue(0);
    result = await loadFiles([perfettoFileProtolog]); // clears lost packets from previous load on overwrite
    expect(result.lostPerfettoPackets).toBe(0);

    queryResultObj.numRows.and.returnValue(1);
    result = await loadFiles([perfettoFileProtolog]);
    expect(result.lostPerfettoPackets).toBe(2);
  });

  it('is robust to mixed valid and invalid trace files', async () => {
    const files = [jpgFile, elapsedFile];
    const result = await loadFiles(files);
    expectLoadResult(result, 1, [
      makeWarningUnsupportedFileFormat('winscope_homepage.jpg'),
    ]);
  });

  it('creates file readers with correct trace type', async () => {
    const result = await loadFiles([legacySfFile, legacyWmFile]);
    expectLoadResult(result, 2, []);
    checkLoadedFileReaders(result, [
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
    ]);
  });

  it('creates screen recording using metadata', async () => {
    const screenRecording = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/screen_recording_no_metadata.mp4',
    );
    const metadata = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/screen_recording_metadata.json',
    );
    const result = await loadFiles([screenRecording, metadata]);
    expectLoadResult(result, 1, []);
  });

  async function loadFiles(
    files: File[],
    source: FilesSource = FilesSource.TEST,
  ): Promise<FileLoaderResult> {
    return await fileLoader.load(files, source, progressListener);
  }

  function getAllReaders(result: FileLoaderResult): FileReader[] {
    return [...result.legacy, ...result.nonPerfetto, ...result.perfetto];
  }

  function expectLoadResult(
    result: FileLoaderResult,
    numberOfFileReaders: number,
    expectedWarnings: UserWarning[],
    converter = UTC_CONVERTER,
  ) {
    userNotifierChecker.expectAdded(expectedWarnings);
    userNotifierChecker.reset();
    expect(getAllReaders(result).length).toBe(numberOfFileReaders);
    expect(result.timestampConverter).toEqual(converter);
  }

  function checkLoadedFileReaders(
    result: FileLoaderResult,
    types: TraceType[],
  ) {
    expect(getAllReaders(result).map((r) => r.getTraceType())).toEqual(types);
  }
});

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
import {createZipArchive, DOWNLOAD_FILENAME_REGEX, unzipFile} from '@common/io';
import {ProgressListenerStub} from '@messaging/progress_listener_stub';
import {UserWarning} from '@messaging/user_warning';
import {
  makeWarningCorruptedArchive,
  makeWarningNoValidFiles,
  makeWarningUnsupportedFileFormat,
} from './warnings';
import {BugreportFileSelected} from '@app/misc_events';
import {getFixtureFile} from '@test/unit/io_helpers';
import {
  makeRealTimestampWithUTCOffset,
  timestampEqualityTester,
} from '@test/unit/time_test_helpers';
import {UserNotifierChecker} from '@test/unit/user_notifier_checker';
import {TraceFile} from '@trace/trace_file';
import {TraceType} from '@trace_api/trace_type';
import {QueryResult, RowIterator} from '@trace_processor/query_result';
import {TraceProcessorProxy} from '@trace_processor/trace_processor';
import {FilesSource} from './files_source';
import {TracePipeline} from './trace_pipeline';
import {TraceFileIdentifier} from './trace_file_identifier';
import {makeWarningInvalidPerfettoTrace} from '@parsers/helpers/warnings';
import {LegacyToPerfettoConverter} from './legacy_to_perfetto_converter';
import {FileReader} from '@trace_api/file_reader';
import {Parser} from '@trace_api/parser';
import {AbstractParser} from '@parsers/perfetto/abstract_parser';

describe('TracePipeline', () => {
  let legacySfFile: File;
  let legacyWmFile: File;
  let shellTransitionFile: File;
  let wmTransitionFile: File;
  let screenshotFile: File;
  let screenRecordingFile: File;
  let brMainEntryFile: File;
  let brCodenameFile: File;
  let brSfFile: File;
  let jpgFile: File;
  let perfettoFileProtolog: File;
  let perfettoFileTransactions: File;
  let elapsedFile: File;
  let eventlogFile: File;
  let inputFile: File;

  let progressListener: ProgressListenerStub;
  let tracePipeline: TracePipeline;
  let userNotifierChecker: UserNotifierChecker;

  beforeAll(async () => {
    userNotifierChecker = new UserNotifierChecker();
    wmTransitionFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/wm_transition_trace.pb',
    );
    shellTransitionFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/shell_transition_trace.pb',
    );
    legacySfFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/SurfaceFlinger.pb',
    );
    legacyWmFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/WindowManager.pb',
    );
    screenshotFile = await getFixtureFile('traces/screenshot/screenshot.png');
    screenRecordingFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/screen_recording_metadata_v2.mp4',
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
    perfettoFileTransactions = await getFixtureFile(
      'traces/perfetto/transactions_trace.perfetto-trace',
    );
    elapsedFile = await getFixtureFile(
      'traces/elapsed_timestamp/SurfaceFlinger.pb',
    );
    eventlogFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/eventlog.winscope',
    );
    inputFile = await getFixtureFile(
      'traces/perfetto/input-events.perfetto-trace',
    );
  });

  beforeEach(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);

    progressListener = new ProgressListenerStub();
    spyOn(progressListener, 'onProgressUpdate');
    spyOn(progressListener, 'onOperationFinished');

    tracePipeline = new TracePipeline();
  });

  afterEach(() => {
    userNotifierChecker.expectNone();
    userNotifierChecker.reset();
  });

  it('can load valid trace files', async () => {
    expect(tracePipeline.getLoadedFileReaders().length).toBe(0);

    await loadFiles([legacySfFile, legacyWmFile], FilesSource.TEST);
    expectLoadResult(2, []);

    expect(tracePipeline.getDownloadArchiveFilename()).toMatch(
      new RegExp(`${FilesSource.TEST}_`),
    );

    const fileReaders = tracePipeline.getLoadedFileReaders();
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
    expect(tracePipeline.getLoadedFileReaders().length).toBe(0);

    const gzippedFile = await getFixtureFile('archives/WindowManager.pb.gz');
    const gzippedArchive = await getFixtureFile(
      'archives/WindowManager.zip.gz',
    );

    await loadFiles([gzippedFile, gzippedArchive], FilesSource.TEST);
    expectLoadResult(2, []);

    const fileReaders = tracePipeline.getLoadedFileReaders();
    expect(
      fileReaders.every(
        (reader) => reader.getTraceType() === TraceType.WINDOW_MANAGER,
      ),
    ).toBeTrue();
  });

  it('can set download archive filename based on files source', async () => {
    await loadFiles([legacySfFile]);
    expectLoadResult(1, []);
    expect(tracePipeline.getDownloadArchiveFilename()).toMatch(
      new RegExp('SurfaceFlinger_'),
    );

    tracePipeline = new TracePipeline();

    await loadFiles([legacySfFile, legacyWmFile], FilesSource.COLLECTED);
    expectLoadResult(2, []);
    expect(tracePipeline.getDownloadArchiveFilename()).toMatch(
      new RegExp(`${FilesSource.COLLECTED}_`),
    );
  });

  it('can convert illegal uploaded archive filename to legal name for download archive', async () => {
    const fileWithIllegalName = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/SFtrace(with_illegal_characters).pb',
    );
    await loadFiles([fileWithIllegalName]);
    expectLoadResult(1, []);
    const downloadFilename = tracePipeline.getDownloadArchiveFilename();
    expect(DOWNLOAD_FILENAME_REGEX.test(downloadFilename)).toBeTrue();
  });

  it('detects bugreports and filters out files based on their directory', async () => {
    expect(tracePipeline.getLoadedFileReaders().length).toBe(0);

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

    await loadFiles([bugreportArchive, otherFile]);
    expectLoadResult(2, []);
    checkLoadedFileReaders([
      TraceType.SURFACE_FLINGER,
      TraceType.INPUT_METHOD_CLIENTS,
    ]);
  });

  it('detects bugreports and extracts timezone info, then calculates utc offset', async () => {
    const bugreportFiles = [brMainEntryFile, brCodenameFile, brSfFile];
    const bugreportArchive = new File(
      [await createZipArchive(bugreportFiles)],
      'bugreport.zip',
    );

    await loadFiles([bugreportArchive]);
    expectLoadResult(1, []);

    await tracePipeline.buildFrameMapping();
    const timestampConverter = tracePipeline.getTimestampConverter();
    expect(timestampConverter.getUTCOffset()).toBe('UTC+05:30');

    const expectedTimestamp =
      makeRealTimestampWithUTCOffset(1659107089102062832n);
    expect(
      timestampConverter.makeTimestampFromBootTimeNs(14500282843n),
    ).toEqual(expectedTimestamp);
  });

  it('forwards winscope events to file identifier', async () => {
    const setEmitEventSpy = spyOn(
      TraceFileIdentifier.prototype,
      'setEmitEvent',
    );
    const emitEventSpy = jasmine.createSpy();
    tracePipeline.setEmitEvent(emitEventSpy);
    expect(setEmitEventSpy).toHaveBeenCalledOnceWith(emitEventSpy);

    const onEventSpy = spyOn(TraceFileIdentifier.prototype, 'onWinscopeEvent');
    const testEvent = new BugreportFileSelected('f1');
    tracePipeline.onWinscopeEvent(testEvent);
    expect(onEventSpy).toHaveBeenCalledOnceWith(testEvent);
  });

  it('is robust to corrupted archive', async () => {
    const corruptedArchive = await getFixtureFile(
      'invalid_files/corrupted_archive.zip',
    );
    await loadFiles([corruptedArchive]);
    expectLoadResult(0, [
      makeWarningCorruptedArchive(corruptedArchive),
      makeWarningNoValidFiles(),
    ]);
  });

  it('is robust to invalid trace files', async () => {
    const invalidFiles = [jpgFile];
    await loadFiles(invalidFiles);
    expectLoadResult(0, [
      makeWarningUnsupportedFileFormat('winscope_homepage.jpg'),
    ]);
  });

  it('notifies for unsupported file uploaded with file', async () => {
    await loadFiles([jpgFile, perfettoFileProtolog]);
    expectLoadResult(1, [
      makeWarningUnsupportedFileFormat('winscope_homepage.jpg'),
    ]);
  });

  it('notifies for unsupported file uploaded before valid file', async () => {
    await loadFiles([jpgFile]);
    await loadFiles([perfettoFileProtolog]);
    expectLoadResult(1, [
      makeWarningUnsupportedFileFormat('winscope_homepage.jpg'),
    ]);
  });

  it('notifies for unsupported file uploaded after valid file', async () => {
    await loadFiles([perfettoFileProtolog]);
    await loadFiles([jpgFile]);
    expectLoadResult(1, [
      makeWarningUnsupportedFileFormat('winscope_homepage.jpg'),
    ]);
  });

  it('is robust to invalid perfetto trace files', async () => {
    const invalidFiles = [
      await getFixtureFile('invalid_files/invalid_protolog.perfetto-trace'),
    ];
    await loadFiles(invalidFiles);
    expectLoadResult(0, [
      makeWarningInvalidPerfettoTrace('invalid_protolog.perfetto-trace', [
        'Perfetto trace has no Winscope trace entries',
      ]),
    ]);
  });

  it('surfaces information about packet loss', async () => {
    await loadFiles([perfettoFileProtolog]);
    expect(tracePipeline.lostPackets()).toBe(0);

    const queryResultObj = jasmine.createSpyObj<QueryResult>('result', [
      'numRows',
      'iter',
    ]);
    queryResultObj.numRows.and.returnValue(1);
    const spyIter = jasmine.createSpyObj<RowIterator>('iter', [
      'valid',
      'next',
      'get',
    ]);
    spyIter.get.withArgs('value').and.returnValue(2n);
    queryResultObj.iter.and.returnValue(spyIter);

    const spy = spyOn(TraceProcessorProxy.prototype, 'query').and.callThrough();
    spy
      .withArgs(
        'SELECT name, value FROM stats ' +
          "WHERE name = 'traced_buf_trace_writer_packet_loss'",
      )
      .and.returnValue(Promise.resolve(queryResultObj));
    await loadFiles([perfettoFileProtolog]);
    expect(tracePipeline.lostPackets()).toBe(2);

    queryResultObj.numRows.and.returnValue(0);
    await loadFiles([perfettoFileProtolog]); // clears lost packets from previous load on overwrite
    expect(tracePipeline.lostPackets()).toBe(0);

    queryResultObj.numRows.and.returnValue(1);
    await loadFiles([perfettoFileProtolog]);
    expect(tracePipeline.lostPackets()).toBe(2);
  });

  it('is robust to mixed valid and invalid trace files', async () => {
    expect(tracePipeline.getLoadedFileReaders().length).toBe(0);
    const files = [jpgFile, elapsedFile];

    await loadFiles(files);

    expectLoadResult(1, [
      makeWarningUnsupportedFileFormat('winscope_homepage.jpg'),
    ]);
  });

  it('can remove file readers', async () => {
    await loadFiles([legacySfFile, legacyWmFile]);
    expectLoadResult(2, []);

    const sfReader = getReader(TraceType.SURFACE_FLINGER);
    const wmReader = getReader(TraceType.WINDOW_MANAGER);

    tracePipeline.removeFileReader(sfReader);
    expectLoadResult(1, []);

    tracePipeline.removeFileReader(wmReader);
    expectLoadResult(0, []);
  });

  it('removes legacy transitions trace and its consituents', async () => {
    const downloadResult = [
      'transition/shell_transition_trace.pb',
      'transition/wm_transition_trace.pb',
    ];
    await removesTraceAndConstituents(
      [wmTransitionFile, shellTransitionFile],
      downloadResult,
      TraceType.TRANSITION,
    );

    await loadFiles([wmTransitionFile]);
    expectLoadResult(1, []);
    checkLoadedFileReaders([TraceType.WM_TRANSITION]);
    await expectDownloadResult(['transition/wm_transition_trace.pb']);
  });

  it('keeps constituents of legacy transitions trace for download', async () => {
    const downloadResult = [
      'transition/shell_transition_trace.pb',
      'transition/wm_transition_trace.pb',
    ];
    await checkConstituentsKeptForDownload(
      [wmTransitionFile, shellTransitionFile],
      downloadResult,
      true,
      TraceType.TRANSITION,
    );
  });

  it('removes Input trace and its consituents', async () => {
    await removesTraceAndConstituents(
      [inputFile],
      ['input-events.perfetto-trace'],
      TraceType.INPUT_EVENT_MERGED,
    );
  });

  it('keeps constituents of Input trace for download', async () => {
    await checkConstituentsKeptForDownload(
      [inputFile],
      ['input-events.perfetto-trace'],
      false,
      TraceType.INPUT_EVENT_MERGED,
    );
  });

  it('gets loaded file readers', async () => {
    await loadFiles([legacySfFile, legacyWmFile]);
    expectLoadResult(2, []);

    const readers = tracePipeline.getLoadedFileReaders();
    const actualTraceTypes = new Set(readers.map((r) => r.getTraceType()));
    const expectedTraceTypes = new Set([
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
    ]);
    expect(actualTraceTypes).toEqual(expectedTraceTypes);

    const sfTrace = assertDefined(
      readers.find((r) => r.getTraceType() === TraceType.SURFACE_FLINGER),
    );
    expect(sfTrace.getDescriptors().length).toBeGreaterThan(0);
  });

  it('gets screenrecording trace', async () => {
    const files = [screenRecordingFile];
    await loadFiles(files);
    expectLoadResult(1, []);
    const trace = tracePipeline.getScreenRecordingTrace();
    expect(trace).toBeDefined();
  });

  it('creates file readers with correct trace type', async () => {
    await loadFiles([legacySfFile, legacyWmFile]);
    expectLoadResult(2, []);
    checkLoadedFileReaders([
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
    ]);
  });

  it('creates zip archive with loaded trace files', async () => {
    const files = [screenRecordingFile, perfettoFileTransactions];
    await loadFiles(files);
    expectLoadResult(2, []);

    await expectDownloadResult([
      'screen_recording_metadata_v2.mp4',
      'transactions_trace.perfetto-trace',
    ]);
  });

  it('can be destroyed', async () => {
    await loadFiles([perfettoFileProtolog, screenshotFile]);
    expectLoadResult(2, []);
    const spies = tracePipeline.getLoadedFileReaders().map((reader) => {
      const parser = reader as unknown as Parser<unknown>;
      return spyOn(parser, 'onDestroy');
    });
    tracePipeline.onDestroy();
    spies.forEach((spy) => expect(spy).toHaveBeenCalled());
  });

  it('can filter traces without visualization', async () => {
    await loadFiles([shellTransitionFile]);
    expectLoadResult(1, []);

    tracePipeline.filterLoadedFilesWithoutVisualization();
    expect(tracePipeline.getLoadedFileReaders().length).toBe(0);
  });

  it('tries to create search trace', async () => {
    await loadFiles([perfettoFileProtolog]);
    const validQuery = 'select ts from protolog';
    expect(await tracePipeline.tryCreateSearchTrace(validQuery)).toBeDefined();
    expect(await tracePipeline.tryCreateSearchTrace('fail')).toBeUndefined();
    userNotifierChecker.reset();
  });

  it('creates screen recording using metadata', async () => {
    const screenRecording = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/screen_recording_no_metadata.mp4',
    );
    const metadata = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/screen_recording_metadata.json',
    );
    await loadFiles([screenRecording, metadata]);
    expectLoadResult(1, []);
  });

  it('discards legacy traces that can be converted', async () => {
    await loadFiles([legacySfFile]);
    expect(tracePipeline.getLoadedFileReaders().length).toBe(1);
    tracePipeline.discardLegacyTraces();
    expect(tracePipeline.getLoadedFileReaders().length).toBe(0);
  });

  it('keeps legacy traces that cannot be converted', async () => {
    await checkTraceIsNotDiscarded(screenshotFile, TraceType.SCREENSHOT);
    await checkTraceIsNotDiscarded(eventlogFile, TraceType.CUJS);
    await checkTraceIsNotDiscarded(
      screenRecordingFile,
      TraceType.SCREEN_RECORDING,
    );
  });

  it('keeps non-perfetto traces without conversion', async () => {
    await loadFiles([legacySfFile, screenshotFile]);
    expectLoadResult(2, []);
    tracePipeline.discardLegacyTraces();
    checkLoadedFileReaders([TraceType.SCREENSHOT]);
  });

  describe('legacy to perfetto conversion', () => {
    let readerSf: FileReader;
    let setLegacyParsersSpy: jasmine.Spy;
    let setAllParsersSpy: jasmine.Spy;
    let setPerfettoFileSpy: jasmine.Spy;
    let convertSpy: jasmine.Spy;

    beforeEach(async () => {
      setLegacyParsersSpy = spyOn(
        LegacyToPerfettoConverter.prototype,
        'setLegacyFileReaders',
      ).and.callThrough();
      setAllParsersSpy = spyOn(
        LegacyToPerfettoConverter.prototype,
        'setAllFileReaders',
      ).and.callThrough();
      setPerfettoFileSpy = spyOn(
        LegacyToPerfettoConverter.prototype,
        'setPerfettoFile',
      ).and.callThrough();
      convertSpy = spyOn(
        LegacyToPerfettoConverter.prototype,
        'convert',
      ).and.callThrough();
      await loadFiles([legacySfFile]);
      readerSf = assertDefined(
        tracePipeline
          .getLoadedFileReaders()
          .find(
            (reader) => reader.getTraceType() === TraceType.SURFACE_FLINGER,
          ),
      );
    });

    it('robust to no available legacy-to-perfetto conversions', async () => {
      tracePipeline = new TracePipeline();
      await loadFiles([screenshotFile]);
      await tracePipeline.convertLegacyTracesToPerfetto();
      expect(convertSpy).not.toHaveBeenCalled();
    });

    it('robust to failed legacy-to-perfetto conversion', async () => {
      convertSpy.and.returnValue(Promise.resolve(undefined));
      await expectAsync(
        tracePipeline.convertLegacyTracesToPerfetto(),
      ).not.toBeRejected();
      expect(convertSpy).toHaveBeenCalledTimes(1);
    });

    it('robust to no perfetto data in converted file', async () => {
      convertSpy.and.returnValue(Promise.resolve(new TraceFile(legacySfFile)));
      await tracePipeline.convertLegacyTracesToPerfetto();
      userNotifierChecker.expectAdded([
        makeWarningInvalidPerfettoTrace('SurfaceFlinger.pb', [
          'failed to convert legacy files into perfetto trace',
        ]),
      ]);
      userNotifierChecker.reset();
    });

    it('with single legacy trace', async () => {
      await tracePipeline.convertLegacyTracesToPerfetto();
      expect(setLegacyParsersSpy).toHaveBeenCalledOnceWith([readerSf]);
      expect(setAllParsersSpy).toHaveBeenCalledOnceWith([readerSf]);
      expect(setPerfettoFileSpy).not.toHaveBeenCalled();
      expect(convertSpy).toHaveBeenCalledTimes(1);
      const loadedFileReaders = tracePipeline.getLoadedFileReaders();
      expect(loadedFileReaders.length).toBe(1);
      checkSfReaderIsPerfetto();
    });

    it('with perfetto parser loaded', async () => {
      await loadFiles([perfettoFileProtolog]);
      const readerPerfetto = getReader(TraceType.PROTO_LOG);
      await tracePipeline.convertLegacyTracesToPerfetto();
      expect(setLegacyParsersSpy).toHaveBeenCalledOnceWith([readerSf]);
      expect(setAllParsersSpy).toHaveBeenCalledOnceWith([
        readerSf,
        readerPerfetto,
      ]);
      expect(setPerfettoFileSpy).toHaveBeenCalledOnceWith(
        new TraceFile(perfettoFileProtolog),
      );
      expect(convertSpy).toHaveBeenCalledTimes(1);
      expect(tracePipeline.getLoadedFileReaders().length).toBe(2);
      checkSfReaderIsPerfetto();
    });

    it('with multiple legacy traces', async () => {
      await loadFiles([legacyWmFile]);
      const parserWm = getReader(TraceType.WINDOW_MANAGER);
      await tracePipeline.convertLegacyTracesToPerfetto();
      expect(setLegacyParsersSpy).toHaveBeenCalledOnceWith([
        readerSf,
        parserWm,
      ]);
      expect(setAllParsersSpy).toHaveBeenCalledOnceWith([readerSf, parserWm]);
      expect(setPerfettoFileSpy).not.toHaveBeenCalled();
      expect(convertSpy).toHaveBeenCalledTimes(1);
      expect(tracePipeline.getLoadedFileReaders().length).toBe(2);
      checkSfReaderIsPerfetto();
    });

    it('discards constituent files of converted transitions trace', async () => {
      tracePipeline = new TracePipeline();
      await loadFiles([wmTransitionFile, shellTransitionFile]);
      await tracePipeline.convertLegacyTracesToPerfetto();
      await expectDownloadResult(['combined_winscope_trace.perfetto-trace']);
    });

    function checkSfReaderIsPerfetto() {
      const readers = tracePipeline.getLoadedFileReaders();
      const sfReader = readers.find(
        (reader) => reader.getTraceType() === TraceType.SURFACE_FLINGER,
      );
      expect(sfReader).toBeInstanceOf(AbstractParser);
    }
  });

  async function loadFiles(
    files: File[],
    source: FilesSource = FilesSource.TEST,
  ) {
    await tracePipeline.loadFiles(files, source, progressListener);
    expect(progressListener.onOperationFinished).toHaveBeenCalled();
    tracePipeline.buildTraces();
  }

  function getReader(type: TraceType): FileReader {
    return assertDefined(
      tracePipeline
        .getLoadedFileReaders()
        .find((reader) => reader.getTraceType() === type),
    );
  }

  function expectLoadResult(
    numberOfFileReaders: number,
    expectedWarnings: UserWarning[],
  ) {
    userNotifierChecker.expectAdded(expectedWarnings);
    userNotifierChecker.reset();
    expect(tracePipeline.getLoadedFileReaders().length).toBe(
      numberOfFileReaders,
    );
  }

  async function expectDownloadResult(expectedArchiveContents: string[]) {
    const zipArchive = await tracePipeline.makeZipArchiveWithLoadedTraceFiles();
    const actualArchiveContents = (await unzipFile(zipArchive))
      .map((file) => file.name)
      .sort();
    expect(actualArchiveContents).toEqual(expectedArchiveContents);
  }

  async function checkTraceIsNotDiscarded(file: File, type: TraceType) {
    tracePipeline = new TracePipeline();
    await loadFiles([file]);
    tracePipeline.discardLegacyTraces();
    checkLoadedFileReaders([type]);
  }

  async function removesTraceAndConstituents(
    files: File[],
    downloadResult: string[],
    mergedTraceType: TraceType,
  ) {
    await loadFiles(files);
    expectLoadResult(1, []);
    checkLoadedFileReaders([mergedTraceType]);
    await expectDownloadResult(downloadResult);

    const reader = getReader(mergedTraceType);
    tracePipeline.removeFileReader(reader);
    expectLoadResult(0, []);
    await expectDownloadResult([]);
  }

  function checkLoadedFileReaders(types: TraceType[]) {
    expect(
      tracePipeline.getLoadedFileReaders().map((r) => r.getTraceType()),
    ).toEqual(types);
  }

  async function checkConstituentsKeptForDownload(
    files: File[],
    downloadResult: string[],
    screenshotFirst: boolean,
    traceType: TraceType,
  ) {
    await loadFiles(files);
    expectLoadResult(1, []);
    await expectDownloadResult(downloadResult);

    await loadFiles([screenshotFile]);
    expectLoadResult(2, []);
    await expectDownloadResult(
      screenshotFirst
        ? ['screenshot.png', ...downloadResult]
        : [...downloadResult, 'screenshot.png'],
    );
    checkLoadedFileReaders(
      screenshotFirst
        ? [TraceType.SCREENSHOT, traceType]
        : [traceType, TraceType.SCREENSHOT],
    );
  }
});

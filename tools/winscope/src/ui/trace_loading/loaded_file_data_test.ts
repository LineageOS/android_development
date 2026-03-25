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

import {assertDefined} from '@common/assert';
import {Rect} from '@common/geometry/rect';
import {DOWNLOAD_FILENAME_REGEX, unzipFile} from '@common/io';
import {getFixtureFile} from '@common/testing/io_helpers';
import {ASIA_TIMEZONE_INFO, makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {TimezoneInfo} from '@common/time/time';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {LegacyToPerfettoConverter} from '@legacy_file_readers/common/legacy_to_perfetto_converter';
import {TestFileReaderAndParserBuilder} from '@legacy_file_readers/testing/test_file_reader_and_parser_builder';
import {TestLegacyFileReaderBuilder} from '@legacy_file_readers/testing/test_legacy_file_reader_builder';
import {UserWarning} from '@messaging/user_warning';
import {FileReaderAndParser} from '@parsers/file_reader_and_parser';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {makeWarningInvalidPerfettoTrace} from '@parsers/helpers/warnings';
import {AbstractParser} from '@parsers/perfetto/abstract_parser';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {FileReader} from '@trace_api/file_reader';
import {FilesSource} from '@trace_api/files_source';
import {FrameMapper} from '@trace_api/frame_mapper';
import {Parser} from '@trace_api/parser';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';
import {makeSpyQueryResult} from '@trace_processor/test_utils';
import {TraceProcessorProxy} from '@trace_processor/trace_processor';

import {FileLoader, FileLoaderResult} from './file_loader';
import {LoadedFileData} from './loaded_file_data';
import {ParsingErrorType} from './parsing_error_type';
import {makeWarningIncompleteFrameMapping} from './warnings';

describe('LoadedFileData', () => {
  const emptyTraceGeometryData = new TraceGeometryData();
  const ts0 = makeRealTimestamp(0n);
  const ts1 = makeRealTimestamp(1n);
  const ts2 = makeRealTimestamp(2n);
  const ts3 = makeRealTimestamp(3n);

  const legacySfReader = new TestLegacyFileReaderBuilder()
    .setType(TraceType.SURFACE_FLINGER)
    .setTimestamps([ts1, ts2, ts3])
    .setDescriptors(['SurfaceFlinger.pb'])
    .build();
  const legacyWmReader = new TestLegacyFileReaderBuilder()
    .setType(TraceType.WINDOW_MANAGER)
    .setTimestamps([ts1, ts2, ts3])
    .build();
  const perfettoProtologReader = new TestFileReaderAndParserBuilder()
    .setType(TraceType.PROTO_LOG)
    .setTimestamps([ts1, ts2, ts3])
    .setDescriptors(['test_protolog.perfetto-trace'])
    .setIsPerfetto(true)
    .build();
  const screenshotReader = new TestFileReaderAndParserBuilder()
    .setType(TraceType.SCREENSHOT)
    .setTimestamps([ts0])
    .setIsPerfetto(false)
    .setDescriptors(['screenshot.png'])
    .build();
  const screenRecordingReader = new TestFileReaderAndParserBuilder()
    .setType(TraceType.SCREEN_RECORDING)
    .setTimestamps([ts1, ts2, ts3])
    .setDescriptors(['test_screen_recording.mp4'])
    .setIsPerfetto(false)
    .build();
  const cujReader = new TestFileReaderAndParserBuilder()
    .setType(TraceType.CUJS)
    .setTimestamps([ts0])
    .setIsPerfetto(false)
    .build();

  let shellTransitionReader: LegacyFileReader;
  let wmTransitionReader: LegacyFileReader;
  let inputTraceReaders: FileReaderAndParser[];

  let loadedFileData: LoadedFileData;
  let userNotifierChecker: UserNotifierChecker;

  beforeAll(async () => {
    userNotifierChecker = new UserNotifierChecker();
  });

  beforeEach(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);

    loadedFileData = new LoadedFileData();

    const wmTransitionFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/wm_transition_trace.pb',
    );
    const shellTransitionFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/shell_transition_trace.pb',
    );
    const resTransitions = await loadFiles([
      wmTransitionFile,
      shellTransitionFile,
    ]);
    wmTransitionReader = resTransitions.legacy[0];
    shellTransitionReader = resTransitions.legacy[1];

    const inputFile = await getFixtureFile(
      'traces/perfetto/input-events.perfetto-trace',
    );
    const resInput = await loadFiles([inputFile]);
    inputTraceReaders = resInput.perfetto;
  });

  afterEach(() => {
    userNotifierChecker.expectNone();
    userNotifierChecker.reset();
  });

  it('can load valid trace files', async () => {
    expect(loadedFileData.getLoadedFileReaders().length).toBe(0);

    await addLegacyReaders([legacySfReader, legacyWmReader], FilesSource.TEST);
    expectLoadResult(2, []);

    expect(loadedFileData.getDownloadArchiveFilename()).toMatch(
      new RegExp(`${FilesSource.TEST}_`),
    );

    const fileReaders = loadedFileData.getLoadedFileReaders();
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
    expect(loadedFileData.getLoadedFileReaders().length).toBe(0);

    const gzippedFile = await getFixtureFile('archives/WindowManager.pb.gz');
    const gzippedArchive = await getFixtureFile(
      'archives/WindowManager.zip.gz',
    );
    const res = await loadFiles([gzippedFile, gzippedArchive]);
    await loadedFileData.addFiles(res, FilesSource.TEST);
    expectLoadResult(2, []);

    const fileReaders = loadedFileData.getLoadedFileReaders();
    expect(
      fileReaders.every(
        (reader) => reader.getTraceType() === TraceType.WINDOW_MANAGER,
      ),
    ).toBeTrue();
  });

  it('can set download archive filename based on files source', async () => {
    await addLegacyReaders([legacySfReader]);
    expectLoadResult(1, []);
    expect(loadedFileData.getDownloadArchiveFilename()).toMatch(
      new RegExp('SurfaceFlinger_'),
    );

    loadedFileData = new LoadedFileData();

    await addLegacyReaders(
      [legacySfReader, legacyWmReader],
      FilesSource.COLLECTED,
    );
    expectLoadResult(2, []);
    expect(loadedFileData.getDownloadArchiveFilename()).toMatch(
      new RegExp(`${FilesSource.COLLECTED}_`),
    );
  });

  it('can convert illegal uploaded archive filename to legal name for download archive', async () => {
    const fileWithIllegalName = new TestLegacyFileReaderBuilder()
      .setType(TraceType.SURFACE_FLINGER)
      .setTimestamps([ts1, ts2, ts3])
      .setDescriptors([
        'traces/elapsed_and_real_timestamp/SFtrace(with_illegal_characters).pb',
      ])
      .build();
    await addLegacyReaders([fileWithIllegalName]);
    expectLoadResult(1, []);
    const downloadFilename = loadedFileData.getDownloadArchiveFilename();
    expect(DOWNLOAD_FILENAME_REGEX.test(downloadFilename)).toBeTrue();
  });

  it('surfaces information about packet loss', async () => {
    const res = {
      legacy: [],
      perfetto: [perfettoProtologReader],
      nonPerfetto: [],
      lostPerfettoPackets: 1,
      traceTypesWithParsingErrors: new Map<TraceType, ParsingErrorType>(),
      timezoneInfo: undefined,
      traceGeometryData: emptyTraceGeometryData,
      warnings: [],
    };
    await loadedFileData.addFiles(res, FilesSource.TEST);
    expect(loadedFileData.getLostPerfettoPackets()).toBe(1);

    res.lostPerfettoPackets = 0;
    await loadedFileData.addFiles(res, FilesSource.TEST);
    expect(loadedFileData.getLostPerfettoPackets()).toBe(0);
  });

  it('surfaces information about trace processor errors', async () => {
    const res = {
      legacy: [],
      perfetto: [perfettoProtologReader],
      nonPerfetto: [],
      lostPerfettoPackets: 0,
      traceTypesWithParsingErrors: new Map<TraceType, ParsingErrorType>([
        [TraceType.INPUT_METHOD_CLIENTS, ParsingErrorType.DATA_INCORRECT],
      ]),
      timezoneInfo: undefined,
      traceGeometryData: emptyTraceGeometryData,
      warnings: [],
    };
    await loadedFileData.addFiles(res, FilesSource.TEST);
    expect(loadedFileData.getTraceTypesWithParsingErrors()).toEqual(
      new Map<TraceType, ParsingErrorType>([
        [TraceType.INPUT_METHOD_CLIENTS, ParsingErrorType.DATA_INCORRECT],
      ]),
    );

    res.traceTypesWithParsingErrors = new Map<TraceType, ParsingErrorType>();
    await loadedFileData.addFiles(res, FilesSource.TEST);
    expect(loadedFileData.getTraceTypesWithParsingErrors()).toEqual(
      new Map<TraceType, ParsingErrorType>(),
    );
  });

  it('exposes traceGeometryData', async () => {
    const traceGeometryData = new TraceGeometryData(
      new Map([[1n, new Rect(0, 0, 1, 1)]]),
    );
    const res = {
      legacy: [],
      perfetto: [perfettoProtologReader],
      nonPerfetto: [],
      lostPerfettoPackets: 1,
      traceTypesWithParsingErrors: new Map<TraceType, ParsingErrorType>(),
      timezoneInfo: undefined,
      traceGeometryData,
      warnings: [],
    };
    await loadedFileData.addFiles(res, FilesSource.TEST);
    expect(loadedFileData.getTraceGeometryData()).toEqual(traceGeometryData);
  });

  it('can remove file readers', async () => {
    await addLegacyReaders([legacySfReader, legacyWmReader]);
    expectLoadResult(2, []);

    const sfReader = getReader(TraceType.SURFACE_FLINGER);
    const wmReader = getReader(TraceType.WINDOW_MANAGER);

    loadedFileData.removeFileReader(sfReader);
    expectLoadResult(1, []);

    loadedFileData.removeFileReader(wmReader);
    expectLoadResult(0, []);
  });

  it('removes legacy transitions trace and its consituents', async () => {
    const downloadResult = [
      'transition/shell_transition_trace.pb',
      'transition/wm_transition_trace.pb',
    ];
    await removesTraceAndConstituents(
      [wmTransitionReader, shellTransitionReader],
      [],
      downloadResult,
      TraceType.TRANSITION,
    );

    await addLegacyReaders([wmTransitionReader]);
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
      [wmTransitionReader, shellTransitionReader],
      [],
      downloadResult,
      true,
      TraceType.TRANSITION,
    );
  });

  it('removes Input trace and its consituents', async () => {
    await removesTraceAndConstituents(
      [],
      inputTraceReaders,
      ['input-events.perfetto-trace'],
      TraceType.INPUT_EVENT_MERGED,
    );
  });

  it('keeps constituents of Input trace for download', async () => {
    await checkConstituentsKeptForDownload(
      [],
      inputTraceReaders,
      ['input-events.perfetto-trace'],
      false,
      TraceType.INPUT_EVENT_MERGED,
    );
  });

  it('creates zip archive with loaded trace files', async () => {
    await addNonLegacyReaders(
      [perfettoProtologReader],
      [screenRecordingReader],
    );
    expectLoadResult(2, []);

    await expectDownloadResult([
      perfettoProtologReader.getDescriptors()[0],
      screenRecordingReader.getDescriptors()[0],
    ]);
  });

  it('can be destroyed', async () => {
    await addNonLegacyReaders(
      [perfettoProtologReader],
      [screenRecordingReader],
    );
    expectLoadResult(2, []);
    const spies = loadedFileData.getLoadedFileReaders().map((reader) => {
      const parser = reader as unknown as Parser<unknown>;
      return spyOn(parser, 'onDestroy');
    });
    loadedFileData.onDestroy();
    spies.forEach((spy) => expect(spy).toHaveBeenCalled());
  });

  it('throws for attempted access to loaded traces before initialization', async () => {
    expect(loadedFileData.getTraces).toThrow();
    await expectAsync(loadedFileData.tryCreateSearchTrace('')).toBeRejected();
  });

  it('builds traces', async () => {
    await addNonLegacyReaders([perfettoProtologReader], []);
    const success = await loadedFileData.buildTraces(false, undefined);
    expect(success).toBeTrue();
    checkTraces([TraceType.PROTO_LOG]);
  });

  it('warns user if frame mapping fails', async () => {
    const errorMsg = 'frame mapping failed';
    spyOn(FrameMapper.prototype, 'computeMapping').and.throwError(errorMsg);
    await addNonLegacyReaders([perfettoProtologReader], []);
    const success = await loadedFileData.buildTraces(false, undefined);
    expect(success).toBeTrue();
    checkTraces([TraceType.PROTO_LOG]);
    userNotifierChecker.expectAdded([
      makeWarningIncompleteFrameMapping(errorMsg),
    ]);
    userNotifierChecker.reset();
  });

  it('uses timezone info from file loader to initialize UTC offset', async () => {
    // prevent TraceProcessor from returning a valid timezone offset
    const result = makeSpyQueryResult();
    result.numRows.and.returnValue(0);
    spyOn(TraceProcessorProxy.prototype, 'query').and.returnValue(
      Promise.resolve(result),
    );

    const reader = new TestFileReaderAndParserBuilder()
      .setType(TraceType.SCREEN_RECORDING)
      .setTimestamps([
        loadedFileData
          .getTimestampConverter()
          .makeTimestampFromRealNs(1000000000000n),
      ])
      .setIsPerfetto(false)
      .build();
    await addNonLegacyReaders(
      [],
      [reader],
      FilesSource.TEST,
      ASIA_TIMEZONE_INFO,
    );
    expectLoadResult(1, []);
    const ts = reader.getTimestamps()[0].format();
    expect(ts).toEqual('1970-01-01, 00:16:40.000');

    const success = await loadedFileData.buildTraces(false, undefined);
    expect(success).toBeTrue();
    const trace = loadedFileData
      .getTraces()
      .getTrace(TraceType.SCREEN_RECORDING);
    const tsWithUtcOffset = trace?.getEntry(0).getTimestamp().format();
    expect(tsWithUtcOffset).toEqual('1970-01-01, 05:46:40.000');
  });

  it('can filter traces without visualization', async () => {
    await addLegacyReaders([shellTransitionReader]);
    expectLoadResult(1, []);
    const success = await loadedFileData.buildTraces(false, undefined);
    expect(success).toBeFalse();
    expect(loadedFileData.getLoadedFileReaders().length).toBe(0);
  });

  it('discards legacy traces that can be converted', async () => {
    await addLegacyReaders([legacySfReader]);
    await addNonLegacyReaders([perfettoProtologReader], []);
    expect(loadedFileData.getLoadedFileReaders().length).toBe(2);
    const success = await loadedFileData.buildTraces(false, undefined);
    expect(success).toBeTrue();
    checkTraces([TraceType.PROTO_LOG]);
  });

  it('keeps legacy traces that cannot be converted', async () => {
    await checkTraceIsNotDiscarded(screenshotReader, TraceType.SCREENSHOT);
    await checkTraceIsNotDiscarded(
      screenRecordingReader,
      TraceType.SCREEN_RECORDING,
    );
    await checkTraceIsNotDiscarded(cujReader, TraceType.CUJS);
  });

  describe('legacy to perfetto conversion', () => {
    let sfReader: LegacyFileReader;
    let wmReader: LegacyFileReader;

    let setLegacyParsersSpy: jasmine.Spy;
    let setAllParsersSpy: jasmine.Spy;
    let setPerfettoFileSpy: jasmine.Spy;
    let convertSpy: jasmine.Spy;

    beforeEach(async () => {
      const sfFile = await getFixtureFile(
        'traces/elapsed_and_real_timestamp/SurfaceFlinger.pb',
      );
      const wmFile = await getFixtureFile(
        'traces/elapsed_and_real_timestamp/WindowManager.pb',
      );
      [sfReader, wmReader] = (await loadFiles([sfFile, wmFile])).legacy;

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

      await addLegacyReaders([sfReader]);
    });

    it('robust to no available legacy-to-perfetto conversions', async () => {
      loadedFileData = new LoadedFileData();
      await addNonLegacyReaders([], [screenshotReader]);
      await loadedFileData.buildTraces(false, undefined);
      expect(convertSpy).not.toHaveBeenCalled();
    });

    it('robust to failed legacy-to-perfetto conversion', async () => {
      convertSpy.and.returnValue(Promise.resolve(undefined));
      await expectAsync(
        loadedFileData.buildTraces(false, undefined),
      ).not.toBeRejected();
      expect(convertSpy).toHaveBeenCalledTimes(1);
    });

    it('robust to no perfetto data in converted file', async () => {
      const emptyFile = await getFixtureFile(
        'invalid_files/no_winscope_traces.perfetto-trace',
      );
      convertSpy.and.returnValue(Promise.resolve(new TraceFile(emptyFile)));
      await loadedFileData.buildTraces(false, undefined);
      userNotifierChecker.expectAdded([
        makeWarningInvalidPerfettoTrace('no_winscope_traces.perfetto-trace', [
          'Perfetto trace has no Winscope trace entries',
        ]),
      ]);
      userNotifierChecker.reset();
    });

    it('with single legacy trace', async () => {
      await loadedFileData.buildTraces(false, undefined);
      expect(setLegacyParsersSpy).toHaveBeenCalledOnceWith([sfReader]);
      expect(setAllParsersSpy).toHaveBeenCalledOnceWith([sfReader]);
      expect(setPerfettoFileSpy).not.toHaveBeenCalled();
      expect(convertSpy).toHaveBeenCalledTimes(1);
      const loadedFileReaders = loadedFileData.getLoadedFileReaders();
      expect(loadedFileReaders.length).toBe(1);
      checkReaderIsPerfetto();
    });

    it('with perfetto parser loaded', async () => {
      await addNonLegacyReaders(inputTraceReaders, []);
      const mergedInputReader = getReader(TraceType.INPUT_EVENT_MERGED);
      await loadedFileData.buildTraces(false, undefined);
      expect(setLegacyParsersSpy).toHaveBeenCalledOnceWith([sfReader]);
      expect(setAllParsersSpy).toHaveBeenCalledOnceWith([
        sfReader,
        mergedInputReader,
      ]);
      expect(setPerfettoFileSpy).toHaveBeenCalledOnceWith(
        mergedInputReader.getFiles()[0],
      );
      expect(convertSpy).toHaveBeenCalledTimes(1);

      await loadedFileData.buildTraces(false, undefined);
      const traces = loadedFileData.getTraces();
      expect(traces.getSize()).toBe(2);
      expect(
        traces.getTrace(TraceType.SURFACE_FLINGER)?.isPerfetto(),
      ).toBeTrue();
      expect(
        traces.getTrace(TraceType.INPUT_EVENT_MERGED)?.isPerfetto(),
      ).toBeTrue();
    });

    it('with multiple legacy traces', async () => {
      await addLegacyReaders([wmReader]);
      const allReaders = [sfReader, wmReader];
      await loadedFileData.buildTraces(false, undefined);
      expect(setLegacyParsersSpy).toHaveBeenCalledOnceWith(allReaders);
      expect(setAllParsersSpy).toHaveBeenCalledOnceWith(allReaders);
      expect(setPerfettoFileSpy).not.toHaveBeenCalled();
      expect(convertSpy).toHaveBeenCalledTimes(1);

      const traces = loadedFileData.getTraces();
      expect(traces.getSize()).toBe(2);
      expect(
        traces.getTrace(TraceType.SURFACE_FLINGER)?.isPerfetto(),
      ).toBeTrue();
      expect(
        traces.getTrace(TraceType.WINDOW_MANAGER)?.isPerfetto(),
      ).toBeTrue();
    });

    function checkReaderIsPerfetto() {
      const readers = loadedFileData.getLoadedFileReaders();
      const reader = readers.find(
        (reader) => reader.getTraceType() === TraceType.SURFACE_FLINGER,
      );
      expect(reader).toBeInstanceOf(AbstractParser);
    }
  });

  async function loadFiles(files: File[]): Promise<FileLoaderResult> {
    return await new FileLoader(loadedFileData.getTimestampConverter()).load(
      files,
      FilesSource.TEST,
      undefined,
    );
  }

  async function addLegacyReaders(
    legacy: LegacyFileReader[],
    source: FilesSource = FilesSource.TEST,
  ) {
    const res = {
      legacy,
      perfetto: [],
      nonPerfetto: [],
      lostPerfettoPackets: 0,
      traceTypesWithParsingErrors: new Map<TraceType, ParsingErrorType>(),
      timezoneInfo: undefined,
      traceGeometryData: emptyTraceGeometryData,
      warnings: [],
    };
    await loadedFileData.addFiles(res, source);
  }

  async function addNonLegacyReaders(
    perfetto: FileReaderAndParser[],
    nonPerfetto: FileReaderAndParser[],
    source: FilesSource = FilesSource.TEST,
    timezoneInfo?: TimezoneInfo,
  ) {
    const res = {
      legacy: [],
      perfetto,
      nonPerfetto,
      lostPerfettoPackets: 0,
      traceTypesWithParsingErrors: new Map<TraceType, ParsingErrorType>(),
      timezoneInfo,
      traceGeometryData: emptyTraceGeometryData,
      warnings: [],
    };
    await loadedFileData.addFiles(res, source);
  }

  function getReader(type: TraceType): FileReader {
    return assertDefined(
      loadedFileData
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
    expect(loadedFileData.getLoadedFileReaders().length).toBe(
      numberOfFileReaders,
    );
  }

  async function expectDownloadResult(expectedArchiveContents: string[]) {
    const zipArchive =
      await loadedFileData.makeZipArchiveWithLoadedTraceFiles();
    const actualArchiveContents = (await unzipFile(zipArchive))
      .map((file) => file.name)
      .sort();
    expect(actualArchiveContents).toEqual(expectedArchiveContents);
  }

  async function checkTraceIsNotDiscarded(
    reader: FileReaderAndParser,
    type: TraceType,
  ) {
    loadedFileData = new LoadedFileData();
    await addNonLegacyReaders([], [reader]);
    const success = await loadedFileData.buildTraces(false, undefined);
    expect(success).toBeTrue();
    checkLoadedFileReaders([type]);
    checkTraces([type]);
  }

  async function removesTraceAndConstituents(
    legacy: LegacyFileReader[],
    perfetto: FileReaderAndParser[],
    downloadResult: string[],
    mergedTraceType: TraceType,
  ) {
    await addLegacyReaders(legacy);
    await addNonLegacyReaders(perfetto, []);
    expectLoadResult(1, []);
    checkLoadedFileReaders([mergedTraceType]);
    await expectDownloadResult(downloadResult);

    const reader = getReader(mergedTraceType);
    loadedFileData.removeFileReader(reader);
    expectLoadResult(0, []);
    await expectDownloadResult([]);
  }

  function checkLoadedFileReaders(types: TraceType[]) {
    expect(
      loadedFileData.getLoadedFileReaders().map((r) => r.getTraceType()),
    ).toEqual(types);
  }

  function checkTraces(types: TraceType[]) {
    expect(loadedFileData.getTraces().mapTrace((r) => r.type)).toEqual(types);
  }

  async function checkConstituentsKeptForDownload(
    legacy: LegacyFileReader[],
    perfetto: FileReaderAndParser[],
    downloadResult: string[],
    screenshotFirst: boolean,
    traceType: TraceType,
  ) {
    await addLegacyReaders(legacy);
    await addNonLegacyReaders(perfetto, []);
    expectLoadResult(1, []);
    await expectDownloadResult(downloadResult);

    const res = {
      legacy: [],
      perfetto: [],
      nonPerfetto: [screenshotReader],
      warnings: [],
      lostPerfettoPackets: 0,
      traceTypesWithParsingErrors: new Map<TraceType, ParsingErrorType>(),
      traceGeometryData: emptyTraceGeometryData,
      timezoneInfo: undefined,
    };
    await loadedFileData.addFiles(res, FilesSource.TEST);
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

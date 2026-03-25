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
import {DOWNLOAD_FILENAME_REGEX, ILLEGAL_FILENAME_CHARACTERS_REGEX, OnProgressUpdateType, removeDirFromFileName, removeExtensionFromFilename,} from '@common/io';
import {TimezoneInfo} from '@common/time/time';
import {TIME_UNIT_TO_NANO} from '@common/time/time_units';
import {TimestampConverter, UTC_TIMEZONE_INFO,} from '@common/time/timestamp_converter';
import {getResolvedUTCOffset} from '@common/time/utc_offset_resolver';
import {getLogger, Logger} from '@compat/logging';
import {getReaderWithLatestRealToBootTimeOffset, getReaderWithLatestRealToMonotonicTimeOffset,} from '@legacy_file_readers/common/file_reader_helpers';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {LegacyToPerfettoConverter} from '@legacy_file_readers/common/legacy_to_perfetto_converter';
import {FileReaderTransitions} from '@legacy_file_readers/transitions/file_reader_transitions';
import {Analytics} from '@logging/analytics';
import {ProgressListener} from '@messaging/progress_listener';
import {FileReaderAndParser} from '@parsers/file_reader_and_parser';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {makeWarningInvalidLegacyTrace} from '@parsers/helpers/warnings';
import {ParserInput} from '@parsers/input/parser_input';
import {ParserSearch} from '@parsers/search/parser_search';
import {UserNotifier} from '@services/user_notifier';
import {FileReader} from '@trace_api/file_reader';
import {FilesSource} from '@trace_api/files_source';
import {FrameMapper} from '@trace_api/frame_mapper';
import {Parser} from '@trace_api/parser';
import {Trace} from '@trace_api/trace';
import {TraceFile} from '@trace_api/trace_file';
import {isTraceTypeWithViewer, TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {QueryResult} from '@trace_processor/query_result';
import {TraceProcessorFactory} from '@trace_processor/trace_processor_factory';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {FileLoader, FileLoaderResult} from './file_loader';
import {LoadedFiles} from './loaded_files';
import {ParsingErrorType} from './parsing_error_type';
import {makeWarningIncompleteFrameMapping} from './warnings';

/**
 * A class that stores and transforms trace data.
 *
 * This class is responsible for:
 * - Converting file readers into traces
 * - Transforming data (e.g. merging file readers, converting to Perfetto)
 * - Building LoadedTraces
 */
export class LoadedFileData {
  private static readonly DEFAULT_DOWNLOAD_ARCHIVE_NAME = 'winscope';

  private readonly timestampConverter = new TimestampConverter();
  private loadedFiles = new LoadedFiles<FileReaderAndParser>();
  private downloadArchiveFilename =
    LoadedFileData.DEFAULT_DOWNLOAD_ARCHIVE_NAME;
  private lostPerfettoPackets = 0;
  private traceTypesWithParsingErrors: Map<TraceType, ParsingErrorType> =
    new Map();
  private timezoneInfo: TimezoneInfo = UTC_TIMEZONE_INFO;
  private traceGeometryData: TraceGeometryData = new TraceGeometryData();
  private traces: Traces | undefined;

  constructor(private readonly logger: Logger = getLogger('LoadedFileData')) {}

  onDestroy() {
    this.loadedFiles.getNonPerfettoFileReaders().forEach((reader) => {
      reader.onDestroy?.();
    });
    this.loadedFiles.getPerfettoFileReaders().forEach((reader) => {
      reader.onDestroy?.();
    });
  }

  async addFiles(result: FileLoaderResult, source: FilesSource) {
    const allReaders: FileReader[] = [
      ...result.legacy,
      ...result.nonPerfetto,
      ...result.perfetto,
    ];
    this.downloadArchiveFilename = this.makeDownloadArchiveFilename(
      allReaders,
      source,
    );
    if (result.perfetto.length > 0) {
      this.lostPerfettoPackets = result.lostPerfettoPackets;
      this.traceTypesWithParsingErrors = result.traceTypesWithParsingErrors;
      this.traceGeometryData = result.traceGeometryData;
    }
    if (result.timezoneInfo) {
      this.timezoneInfo = result.timezoneInfo;
    }

    const {legacy, nonPerfetto} = this.updateTimestamps(
      result.legacy,
      result.nonPerfetto,
      result.perfetto,
    );
    this.loadedFiles.addFiles(legacy, nonPerfetto, result.perfetto);
    await this.tryMergeLegacyTransitions();
    await this.tryMergeInputEvents();
  }

  hasConvertibleLegacyTraces(): boolean {
    return this.loadedFiles.getLegacyFileReaders().length > 0;
  }

  async makeZipArchiveWithLoadedTraceFiles(
    onProgressUpdate?: OnProgressUpdateType,
  ): Promise<Blob> {
    return this.loadedFiles.makeZipArchive(onProgressUpdate);
  }

  getLoadedFileReaders(): FileReader[] {
    return [
      ...this.loadedFiles.getPerfettoFileReaders(),
      ...this.loadedFiles.getNonPerfettoFileReaders(),
      ...this.loadedFiles.getLegacyFileReaders(),
    ];
  }

  hasLoadedRequestedType(requestedTypes: TraceType[]): boolean {
    const loadedReaders = this.getLoadedFileReaders();
    return loadedReaders.some((reader) => {
      return requestedTypes.includes(reader.getTraceType());
    });
  }

  removeFileReader(reader: FileReader) {
    this.loadedFiles.remove(reader);
  }

  getDownloadArchiveFilename(): string {
    return this.downloadArchiveFilename;
  }

  getTimestampConverter(): TimestampConverter {
    return this.timestampConverter;
  }

  async buildTraces(
    discardLegacy: boolean,
    progressListener: ProgressListener | undefined,
  ): Promise<boolean> {
    this.filterLoadedFilesWithoutVisualization();
    await this.handleLegacyFileReaders(discardLegacy, progressListener);

    progressListener?.onProgressUpdate('Building traces...', undefined);
    const parsers = [
      ...this.loadedFiles.getPerfettoFileReaders(),
      ...this.loadedFiles.getNonPerfettoFileReaders(),
    ];
    if (parsers.length === 0) {
      return false;
    }
    const traces = this.buildTracesFromParsers(parsers);
    if (traces.getSize() === 0) {
      return false;
    }
    for (const trace of traces) {
      if (this.traceTypesWithParsingErrors.has(trace.type)) {
        if (
          this.traceTypesWithParsingErrors.get(trace.type) ===
          ParsingErrorType.DATA_INCORRECT
        ) {
          trace.setCorruptedState(true, 'Trace processor error incorrect data');
        } else {
          trace.setCorruptedState(
            true,
            'Trace processor error incomplete data',
          );
        }
      }
    }

    try {
      const startTimeMs = Date.now();
      await this.buildFrameMapping(traces);
      Analytics.Loading.logFrameMapBuildTime(Date.now() - startTimeMs);
      Analytics.Memory.logUsage('frame_map_built');
    } catch (e) {
      UserNotifier.add(makeWarningIncompleteFrameMapping((e as Error).message));
    }

    this.traces = traces;
    return true;
  }

  getTraces(): Traces {
    if (!this.traces) {
      throw new Error(
        'Attempted to retrieve traces before they have been built',
      );
    }
    return this.traces;
  }

  getTraceGeometryData(): TraceGeometryData {
    return this.traceGeometryData;
  }

  getLostPerfettoPackets(): number {
    return this.lostPerfettoPackets;
  }

  getTraceTypesWithParsingErrors(): Map<TraceType, ParsingErrorType> {
    return this.traceTypesWithParsingErrors;
  }

  async tryCreateSearchTrace(
    query: string,
  ): Promise<Trace<QueryResult> | undefined> {
    if (!this.traces) {
      throw new Error(
        'Attempted to create search trace before traces have been built',
      );
    }
    try {
      const parser = new ParserSearch(query, this.timestampConverter);
      await parser.parse();
      const trace = Trace.fromParser(parser);
      this.traces.addTrace(trace);
      return trace;
    } catch (e) {
      this.logger.error('Failed to create search trace', e);
      return undefined;
    }
  }

  private async tryMergeLegacyTransitions() {
    const legacyReaders = this.loadedFiles.getLegacyFileReaders();
    const readerShell = legacyReaders.find((r) => {
      return r.getTraceType() === TraceType.SHELL_TRANSITION;
    });
    const readerWm = legacyReaders.find((r) => {
      return r.getTraceType() === TraceType.WM_TRANSITION;
    });
    if (!readerShell || !readerWm) {
      return;
    }

    const readerTransitions = new FileReaderTransitions(
      readerShell,
      readerWm,
      this.timestampConverter,
    );
    readerTransitions.read();
    this.loadedFiles.addFiles([readerTransitions], [], []);
    this.loadedFiles.remove(readerWm);
    this.loadedFiles.remove(readerShell);
  }

  private async tryMergeInputEvents() {
    const perfetto = this.loadedFiles.getPerfettoFileReaders();
    const parserKey = perfetto.find((p) => {
      return p.getTraceType() === TraceType.INPUT_KEY_EVENT;
    });
    const parserMotion = perfetto.find((p) => {
      return p.getTraceType() === TraceType.INPUT_MOTION_EVENT;
    });
    if (!parserKey && !parserMotion) {
      return;
    }
    const parserInput = new ParserInput(
      parserKey as Parser<HierarchyTreeNode> | undefined,
      parserMotion as Parser<HierarchyTreeNode> | undefined,
      parserKey?.getFiles() ?? assertDefined(parserMotion?.getFiles()),
    );
    await parserInput.parse();
    this.loadedFiles.addFiles([], [], [parserInput], false);
    if (parserKey) {
      this.loadedFiles.remove(parserKey);
    }
    if (parserMotion) {
      this.loadedFiles.remove(parserMotion);
    }
  }

  private async convertLegacyFilesToPerfettoFile(): Promise<
    TraceFile | undefined
  > {
    const readers = this.loadedFiles.getLegacyFileReaders();
    const allReaders = [
      ...readers,
      ...this.loadedFiles.getPerfettoFileReaders(),
    ];

    const converter = new LegacyToPerfettoConverter()
      .setLegacyFileReaders(readers)
      .setAllFileReaders(allReaders);

    const perfettoFile = this.loadedFiles.getPerfettoFile();
    if (perfettoFile) {
      converter.setPerfettoFile(perfettoFile);
    }

    return await converter.convert();
  }

  private makeDownloadArchiveFilename(
    fileReaders: FileReader[],
    source: FilesSource,
  ): string {
    const files = fileReaders.flatMap((reader) => reader.getFiles());
    // set download archive file name, used to download all traces
    let filenameWithCurrTime: string;
    const currTime = new Date().toISOString().slice(0, -5).replace('T', '_');
    if (
      this.downloadArchiveFilename ===
        LoadedFileData.DEFAULT_DOWNLOAD_ARCHIVE_NAME &&
      files.length === 1
    ) {
      const filenameNoDir = removeDirFromFileName(files[0].file.name);
      const filenameNoDirOrExt = removeExtensionFromFilename(filenameNoDir);
      filenameWithCurrTime = `${filenameNoDirOrExt}_${currTime}`;
    } else {
      filenameWithCurrTime = `${source}_${currTime}`;
    }

    const archiveFilenameNoIllegalChars = filenameWithCurrTime.replace(
      ILLEGAL_FILENAME_CHARACTERS_REGEX,
      '_',
    );
    if (DOWNLOAD_FILENAME_REGEX.test(archiveFilenameNoIllegalChars)) {
      return archiveFilenameNoIllegalChars;
    } else {
      this.logger.error(
        'Cannot convert uploaded archive filename to acceptable format for download. ' +
          "Defaulting download filename to 'winscope.zip'.",
      );
      return LoadedFileData.DEFAULT_DOWNLOAD_ARCHIVE_NAME;
    }
  }

  private updateTimestamps(
    legacyReaders: LegacyFileReader[],
    nonPerfettoReaders: FileReaderAndParser[],
    perfettoReaders: FileReaderAndParser[],
  ): {legacy: LegacyFileReader[]; nonPerfetto: FileReaderAndParser[]} {
    const allParsers: FileReader[] = [
      ...legacyReaders,
      ...nonPerfettoReaders,
      ...perfettoReaders,
    ];

    const monotonicTimeOffset =
      getReaderWithLatestRealToMonotonicTimeOffset(
        allParsers,
      )?.getRealToMonotonicTimeOffsetNs();

    const realToBootTimeOffset =
      getReaderWithLatestRealToBootTimeOffset(
        allParsers,
      )?.getRealToBootTimeOffsetNs();

    if (monotonicTimeOffset !== undefined) {
      this.timestampConverter.setRealToMonotonicTimeOffsetNs(
        monotonicTimeOffset,
      );
    }
    if (realToBootTimeOffset !== undefined) {
      this.timestampConverter.setRealToBootTimeOffsetNs(realToBootTimeOffset);
    }

    perfettoReaders.forEach((r) => r.createTimestamps());
    const tryCreateTimestamps = (fileParser: FileReader) => {
      try {
        fileParser.createTimestamps();
        return true;
      } catch (e) {
        UserNotifier.add(
          makeWarningInvalidLegacyTrace(
            fileParser.getDescriptors(),
            `Failed to create timestamps: ${(e as Error).message}`,
          ),
        );
        return false;
      }
    };
    legacyReaders = legacyReaders.filter(tryCreateTimestamps);
    nonPerfettoReaders = nonPerfettoReaders.filter(tryCreateTimestamps);
    return {legacy: legacyReaders, nonPerfetto: nonPerfettoReaders};
  }

  private filterLoadedFilesWithoutVisualization() {
    this.getLoadedFileReaders().forEach((reader) => {
      if (!isTraceTypeWithViewer(reader.getTraceType())) {
        this.loadedFiles.remove(reader);
      }
    });
  }

  private async handleLegacyFileReaders(
    discardLegacy: boolean,
    progressListener: ProgressListener | undefined,
  ) {
    if (discardLegacy) {
      this.discardLegacyFiles();
    } else {
      progressListener?.onProgressUpdate(
        'Converting legacy files to perfetto...',
        undefined,
      );
      await this.convertLegacyTracesToPerfetto();
    }
  }

  private async convertLegacyTracesToPerfetto() {
    if (!this.hasConvertibleLegacyTraces()) {
      return;
    }
    const singlePerfettoTrace = await this.convertLegacyFilesToPerfettoFile();
    if (!singlePerfettoTrace) {
      return;
    }
    const result = await new FileLoader(this.timestampConverter).load(
      [singlePerfettoTrace.file],
      FilesSource.APP,
      undefined,
    );

    this.lostPerfettoPackets = result.lostPerfettoPackets;
    this.traceGeometryData = result.traceGeometryData;
    if (result.timezoneInfo) {
      this.timezoneInfo = result.timezoneInfo;
    }

    if (result.perfetto.length === 0) {
      return;
    }

    this.timestampConverter.clear();
    this.updateTimestamps([], [], result.perfetto);
    this.loadedFiles.addFiles([], [], result.perfetto);
    await this.tryMergeInputEvents();
  }

  private discardLegacyFiles() {
    const fileReaders = this.loadedFiles.getLegacyFileReaders();
    fileReaders.forEach((reader) => {
      this.removeFileReader(reader);
    });
  }

  private buildTracesFromParsers(parsers: Array<Parser<unknown>>) {
    const traces = new Traces();
    parsers.forEach((parser: Parser<unknown>) => {
      const trace = Trace.fromParser(parser);
      traces.addTrace(trace);
      Analytics.Tracing.logTraceLoaded(parser);
    });
    return traces;
  }

  private async buildFrameMapping(traces: Traces) {
    for (const trace of traces) {
      if (trace.lengthEntries === 0 || trace.isDumpWithoutTimestamp()) {
        continue;
      } else {
        const timestamp = trace.getEntry(0).getTimestamp();
        const utcOffset = await getResolvedUTCOffset(
          this.timezoneInfo,
          timestamp,
          this.getTimezoneNsFromPerfetto,
        );
        this.timestampConverter.setUTCOffset(utcOffset);
        break;
      }
    }
    await new FrameMapper(traces).computeMapping();
  }

  /**
   * Gets the UTC offset from Perfetto in minutes and converts it in nanoseconds.
   *
   * @param traceProcessor TraceProcessor instance used to read from Perfetto.
   * @return The timezone offset in nanoseconds.
   */
  private async getTimezoneNsFromPerfetto(): Promise<bigint | undefined> {
    const query = `
        SELECT
          int_value
        FROM
          metadata
        WHERE
          name = 'timezone_off_mins'
        `;

    const result = await TraceProcessorFactory.getSingleInstance().query(query);

    if (result && result.numRows() > 0) {
      const timezoneOffsetMinutes = Number(
        result.firstRow({int_value: 0n}).int_value,
      );
      return BigInt(timezoneOffsetMinutes) * TIME_UNIT_TO_NANO.m;
    }
    return undefined;
  }
}

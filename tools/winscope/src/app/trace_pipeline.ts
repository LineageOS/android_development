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

import {
  decompressGZipFile,
  DOWNLOAD_FILENAME_REGEX,
  ILLEGAL_FILENAME_CHARACTERS_REGEX,
  isGZipFile,
  isZipFile,
  removeDirFromFileName,
  removeExtensionFromFilename,
  unzipFile,
  OnProgressUpdateType,
} from '@common/io';
import {TimezoneInfo} from '@common/time/time';
import {
  TimestampConverter,
  UTC_TIMEZONE_INFO,
} from '@common/time/timestamp_converter';
import {Analytics} from '@logging/analytics';
import {ProgressListener} from '@messaging/progress_listener';
import {UserWarning} from '@messaging/user_warning';
import {
  makeWarningCorruptedArchive,
  makeWarningNoValidFiles,
  makeWarningUnsupportedFileFormat,
} from './warnings';
import {
  makeWarningInvalidLegacyTrace,
  makeWarningInvalidPerfettoTrace,
} from '@parsers/helpers/warnings';
import {WinscopeEvent} from '@messaging/winscope_event';
import {
  EmitEvent,
  WinscopeEventEmitter,
} from '@messaging/winscope_event_emitter';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {LegacyFileReaderFactory} from '@app/legacy_file_reader_factory';
import {NonPerfettoParserFactory} from '@app/non_perfetto_parser_factory';
import {LegacyToPerfettoConverter} from './legacy_to_perfetto_converter';
import {
  getReaderWithLatestRealToBootTimeOffset,
  getReaderWithLatestRealToMonotonicTimeOffset,
} from '@app/file_reader_helpers';
import {PerfettoParserFactory} from '@app/perfetto_parser_factory';
import {ParserSearch} from '@parsers/search/parser_search';
import {UserNotifier} from '@services/user_notifier';
import {TraceFile} from '@trace/trace_file';
import {FrameMapper} from '@trace_api/frame_mapper';
import {Trace} from '@trace_api/trace';
import {TraceMetadata} from '@trace_api/trace_metadata';
import {TraceType, isTraceTypeWithViewer} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {QueryResult} from '@trace_processor/query_result';
import {TraceProcessorFactory} from '@trace_processor/trace_processor_factory';
import {FilesSource} from './files_source';
import {LoadedFiles} from './loaded_files';
import {TraceFileIdentifier} from './trace_file_identifier';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {getLogger, Logger} from '@compat/logging';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {ProcessedFiles} from '@app/processed_files';
import {FileReader} from '@trace_api/file_reader';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {FileReaderTransitions} from '@legacy_file_readers/transitions/file_reader_transitions';
import {Parser} from '@trace_api/parser';
import {ParserInput} from '@parsers/input/parser_input';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {FileReaderAndParser} from './file_reader_and_parser';

/**
 * A pipeline that loads, parses and transforms traces.
 *
 * The pipeline is responsible for:
 * - Unzipping and filtering files
 * - Reading and identifying files
 * - Parsing and converting files into traces
 * - Transforming traces (e.g. merging, creating frame mapping)
 * - Storing the final traces
 */
export class TracePipeline
  implements WinscopeEventListener, WinscopeEventEmitter
{
  private loadedFiles = new LoadedFiles<FileReaderAndParser>();
  private traceFileFilter = new TraceFileIdentifier<FileReaderAndParser>();
  private traces = new Traces();
  private downloadArchiveFilename?: string;
  private lostPerfettoPackets = 0;
  private timestampConverter = new TimestampConverter(UTC_TIMEZONE_INFO);
  private traceGeometryData = new TraceGeometryData();

  constructor(private readonly logger: Logger = getLogger('TracePipeline')) {}

  setEmitEvent(callback: EmitEvent) {
    this.traceFileFilter.setEmitEvent(callback);
  }

  getTraceGeometryData(): TraceGeometryData {
    return this.traceGeometryData;
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    await this.traceFileFilter.onWinscopeEvent(event);
  }

  async loadFiles(
    files: File[],
    source: FilesSource,
    progressListener: ProgressListener | undefined,
  ): Promise<UserWarning[]> {
    this.downloadArchiveFilename = this.makeDownloadArchiveFilename(
      files,
      source,
    );

    try {
      const unzippedFiles = await this.unzipFiles(files, progressListener);
      if (unzippedFiles.length === 0) {
        UserNotifier.add(makeWarningNoValidFiles());
        return [];
      }

      const warnings = await this.loadUnzippedFiles(
        unzippedFiles,
        source,
        progressListener,
      );
      await this.tryMergeLegacyTransitions();
      await this.tryMergeInputEvents();

      return warnings;
    } finally {
      progressListener?.onOperationFinished(true);
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
    const nonLegacy = this.loadedFiles.getNonLegacyFileReaders();
    const parserKey = nonLegacy.find((p) => {
      return p.getTraceType() === TraceType.INPUT_KEY_EVENT;
    });
    const parserMotion = nonLegacy.find((p) => {
      return p.getTraceType() === TraceType.INPUT_MOTION_EVENT;
    });
    if (!parserKey || !parserMotion) {
      return;
    }
    const parserInput = new ParserInput(
      parserKey as Parser<HierarchyTreeNode>,
      parserMotion as Parser<HierarchyTreeNode>,
      parserKey.getFiles(),
    );
    await parserInput.parse();
    this.loadedFiles.addFiles([], [], [parserInput], false);
    this.loadedFiles.remove(parserKey);
    this.loadedFiles.remove(parserMotion);
  }

  async convertLegacyTracesToPerfetto() {
    if (!this.hasConvertibleLegacyTraces()) {
      return;
    }
    const singlePerfettoTrace = await this.convertLegacyFilesToPerfettoFile();
    if (!singlePerfettoTrace) {
      return;
    }
    const perfettoParsers = await this.processPerfettoFile(
      singlePerfettoTrace,
      FilesSource.APP,
      undefined,
      makeWarningInvalidPerfettoTrace(singlePerfettoTrace.getDescriptor(), [
        'failed to convert legacy files into perfetto trace',
      ]),
    );
    if (perfettoParsers.length === 0) {
      return;
    }

    this.timestampConverter.clear();
    this.updateTimestamps([], perfettoParsers);
    this.loadedFiles.addFiles([], [], perfettoParsers);
  }

  hasConvertibleLegacyTraces(): boolean {
    return this.loadedFiles.getLegacyFileReaders().length > 0;
  }

  discardLegacyTraces() {
    const fileReaders = this.loadedFiles.getLegacyFileReaders();
    fileReaders.forEach((reader) => {
      this.removeFileReader(reader);
    });
  }

  async makeZipArchiveWithLoadedTraceFiles(
    onProgressUpdate?: OnProgressUpdateType,
  ): Promise<Blob> {
    return this.loadedFiles.makeZipArchive(onProgressUpdate);
  }

  async buildFrameMapping() {
    for (const trace of this.traces) {
      if (trace.lengthEntries === 0 || trace.isDumpWithoutTimestamp()) {
        continue;
      } else {
        const timestamp = trace.getEntry(0).getTimestamp();
        this.timestampConverter.initializeUTCOffset(timestamp);
        break;
      }
    }
    await new FrameMapper(this.traces).computeMapping();
  }

  getLoadedFileReaders(): FileReader[] {
    return [
      ...this.loadedFiles.getNonLegacyFileReaders(),
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

  getTraces(): Traces {
    return this.traces;
  }

  getDownloadArchiveFilename(): string {
    return this.downloadArchiveFilename ?? 'winscope';
  }

  getTimestampConverter(): TimestampConverter {
    return this.timestampConverter;
  }

  lostPackets(): number {
    return this.lostPerfettoPackets;
  }

  getScreenRecordingTrace(): Trace<MediaBasedTraceEntry> | undefined {
    const trace = this.getTraces().getTrace<MediaBasedTraceEntry>(
      TraceType.SCREEN_RECORDING,
    );
    if (!trace || trace.lengthEntries === 0) {
      return undefined;
    }
    return trace;
  }

  async tryCreateSearchTrace(
    query: string,
  ): Promise<Trace<QueryResult> | undefined> {
    try {
      const parser = new ParserSearch(query, this.timestampConverter);
      await parser.parse();
      const trace = Trace.fromParser(parser);
      this.traces.addTrace(trace);
      return trace;
    } catch {
      return undefined;
    }
  }

  onDestroy() {
    this.loadedFiles.getNonLegacyFileReaders().forEach((reader) => {
      reader.onDestroy?.();
    });
  }

  private async loadUnzippedFiles(
    unzippedFiles: TraceFile[],
    source: FilesSource,
    progressListener: ProgressListener | undefined,
  ): Promise<UserWarning[]> {
    const warnings: UserWarning[] = [];

    const tryIdentifyLegacy = (
      files: TraceFile[],
      timezoneInfo?: TimezoneInfo,
    ) => {
      return this.processLegacyFiles(
        files,
        timezoneInfo,
        source,
        progressListener,
      );
    };

    const tryIdentifyNonPerfetto = (
      files: TraceFile[],
      metadata: TraceMetadata,
    ) => {
      return this.processNonPerfettoFiles(
        files,
        metadata,
        source,
        progressListener,
      );
    };

    const tryIdentifyPerfetto = (file: TraceFile) => {
      return this.processPerfettoFile(
        file,
        source,
        progressListener,
        makeWarningUnsupportedFileFormat(file.getDescriptor()),
      );
    };

    const identifiedFiles = await this.traceFileFilter.identifyFiles(
      unzippedFiles,
      tryIdentifyLegacy,
      tryIdentifyNonPerfetto,
      tryIdentifyPerfetto,
    );
    warnings.push(...identifiedFiles.criticalWarnings);

    if (
      identifiedFiles.perfetto === undefined &&
      identifiedFiles.legacy.length === 0 &&
      identifiedFiles.nonPerfetto.length === 0
    ) {
      return warnings;
    }

    if (identifiedFiles.perfetto) {
      await this.checkForLostPerfettoPackets();
    }

    identifiedFiles.legacy = this.updateTimestamps(
      identifiedFiles.legacy,
      identifiedFiles.perfetto,
    );
    identifiedFiles.nonPerfetto = this.updateTimestamps(
      identifiedFiles.nonPerfetto,
      identifiedFiles.perfetto,
    );
    this.loadedFiles.addFiles(
      identifiedFiles.legacy,
      identifiedFiles.nonPerfetto,
      identifiedFiles.perfetto,
    );

    return warnings;
  }

  private async processLegacyFiles(
    files: TraceFile[],
    timezoneInfo: TimezoneInfo | undefined,
    source: FilesSource,
    progressListener: ProgressListener | undefined,
  ): Promise<ProcessedFiles<LegacyFileReader>> {
    if (timezoneInfo) {
      this.timestampConverter = new TimestampConverter(timezoneInfo);
    }

    const startTimeMs = Date.now();
    const processed = await new LegacyFileReaderFactory().processFiles(
      files,
      this.timestampConverter,
      progressListener,
    );

    Analytics.Loading.logFileParsingTime(
      'legacy',
      source,
      Date.now() - startTimeMs,
    );
    Analytics.Memory.logUsage('legacy_files_parsed');

    return processed;
  }

  private async processNonPerfettoFiles(
    files: TraceFile[],
    metadata: TraceMetadata,
    source: FilesSource,
    progressListener: ProgressListener | undefined,
  ): Promise<ProcessedFiles<FileReaderAndParser>> {
    const startTimeMs = Date.now();
    const processed = await new NonPerfettoParserFactory().processFiles(
      files,
      this.timestampConverter,
      metadata,
      progressListener,
    );

    Analytics.Loading.logFileParsingTime(
      'non_perfetto',
      source,
      Date.now() - startTimeMs,
    );
    Analytics.Memory.logUsage('non_perfetto_files_parsed');

    return processed;
  }

  private async processPerfettoFile(
    file: TraceFile,
    source: FilesSource,
    progressListener: ProgressListener | undefined,
    onFailureWarning: UserWarning,
  ): Promise<FileReaderAndParser[]> {
    const startTimeMs = Date.now();
    const {parsers, isPerfettoTrace, traceGeometryData} =
      await new PerfettoParserFactory().processFile(
        file,
        this.timestampConverter,
        progressListener,
      );
    this.traceGeometryData = traceGeometryData;
    Analytics.Loading.logFileParsingTime(
      'perfetto',
      source,
      Date.now() - startTimeMs,
    );
    Analytics.Memory.logUsage('perfetto_files_parsed');
    if (parsers.length === 0 && !isPerfettoTrace) {
      UserNotifier.add(onFailureWarning);
    }
    return parsers;
  }

  private async checkForLostPerfettoPackets() {
    const tp = TraceProcessorFactory.getSingleInstance();
    const packetLossQuery =
      'SELECT name, value FROM stats ' +
      "WHERE name = 'traced_buf_trace_writer_packet_loss'";
    const res = await tp.query(packetLossQuery);
    const value = res.numRows() > 0 ? res.iter({}).get('value') : undefined;
    if (typeof value === 'bigint' && value > 0n) {
      this.lostPerfettoPackets = Number(value);
    } else {
      this.lostPerfettoPackets = 0;
    }
  }

  private updateTimestamps<T extends FileReader>(
    nonPerfettoParsers: T[],
    perfettoParsers: FileReader[],
  ): T[] {
    const allParsers: FileReader[] = [
      ...nonPerfettoParsers,
      ...perfettoParsers,
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

    perfettoParsers.forEach((p) => p.createTimestamps());
    return nonPerfettoParsers.filter((fileParser) => {
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
    });
  }

  filterLoadedFilesWithoutVisualization() {
    this.getLoadedFileReaders().forEach((reader) => {
      if (!isTraceTypeWithViewer(reader.getTraceType())) {
        this.loadedFiles.remove(reader);
      }
    });
  }

  buildTraces() {
    const traces = new Traces();
    this.loadedFiles.getNonLegacyFileReaders().forEach((parser) => {
      const trace = Trace.fromParser(parser);
      traces.addTrace(trace);
      Analytics.Tracing.logTraceLoaded(parser);
    });
    this.traces = traces;
  }

  private async convertLegacyFilesToPerfettoFile(): Promise<
    TraceFile | undefined
  > {
    const readers = this.loadedFiles.getLegacyFileReaders();
    const allReaders = [
      ...readers,
      ...this.loadedFiles
        .getNonLegacyFileReaders()
        .filter((r) => r.isPerfetto()),
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
    files: File[],
    source: FilesSource,
  ): string {
    // set download archive file name, used to download all traces
    let filenameWithCurrTime: string;
    const currTime = new Date().toISOString().slice(0, -5).replace('T', '_');
    if (!this.downloadArchiveFilename && files.length === 1) {
      const filenameNoDir = removeDirFromFileName(files[0].name);
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
      return 'winscope';
    }
  }

  private async unzipFiles(
    files: File[],
    progressListener: ProgressListener | undefined,
  ): Promise<TraceFile[]> {
    const unzippedFiles: TraceFile[] = [];
    const progressMessage = 'Unzipping files...';

    progressListener?.onProgressUpdate(progressMessage, 0);

    for (let i = 0; i < files.length; i++) {
      let file = files[i];

      const onSubProgressUpdate = (subPercentage: number) => {
        const totalPercentage =
          (100 * i) / files.length + subPercentage / files.length;
        progressListener?.onProgressUpdate(progressMessage, totalPercentage);
      };

      if (await isGZipFile(file)) {
        file = await decompressGZipFile(file);
      }

      if (await isZipFile(file)) {
        try {
          const subFiles = await unzipFile(file, onSubProgressUpdate);
          const subTraceFiles = subFiles.map((subFile) => {
            return new TraceFile(subFile, file);
          });
          unzippedFiles.push(...subTraceFiles);
          onSubProgressUpdate(100);
        } catch {
          UserNotifier.add(makeWarningCorruptedArchive(file));
        }
      } else {
        unzippedFiles.push(new TraceFile(file, undefined));
      }
    }
    progressListener?.onProgressUpdate(progressMessage, 100);

    return unzippedFiles;
  }
}

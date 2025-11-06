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
} from 'common/io';
import {TimezoneInfo} from 'common/time/time';
import {
  TimestampConverter,
  UTC_TIMEZONE_INFO,
} from 'common/time/timestamp_converter';
import {Analytics} from 'logging/analytics';
import {ProgressListener} from 'messaging/progress_listener';
import {UserWarning} from 'messaging/user_warning';
import {
  makeWarningCorruptedArchive,
  makeWarningNoValidFiles,
  makeWarningUnsupportedFileFormat,
} from './warnings';
import {
  makeWarningInvalidLegacyTrace,
  makeWarningInvalidPerfettoTrace,
} from 'parsers/warnings';
import {WinscopeEvent} from 'messaging/winscope_event';
import {
  EmitEvent,
  WinscopeEventEmitter,
} from 'messaging/winscope_event_emitter';
import {WinscopeEventListener} from 'messaging/winscope_event_listener';
import {FileAndParser} from 'parsers/file_and_parser';
import {FileAndParsers} from 'parsers/file_and_parsers';
import {
  ParserFactory as LegacyParserFactory,
  ProcessedFiles,
} from 'parsers/legacy/parser_factory';
import {LegacyToPerfettoConverter} from 'parsers/legacy_to_perfetto_converter';
import {
  getParserWithLatestRealToBootTimeOffset,
  getParserWithLatestRealToMonotonicTimeOffset,
} from 'parsers/parser_time_utils';
import {ParserFactory as PerfettoParserFactory} from 'parsers/perfetto/parser_factory';
import {ParserSearch} from 'parsers/search/parser_search';
import {TracesParserFactory} from 'parsers/traces/traces_parser_factory';
import {UserNotifier} from 'services/user_notifier';
import {TraceFile} from 'trace/trace_file';
import {FrameMapper} from 'trace_api/frame_mapper';
import {Parser} from 'trace_api/parser';
import {Trace} from 'trace_api/trace';
import {TraceMetadata} from 'trace_api/trace_metadata';
import {
  TraceEntryTypeMap,
  TraceType,
  isTraceTypeWithViewer,
} from 'trace_api/trace_type';
import {Traces} from 'trace_api/traces';
import {QueryResult} from 'trace_processor/query_result';
import {TraceProcessorFactory} from 'trace_processor/trace_processor_factory';
import {FilesSource} from './files_source';
import {LoadedParsers} from './loaded_parsers';
import {TraceFileFilter} from './trace_file_filter';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {MediaBasedTraceEntry} from 'trace_api/media_based_trace_entry';

/**
 * A pipeline that loads, parses and transforms traces.
 *
 * The pipeline is responsible for:
 * - Unzipping and filtering files
 * - Parsing files into traces
 * - Transforming traces (e.g. merging, creating frame mapping)
 * - Storing the final traces
 */
export class TracePipeline
  implements WinscopeEventListener, WinscopeEventEmitter
{
  private loadedParsers = new LoadedParsers();
  private traceFileFilter = new TraceFileFilter();
  private traces = new Traces();
  private downloadArchiveFilename?: string;
  private lostPerfettoPackets = 0;
  private timestampConverter = new TimestampConverter(UTC_TIMEZONE_INFO);
  private traceGeometryData: TraceGeometryData | undefined;

  setEmitEvent(callback: EmitEvent) {
    this.traceFileFilter.setEmitEvent(callback);
  }

  getTraceGeometryData() {
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

      await this.convertLoadedParsersToTraces();

      return warnings;
    } finally {
      progressListener?.onOperationFinished(true);
    }
  }

  async convertLegacyTracesToPerfetto() {
    if (!this.hasConvertibleLegacyTraces()) {
      return;
    }
    const singlePerfettoTrace = await this.convertLegacyParsersToPerfettoFile();
    if (!singlePerfettoTrace) {
      return;
    }
    this.clearChildTransitionTraces((type) =>
      this.loadedParsers.removeByType(type),
    );
    const perfettoParsers = await this.processPerfettoFile(
      singlePerfettoTrace,
      FilesSource.APP,
      undefined,
      makeWarningInvalidPerfettoTrace(singlePerfettoTrace.getDescriptor(), [
        'failed to convert legacy parsers into perfetto trace',
      ]),
    );
    if (!perfettoParsers || perfettoParsers.parsers.length === 0) {
      return;
    }

    this.timestampConverter.clear();
    this.updateTimestamps([], perfettoParsers);
    this.loadedParsers.addParsers([], perfettoParsers);
    await this.convertLoadedParsersToTraces();
  }

  hasConvertibleLegacyTraces(): boolean {
    return this.getLegacyTracesWithPerfettoConversion().length > 0;
  }

  discardLegacyTraces() {
    this.clearChildTransitionTraces((type: TraceType) => {
      this.loadedParsers.removeByType(type);
    });

    const tracesToRemove = this.getLegacyTracesWithPerfettoConversion();
    tracesToRemove.forEach((trace) => {
      this.removeTrace(trace);
    });
  }

  removeTrace<T extends TraceType>(trace: Trace<TraceEntryTypeMap[T]>) {
    const clear = (type: TraceType) => {
      this.loadedParsers.removeByType(type);
    };
    if (trace.type === TraceType.TRANSITION) {
      this.clearChildTransitionTraces(clear);
    } else if (trace.type === TraceType.CUJS) {
      this.clearChildCujTrace(clear);
    } else if (trace.type === TraceType.INPUT_EVENT_MERGED) {
      this.clearChildInputTraces(clear);
    }
    this.loadedParsers.remove(trace.getParser());
    this.traces.deleteTrace(trace);
  }

  async makeZipArchiveWithLoadedTraceFiles(
    onProgressUpdate?: OnProgressUpdateType,
  ): Promise<Blob> {
    return this.loadedParsers.makeZipArchive(onProgressUpdate);
  }

  filterTracesWithoutVisualization() {
    const tracesWithoutVisualization = this.traces
      .mapTrace((trace) => {
        if (!isTraceTypeWithViewer(trace.type)) {
          return trace;
        }
        return undefined;
      })
      .filter((trace) => trace !== undefined) as Array<Trace<object>>;
    tracesWithoutVisualization.forEach((trace) =>
      this.traces.deleteTrace(trace),
    );
  }

  async buildTraces() {
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
    const trace = this.getTraces().getTrace(TraceType.SCREEN_RECORDING);
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

  clear() {
    this.traces.forEachTrace((trace) => {
      trace.onDestroy();
    });
    this.loadedParsers.clear();
    this.traces = new Traces();
    this.timestampConverter.clear();
    this.downloadArchiveFilename = undefined;
    this.lostPerfettoPackets = 0;
  }

  private getLegacyTracesWithPerfettoConversion() {
    const traces: Array<Trace<object>> = [];
    this.traces.forEachTrace((trace) => {
      if (trace.getParser()?.canConvertToPerfetto()) {
        traces.push(trace);
      }
    });
    return traces;
  }

  private async loadUnzippedFiles(
    unzippedFiles: TraceFile[],
    source: FilesSource,
    progressListener: ProgressListener | undefined,
  ): Promise<UserWarning[]> {
    const warnings: UserWarning[] = [];

    const tryParseLegacy = (
      files: TraceFile[],
      metadata: TraceMetadata,
      timezoneInfo?: TimezoneInfo,
    ) => {
      return this.processLegacyFiles(
        files,
        metadata,
        timezoneInfo,
        source,
        progressListener,
      );
    };

    const tryParsePerfetto = (file: TraceFile) => {
      return this.processPerfettoFile(
        file,
        source,
        progressListener,
        makeWarningUnsupportedFileFormat(file.getDescriptor()),
      );
    };

    const parsedFiles = await this.traceFileFilter.filterAndParse(
      unzippedFiles,
      tryParseLegacy,
      tryParsePerfetto,
    );
    warnings.push(...(parsedFiles.criticalWarnings ?? []));

    if (parsedFiles.perfetto === undefined && parsedFiles.legacy.length === 0) {
      return warnings;
    }

    if (parsedFiles.perfetto) {
      await this.checkForLostPerfettoPackets();
    }

    parsedFiles.legacy = this.updateTimestamps(
      parsedFiles.legacy,
      parsedFiles.perfetto,
    );
    this.loadedParsers.addParsers(parsedFiles.legacy, parsedFiles.perfetto);

    return warnings;
  }

  private async processLegacyFiles(
    files: TraceFile[],
    metadata: TraceMetadata,
    timezoneInfo: TimezoneInfo | undefined,
    source: FilesSource,
    progressListener: ProgressListener | undefined,
  ): Promise<ProcessedFiles> {
    if (timezoneInfo) {
      this.timestampConverter = new TimestampConverter(timezoneInfo);
    }

    const startTimeMs = Date.now();
    const processedLegacyFiles = await new LegacyParserFactory().processFiles(
      files,
      this.timestampConverter,
      metadata,
      progressListener,
    );
    Analytics.Loading.logFileParsingTime(
      'legacy',
      source,
      Date.now() - startTimeMs,
    );
    Analytics.Memory.logUsage('legacy_files_parsed');

    return processedLegacyFiles;
  }

  private async processPerfettoFile(
    file: TraceFile,
    source: FilesSource,
    progressListener: ProgressListener | undefined,
    onFailureWarning: UserWarning,
  ): Promise<FileAndParsers | undefined> {
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
    if (parsers.length > 0) {
      return new FileAndParsers(file, parsers);
    }
    if (!isPerfettoTrace) {
      UserNotifier.add(onFailureWarning);
    }
    return undefined;
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

  private updateTimestamps(
    nonPerfettoParsers: FileAndParser[],
    perfettoParsers?: FileAndParsers,
  ): FileAndParser[] {
    const allParsers = nonPerfettoParsers
      .map((fileAndParser) => fileAndParser.parser)
      .concat(perfettoParsers?.parsers ?? []);

    const monotonicTimeOffset =
      getParserWithLatestRealToMonotonicTimeOffset(
        allParsers,
      )?.getRealToMonotonicTimeOffsetNs();

    const realToBootTimeOffset =
      getParserWithLatestRealToBootTimeOffset(
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

    perfettoParsers?.parsers.forEach((p) => p.createTimestamps());
    return nonPerfettoParsers.filter((fileAndParser) => {
      try {
        fileAndParser.parser.createTimestamps();
        return true;
      } catch (e) {
        UserNotifier.add(
          makeWarningInvalidLegacyTrace(
            fileAndParser.file.getDescriptor(),
            `Failed to create timestamps: ${(e as Error).message}`,
          ),
        );
        return false;
      }
    });
  }

  private async convertLoadedParsersToTraces() {
    this.traces = new Traces();

    this.loadedParsers.getParsers().forEach((parser) => {
      const trace = Trace.fromParser(parser);
      this.traces.addTrace(trace);
      Analytics.Tracing.logTraceLoaded(parser);
    });

    const tracesParsers = await new TracesParserFactory().createParsers(
      this.traces,
      this.timestampConverter,
    );

    tracesParsers.forEach((tracesParser) => {
      const trace = Trace.fromParser(tracesParser);
      this.traces.addTrace(trace);
    });

    const clear = (type: TraceType) => {
      this.removeTracesKeepForDownload(type);
    };
    this.clearChildTransitionTraces(clear);
    this.clearChildCujTrace(clear);
    this.clearChildInputTraces(clear);
  }

  private clearChildTransitionTraces(clear: (type: TraceType) => void) {
    const hasTransitionTrace =
      this.traces.getTrace(TraceType.TRANSITION) !== undefined;
    if (hasTransitionTrace) {
      clear(TraceType.WM_TRANSITION);
      clear(TraceType.SHELL_TRANSITION);
    }
  }

  private clearChildCujTrace(clear: (type: TraceType) => void) {
    const hasCujTrace = this.traces.getTrace(TraceType.CUJS) !== undefined;
    if (hasCujTrace) {
      clear(TraceType.EVENT_LOG);
    }
  }

  private clearChildInputTraces(clear: (type: TraceType) => void) {
    const hasMergedInputTrace =
      this.traces.getTrace(TraceType.INPUT_EVENT_MERGED) !== undefined;
    if (hasMergedInputTrace) {
      clear(TraceType.INPUT_KEY_EVENT);
      clear(TraceType.INPUT_MOTION_EVENT);
    }
  }

  private removeTracesKeepForDownload(type: TraceType) {
    this.traces.getTraces(type).forEach((trace) => {
      this.traces.deleteTrace(trace);
    });
  }

  private async convertLegacyParsersToPerfettoFile(): Promise<
    TraceFile | undefined
  > {
    const legacyParsers = this.traces
      .mapTrace((trace) => {
        return trace.isPerfetto() ? undefined : trace.getParser();
      })
      .filter((parser) => parser !== undefined) as Array<Parser<object>>;

    if (legacyParsers.length === 0) {
      return undefined;
    }

    const allParsers = this.traces.mapTrace((trace) => {
      return trace.getParser();
    });

    const converter = new LegacyToPerfettoConverter()
      .setLegacyParsers(legacyParsers)
      .setAllParsers(allParsers);

    const perfettoFile = this.loadedParsers.getPerfettoFile();
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
      console.error(
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

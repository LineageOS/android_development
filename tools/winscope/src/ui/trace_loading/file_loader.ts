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
import {decompressGZipFile, isGZipFile, isZipFile, unzipFile} from '@common/io';
import {TimezoneInfo} from '@common/time/time';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {LegacyFileReaderFactory} from '@legacy_file_readers/common/legacy_file_reader_factory';
import {ProcessedFiles} from '@legacy_file_readers/common/processed_files';
import {FileReaderInputMethodClients} from '@legacy_file_readers/input_method/file_reader_input_method_clients';
import {FileReaderInputMethodManagerService} from '@legacy_file_readers/input_method/file_reader_input_method_manager_service';
import {FileReaderInputMethodService} from '@legacy_file_readers/input_method/file_reader_input_method_service';
import {FileReaderProtoLog} from '@legacy_file_readers/protolog/file_reader_protolog';
import {FileReaderSurfaceFlinger} from '@legacy_file_readers/surface_flinger/file_reader_surface_flinger';
import {FileReaderTransactions} from '@legacy_file_readers/transactions/file_reader_transactions';
import {FileReaderTransitionsShell} from '@legacy_file_readers/transitions/file_reader_transitions_shell';
import {FileReaderTransitionsWm} from '@legacy_file_readers/transitions/file_reader_transitions_wm';
import {FileReaderViewCapture} from '@legacy_file_readers/view_capture/file_reader_view_capture';
import {FileReaderWindowManager} from '@legacy_file_readers/window_manager/file_reader_window_manager';
import {FileReaderWindowManagerDump} from '@legacy_file_readers/window_manager/file_reader_window_manager_dump';
import {Analytics} from '@logging/analytics';
import {ProgressListener} from '@messaging/progress_listener';
import {UserWarning} from '@messaging/user_warning';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent, WinscopeEventEmitter,} from '@messaging/winscope_event_emitter';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {ParserCujs} from '@parsers/cujs/perfetto/parser_cujs';
import {FileReaderAndParser} from '@parsers/file_reader_and_parser';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {ParserInputMethodClients} from '@parsers/input_method/parser_input_method_clients';
import {ParserInputMethodManagerService} from '@parsers/input_method/parser_input_method_manager_service';
import {ParserInputMethodService} from '@parsers/input_method/parser_input_method_service';
import {ParserKeyEvent} from '@parsers/input/parser_key_event';
import {ParserMotionEvent} from '@parsers/input/parser_motion_event';
import {PerfettoParserFactory} from '@parsers/perfetto_parser_factory';
import {ParserProtolog} from '@parsers/protolog/parser_protolog';
import {ParserSurfaceFlinger} from '@parsers/surface_flinger/parser_surface_flinger';
import {ParserTransactions} from '@parsers/transactions/parser_transactions';
import {ParserTransitions} from '@parsers/transitions/parser_transitions';
import {ParserViewCapture} from '@parsers/view_capture/parser_view_capture';
import {ParserWindowManager} from '@parsers/window_manager/parser_window_manager';
import {UserNotifier} from '@services/user_notifier';
import {FilesSource} from '@trace_api/files_source';
import {TraceFile} from '@trace_api/trace_file';
import {TraceMetadata} from '@trace_api/trace_metadata';
import {TraceType} from '@trace_api/trace_type';
import {TraceProcessorFactory} from '@trace_processor/trace_processor_factory';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {NonPerfettoParserFactory} from './non_perfetto_parser_factory';
import {ParsingErrorType} from './parsing_error_type';
import {IdentifiedFiles, TraceFileIdentifier} from './trace_file_identifier';
import {makeWarningCorruptedArchive, makeWarningNoValidFiles, makeWarningTraceProcessorError, makeWarningUnsupportedFileFormat,} from './warnings';

export interface FileLoaderResult {
  legacy: LegacyFileReader[];
  nonPerfetto: FileReaderAndParser[];
  perfetto: FileReaderAndParser[];
  lostPerfettoPackets: number;
  traceTypesWithParsingErrors: Map<TraceType, ParsingErrorType>;
  traceGeometryData: TraceGeometryData;
  warnings: UserWarning[];
  timezoneInfo: TimezoneInfo | undefined;
}

/**
 * A class that loads and reads trace files.
 *
 * The loader is responsible for:
 * - Unzipping and filtering files
 * - Reading and identifying files
 */
export class FileLoader implements WinscopeEventListener, WinscopeEventEmitter {
  private traceFileFilter = new TraceFileIdentifier<FileReaderAndParser>();
  private traceGeometryData = new TraceGeometryData();
  private readonly timestampConverter: TimestampConverter;
  private timezoneInfo: TimezoneInfo | undefined;
  private traceTypesWithParsingErrors: Map<TraceType, ParsingErrorType> =
    new Map();

  constructor(timestampConverter: TimestampConverter) {
    this.timestampConverter = timestampConverter;
  }

  setEmitEvent(callback: EmitEvent) {
    this.traceFileFilter.setEmitEvent(callback);
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    await this.traceFileFilter.onWinscopeEvent(event);
  }

  async load(
    files: File[],
    source: FilesSource,
    progressListener: ProgressListener | undefined,
  ): Promise<FileLoaderResult> {
    const unzippedFiles = await this.unzipFiles(files, progressListener);
    if (unzippedFiles.length === 0) {
      UserNotifier.add(makeWarningNoValidFiles());
      return {
        legacy: [],
        lostPerfettoPackets: 0,
        nonPerfetto: [],
        perfetto: [],
        traceTypesWithParsingErrors: new Map(),
        traceGeometryData: this.traceGeometryData,
        timezoneInfo: this.timezoneInfo,
        warnings: [],
      };
    }

    const {
      identifiedFiles,
      lostPerfettoPackets,
      traceTypesWithParsingErrors,
      warnings,
    } = await this.loadUnzippedFiles(unzippedFiles, source, progressListener);

    return {
      legacy: identifiedFiles.legacy,
      lostPerfettoPackets,
      nonPerfetto: identifiedFiles.nonPerfetto,
      perfetto: identifiedFiles.perfetto,
      traceTypesWithParsingErrors,
      traceGeometryData: this.traceGeometryData,
      timezoneInfo: this.timezoneInfo,
      warnings,
    };
  }

  private async loadUnzippedFiles(
    unzippedFiles: TraceFile[],
    source: FilesSource,
    progressListener: ProgressListener | undefined,
  ): Promise<{
    identifiedFiles: IdentifiedFiles<FileReaderAndParser>;
    lostPerfettoPackets: number;
    traceTypesWithParsingErrors: Map<TraceType, ParsingErrorType>;
    warnings: UserWarning[];
  }> {
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

    if (identifiedFiles.perfetto.length === 0) {
      return {
        lostPerfettoPackets: 0,
        traceTypesWithParsingErrors: new Map(),
        identifiedFiles,
        warnings,
      };
    }
    const lostPerfettoPackets = await this.checkForLostPerfettoPackets();
    const traceTypesWithParsingErrors =
      await this.checkForTraceProcessorErrors();
    return {
      lostPerfettoPackets,
      traceTypesWithParsingErrors,
      identifiedFiles,
      warnings,
    };
  }

  private async processLegacyFiles(
    files: TraceFile[],
    timezoneInfo: TimezoneInfo | undefined,
    source: FilesSource,
    progressListener: ProgressListener | undefined,
  ): Promise<ProcessedFiles<LegacyFileReader>> {
    if (timezoneInfo) {
      this.timezoneInfo = timezoneInfo;
    }

    const startTimeMs = Date.now();
    const processed = await this.createFileReaderFactory().processFiles(
      files,
      assertDefined(this.timestampConverter),
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
      assertDefined(this.timestampConverter),
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
  ): Promise<Array<FileReaderAndParser<HierarchyTreeNode>>> {
    const startTimeMs = Date.now();
    const processedFile = await this.createPerfettoParserFactory().processFile(
      file,
      assertDefined(this.timestampConverter),
      progressListener,
    );
    Analytics.Loading.logFileParsingTime(
      'perfetto',
      source,
      Date.now() - startTimeMs,
    );
    Analytics.Memory.logUsage('perfetto_files_parsed');
    if (processedFile.parsers.length === 0 && !processedFile.isPerfettoTrace) {
      UserNotifier.add(onFailureWarning);
    }
    this.traceGeometryData = processedFile.traceGeometryData;
    return processedFile.parsers;
  }

  private async checkForLostPerfettoPackets(): Promise<number> {
    const tp = TraceProcessorFactory.getSingleInstance();
    const packetLossQuery =
      'SELECT name, value FROM stats ' +
      "WHERE name = 'traced_buf_trace_writer_packet_loss'";
    const res = await tp.query(packetLossQuery);
    const value = res.numRows() > 0 ? res.iter({}).get('value') : undefined;
    if (typeof value === 'bigint' && value > 0n) {
      return Number(value);
    } else {
      return 0;
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
        unzippedFiles.push(new TraceFile(file));
      }
    }
    progressListener?.onProgressUpdate(progressMessage, 100);

    return unzippedFiles;
  }

  /**
   * Checks for trace processor errors.
   * @return A map of the traces that have processor errors and the type of error: incomplete data or incorrect data.
   */
  private async checkForTraceProcessorErrors(): Promise<
    Map<TraceType, ParsingErrorType>
  > {
    const traceProcessor = TraceProcessorFactory.getSingleInstance();

    const sql =
      'SELECT name FROM stats ' +
      "WHERE (name LIKE '%winscope%' OR name = 'android_input_event_parse_errors') AND value > 0";

    const stats = await traceProcessor.query(sql);
    const errorKewordsByTraceType = new Map<TraceType, string>([
      [TraceType.INPUT_METHOD_CLIENTS, 'inputmethod_clients'],
      [TraceType.INPUT_METHOD_MANAGER_SERVICE, 'inputmethod_manager_service'],
      [TraceType.INPUT_METHOD_SERVICE, 'inputmethod_service'],
      [TraceType.PROTO_LOG, 'protolog'],
      [TraceType.WINDOW_MANAGER, 'windowmanager'],
      [TraceType.SURFACE_FLINGER, 'sf'],
      [TraceType.TRANSACTIONS, 'transaction'],
      [TraceType.TRANSITION, 'transition'],
      [TraceType.CUJS, 'cuj'],
      [TraceType.VIEW_CAPTURE, 'viewcapture'],
      [TraceType.INPUT_MOTION_EVENT, 'input_motion'],
      [TraceType.INPUT_KEY_EVENT, 'input_key'],
      [TraceType.INPUT_EVENT_MERGED, 'input_event'],
      [TraceType.SCREEN_RECORDING, 'screen_recording'],
    ]);

    if (stats.numRows() > 0) {
      for (const it = stats.iter({}); it.valid(); it.next()) {
        const name = it.get('name');

        if (typeof name !== 'string') {
          continue;
        }

        for (const [traceType, keyword] of errorKewordsByTraceType.entries()) {
          if (name.includes(keyword)) {
            if (name === 'winscope_protolog_view_config_collision') {
              this.traceTypesWithParsingErrors.set(
                traceType,
                ParsingErrorType.DATA_INCORRECT,
              );
            } else {
              this.traceTypesWithParsingErrors.set(
                traceType,
                ParsingErrorType.DATA_INCOMPLETE,
              );
            }
            break;
          }
        }
      }

      UserNotifier.add(
        makeWarningTraceProcessorError(this.traceTypesWithParsingErrors),
      );
    }

    return this.traceTypesWithParsingErrors;
  }

  private createFileReaderFactory(): LegacyFileReaderFactory {
    return new LegacyFileReaderFactory()
      .addConstructor(FileReaderInputMethodClients.createInstance)
      .addConstructor(FileReaderInputMethodManagerService.createInstance)
      .addConstructor(FileReaderInputMethodService.createInstance)
      .addConstructor(FileReaderProtoLog.createInstance)
      .addConstructor(FileReaderSurfaceFlinger.createInstance)
      .addConstructor(FileReaderTransactions.createInstance)
      .addConstructor(FileReaderWindowManager.createInstance)
      .addConstructor(FileReaderWindowManagerDump.createInstance)
      .addConstructor(FileReaderTransitionsWm.createInstance)
      .addConstructor(FileReaderTransitionsShell.createInstance)
      .addConstructor(FileReaderViewCapture.createInstance);
  }

  private createPerfettoParserFactory(): PerfettoParserFactory {
    return new PerfettoParserFactory()
      .addParser(ParserInputMethodClients.createInstance)
      .addParser(ParserInputMethodManagerService.createInstance)
      .addParser(ParserInputMethodService.createInstance)
      .addParser(ParserProtolog.createInstance)
      .addParser(ParserSurfaceFlinger.createInstance)
      .addParser(ParserTransactions.createInstance)
      .addParser(ParserTransitions.createInstance)
      .addParser(ParserViewCapture.createInstance)
      .addParser(ParserWindowManager.createInstance)
      .addParser(ParserMotionEvent.createInstance)
      .addParser(ParserKeyEvent.createInstance)
      .addParser(ParserCujs.createInstance);
  }
}

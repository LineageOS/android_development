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

import {decompressGZipFile, isGZipFile, isZipFile, unzipFile} from '@common/io';
import {TimezoneInfo} from '@common/time/time';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {Analytics} from '@logging/analytics';
import {ProgressListener} from '@messaging/progress_listener';
import {UserWarning} from '@messaging/user_warning';
import {
  makeWarningCorruptedArchive,
  makeWarningNoValidFiles,
  makeWarningUnsupportedFileFormat,
} from './warnings';

import {WinscopeEvent} from '@messaging/winscope_event';
import {
  EmitEvent,
  WinscopeEventEmitter,
} from '@messaging/winscope_event_emitter';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {LegacyFileReaderFactory} from '@app/legacy_file_reader_factory';
import {NonPerfettoParserFactory} from '@app/non_perfetto_parser_factory';

import {PerfettoParserFactory} from '@app/perfetto_parser_factory';
import {UserNotifier} from '@services/user_notifier';
import {TraceFile} from '@trace/trace_file';
import {TraceMetadata} from '@trace_api/trace_metadata';
import {TraceProcessorFactory} from '@trace_processor/trace_processor_factory';
import {FilesSource} from './files_source';
import {IdentifiedFiles, TraceFileIdentifier} from './trace_file_identifier';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {ProcessedFiles} from '@app/processed_files';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {assertDefined} from '@common/assert';
import {FileReaderAndParser} from './file_reader_and_parser';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

export interface FileLoaderResult {
  legacy: LegacyFileReader[];
  nonPerfetto: FileReaderAndParser[];
  perfetto: FileReaderAndParser[];
  lostPerfettoPackets: number;
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
        traceGeometryData: this.traceGeometryData,
        timezoneInfo: this.timezoneInfo,
        warnings: [],
      };
    }

    const {identifiedFiles, lostPerfettoPackets, warnings} =
      await this.loadUnzippedFiles(unzippedFiles, source, progressListener);

    return {
      legacy: identifiedFiles.legacy,
      lostPerfettoPackets,
      nonPerfetto: identifiedFiles.nonPerfetto,
      perfetto: identifiedFiles.perfetto,
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
      return {lostPerfettoPackets: 0, identifiedFiles, warnings};
    }
    const lostPerfettoPackets = await this.checkForLostPerfettoPackets();
    return {lostPerfettoPackets, identifiedFiles, warnings};
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
    const processed = await new LegacyFileReaderFactory().processFiles(
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
    const processedFile = await new PerfettoParserFactory().processFile(
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
}

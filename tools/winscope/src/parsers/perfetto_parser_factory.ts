/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {getLogger, Logger} from '@compat/logging';
import {Analytics} from '@logging/analytics';
import {ProgressListener} from '@messaging/progress_listener';
import {buildTraceGeometryData, TraceGeometryData,} from '@parsers/helpers/trace_geometry_data';
import {makeWarningInvalidPerfettoTrace} from '@parsers/helpers/warnings';
import {ParserConstructor} from '@parsers/perfetto/parser_constructor';
import {UserNotifier} from '@services/user_notifier';
import {TraceFile} from '@trace_api/trace_file';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {TraceProcessorFactory} from '@trace_processor/trace_processor_factory';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {FileReaderAndParser} from './file_reader_and_parser';

export interface ProcessedFile {
  parsers: Array<FileReaderAndParser<HierarchyTreeNode>>;
  isPerfettoTrace: boolean;
  traceGeometryData: TraceGeometryData;
}

export class PerfettoParserFactory {
  private static readonly CHUNK_SIZE_BYTES = 50 * 1024 * 1024;
  private static readonly NO_ENTRIES_ERROR_REGEX =
    /Perfetto trace has no \w+(\w|\s)* entries/;
  private readonly parserConstructors: ParserConstructor[] = [];

  constructor(private readonly logger: Logger = getLogger('ParserFactory')) {}

  addParser(parserConstructor: ParserConstructor): PerfettoParserFactory {
    this.parserConstructors.push(parserConstructor);
    return this;
  }

  async processFile(
    traceFile: TraceFile,
    timestampConverter: ParserTimestampConverter,
    progressListener?: ProgressListener,
  ): Promise<ProcessedFile> {
    const traceProcessor = await this.initializeTraceProcessor();
    try {
      await this.loadFileInTp(traceFile.file, traceProcessor, progressListener);
      await traceProcessor.notifyEof();
    } catch (e) {
      this.logger.error('Trace processor failed to parse data:', e);
      return {
        parsers: [],
        isPerfettoTrace: false,
        traceGeometryData: new TraceGeometryData(),
      };
    }

    progressListener?.onProgressUpdate(
      'Reading from trace processor...',
      undefined,
    );

    await this.processGeometryTables(traceProcessor);
    const traceGeometryData = await buildTraceGeometryData(traceProcessor);

    const parsers: Array<FileReaderAndParser<HierarchyTreeNode>> = [];
    let hasFoundParser = false;
    const errors: string[] = [];

    for (const parserConstructor of this.parserConstructors) {
      try {
        const parserInstances = await parserConstructor(
          traceFile,
          traceProcessor,
          timestampConverter,
          traceGeometryData,
        );
        for (const parser of parserInstances) {
          await parser.parse();
          parsers.push(parser);
          hasFoundParser = true;
        }
      } catch (error) {
        // skip current parser
        const msg = (error as Error).message;
        if (!PerfettoParserFactory.NO_ENTRIES_ERROR_REGEX.test(msg)) {
          // If TP contains no entries for a particular trace type, the resulting
          // error message matches ParserFactory.NO_ENTRIES_ERROR_REGEX. These
          // messages are discarded, and if no parser is found, one representative
          // message is reported to the user below.
          errors.push(msg);
        }
      }
    }

    if (!hasFoundParser) {
      if (errors.length === 0) {
        errors.push('Perfetto trace has no Winscope trace entries');
      }
    }
    if (errors.length > 0) {
      UserNotifier.add(
        makeWarningInvalidPerfettoTrace(traceFile.getDescriptor(), errors),
      );
    }
    return {parsers, isPerfettoTrace: true, traceGeometryData};
  }

  private async initializeTraceProcessor(): Promise<TraceProcessor> {
    const traceProcessor = TraceProcessorFactory.getSingleInstance();

    await traceProcessor.reset({
      cropTrackEvents: false,
      ingestFtraceInRawTable: false,
      analyzeTraceProtoContent: false,
      ftraceDropUntilAllCpusValid: false,
    });
    Analytics.Memory.logUsage('tp_initialized');

    return traceProcessor;
  }

  private async processGeometryTables(traceProcessor: TraceProcessor) {
    await traceProcessor.query('INCLUDE PERFETTO MODULE android.winscope.rect');
    await traceProcessor.query(`CREATE PERFETTO TABLE winscope_rect AS
      SELECT
        tr.id as trace_rect_id,
        tr.group_id,
        tr.depth,
        tr.is_spy,
        tr.is_visible,
        tr.opacity,
        tr.transform_id,
        rr.x,
        rr.y,
        rr.w,
        rr.h
      FROM android_winscope_trace_rect AS tr
      INNER JOIN android_winscope_rect AS rr
        ON tr.rect_id = rr.id`);
  }

  private async loadFileInTp(
    file: File,
    traceProcessor: TraceProcessor,
    progressListener?: ProgressListener,
  ) {
    for (
      let chunkStart = 0;
      chunkStart < file.size;
      chunkStart += PerfettoParserFactory.CHUNK_SIZE_BYTES
    ) {
      progressListener?.onProgressUpdate(
        'Loading perfetto trace...',
        (chunkStart / file.size) * 100,
      );
      const chunkEnd = chunkStart + PerfettoParserFactory.CHUNK_SIZE_BYTES;
      const data = await file.slice(chunkStart, chunkEnd).arrayBuffer();
      await traceProcessor.parse(new Uint8Array(data));
    }
  }
}

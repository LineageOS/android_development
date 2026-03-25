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

import {assertDefined, assertTrue} from '@common/assert';
import {isZipFile, unzipFile} from '@common/io';
import {getFixtureFile} from '@common/testing/io_helpers';
import {makeConverterNoRteOffsets, makeConverterWithUtcOffset,} from '@common/time/testing/test_helpers';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {ParserCujs as NonPerfettoParserCujs} from '@parsers/cujs/non_perfetto/parser_cujs';
import {ParserCujs} from '@parsers/cujs/perfetto/parser_cujs';
import {buildTraceGeometryData, TraceGeometryData,} from '@parsers/helpers/trace_geometry_data';
import {ParserInputMethodClients} from '@parsers/input_method/parser_input_method_clients';
import {ParserInputMethodManagerService} from '@parsers/input_method/parser_input_method_manager_service';
import {ParserInputMethodService} from '@parsers/input_method/parser_input_method_service';
import {ParserInput} from '@parsers/input/parser_input';
import {ParserKeyEvent} from '@parsers/input/parser_key_event';
import {ParserMotionEvent} from '@parsers/input/parser_motion_event';
import {ParserProtolog} from '@parsers/protolog/parser_protolog';
import {ParserScreenRecording} from '@parsers/screen_recording/parser_screen_recording';
import {ParserScreenRecordingLegacy} from '@parsers/screen_recording/parser_screen_recording_legacy';
import {ParserScreenshot} from '@parsers/screenshot/parser_screenshot';
import {ParserSurfaceFlinger} from '@parsers/surface_flinger/parser_surface_flinger';
import {ParserTransactions} from '@parsers/transactions/parser_transactions';
import {ParserTransitions} from '@parsers/transitions/parser_transitions';
import {ParserViewCapture} from '@parsers/view_capture/parser_view_capture';
import {ParserWindowManager} from '@parsers/window_manager/parser_window_manager';
import {FileReader} from '@trace_api/file_reader';
import {Parser} from '@trace_api/parser';
import {TraceFile} from '@trace_api/trace_file';
import {TraceMetadata} from '@trace_api/trace_metadata';
import {TraceType} from '@trace_api/trace_type';
import {TraceProcessorFactory} from '@trace_processor/trace_processor_factory';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

function getReaderWithLatestRealToBootTimeOffset(
  readers: FileReader[],
): FileReader | undefined {
  return readers
    .filter((reader) => reader.getRealToBootTimeOffsetNs() !== undefined)
    .sort((a, b) => {
      return Number(
        assertDefined(a.getRealToBootTimeOffsetNs()) -
          assertDefined(b.getRealToBootTimeOffsetNs()),
      );
    })
    .at(-1);
}

function getReaderWithLatestRealToMonotonicTimeOffset(
  readers: FileReader[],
): FileReader | undefined {
  return readers
    .filter((reader) => reader.getRealToMonotonicTimeOffsetNs() !== undefined)
    .sort((a, b) => {
      return Number(
        assertDefined(a.getRealToMonotonicTimeOffsetNs()) -
          assertDefined(b.getRealToMonotonicTimeOffsetNs()),
      );
    })
    .at(-1);
}

export function createTimestamps(
  fileReaders: FileReader[],
  initializeRealToElapsedTimeOffsetNs: boolean,
  converter: TimestampConverter,
) {
  if (initializeRealToElapsedTimeOffsetNs) {
    const monotonicOffset =
      getReaderWithLatestRealToMonotonicTimeOffset(
        fileReaders,
      )?.getRealToMonotonicTimeOffsetNs();
    if (monotonicOffset !== undefined) {
      converter.setRealToMonotonicTimeOffsetNs(monotonicOffset);
    }
    const boottimeOffset =
      getReaderWithLatestRealToBootTimeOffset(
        fileReaders,
      )?.getRealToBootTimeOffsetNs();
    if (boottimeOffset !== undefined) {
      converter.setRealToBootTimeOffsetNs(boottimeOffset);
    }
  }
  fileReaders.forEach((fileReader) => {
    expect(fileReader.getTimestamps).toThrow();
    fileReader.createTimestamps();
    expect(fileReader.getTimestamps().length).toBeGreaterThan(0);
  });
}

export abstract class ProcessedFileProvider<T extends FileReader> {
  protected timestampConverter = makeConverterNoRteOffsets();
  private files: Array<{src: string; dst?: string}> = [];
  private initializeRealToElapsedTimeOffsetNs = true;

  addFile(src: string, dst?: string) {
    this.files.push({src, dst});
    return this;
  }

  setTimestampConverter(value: TimestampConverter) {
    this.timestampConverter = value;
    return this;
  }

  setInitializeRealToElapsedTimeOffsetNs(value: boolean) {
    this.initializeRealToElapsedTimeOffsetNs = value;
    return this;
  }

  async get(): Promise<T> {
    const allProcessedFiles = await this.getAll();
    assertTrue(
      allProcessedFiles.length > 0,
      () =>
        `Should have been able to process ${this.files
          .map((f) => f.src)
          .join(', ')}`,
    );
    return allProcessedFiles[0];
  }

  async getAll(): Promise<T[]> {
    const files = [];
    for (const fixture of this.files) {
      const file = new TraceFile(
        await getFixtureFile(fixture.src, fixture.dst),
        undefined,
      );
      files.push(file);
    }
    const processedFiles = await this.processFiles(files);
    createTimestamps(
      processedFiles,
      this.initializeRealToElapsedTimeOffsetNs,
      this.timestampConverter,
    );
    return processedFiles;
  }

  protected abstract processFiles(files: TraceFile[]): Promise<T[]>;
}

export class NonPerfettoParserProvider extends ProcessedFileProvider<
  Parser<unknown> & FileReader
> {
  private metadata: TraceMetadata = {};
  private static readonly PARSERS = [
    ParserScreenshot,
    NonPerfettoParserCujs,
    ParserScreenRecording,
    ParserScreenRecordingLegacy,
  ];

  setMetadata(value: TraceMetadata) {
    this.metadata = value;
    return this;
  }

  protected override async processFiles(
    files: TraceFile[],
  ): Promise<Array<Parser<unknown> & FileReader>> {
    const supportedFiles: Array<Parser<unknown> & FileReader> = [];
    for (const traceFile of files) {
      let hasFoundParser = false;
      for (const ParserType of NonPerfettoParserProvider.PARSERS) {
        try {
          const parser = new ParserType(
            traceFile,
            this.timestampConverter,
            this.metadata,
          );
          await parser.parse();
          hasFoundParser = true;
          assertTrue(parser.getLengthEntries() > 0, () => 'Trace is empty');
          supportedFiles.push(parser);
          break;
        } catch {
          if (hasFoundParser) break;
        }
      }
    }
    return supportedFiles;
  }
}

const PERFETTO_PARSERS = [
  ParserInputMethodClients,
  ParserInputMethodManagerService,
  ParserInputMethodService,
  ParserProtolog,
  ParserSurfaceFlinger,
  ParserTransactions,
  ParserTransitions,
  ParserViewCapture,
  ParserWindowManager,
  ParserMotionEvent,
  ParserKeyEvent,
  ParserCujs,
];

export async function getPerfettoParser(
  traceType: TraceType,
  fixturePath: string,
  withUTCOffset = false,
  unzippedFileName: string = '',
): Promise<{
  parser: Parser<HierarchyTreeNode>;
  traceGeometryData: TraceGeometryData;
}> {
  const {parsers, traceGeometryData} = await getPerfettoParsers(
    fixturePath,
    withUTCOffset,
    unzippedFileName,
  );
  const parser = assertDefined(
    parsers.find((parser) => parser.getTraceType() === traceType),
  );
  return {parser, traceGeometryData};
}

export async function getPerfettoParsers(
  fixturePath: string,
  withUTCOffset = false,
  unzippedFileName: string = '',
): Promise<{
  parsers: Array<Parser<HierarchyTreeNode> & FileReader>;
  traceGeometryData: TraceGeometryData;
}> {
  let file = await getFixtureFile(fixturePath);
  if (await isZipFile(file)) {
    const subFiles = await unzipFile(file);
    file = assertDefined(subFiles.find((f) => f.name === unzippedFileName));
  }
  const traceFile = new TraceFile(file);
  const converter = withUTCOffset
    ? await makeConverterWithUtcOffset()
    : makeConverterNoRteOffsets();

  const traceProcessor = TraceProcessorFactory.getSingleInstance();
  await traceProcessor.reset({
    cropTrackEvents: false,
    ingestFtraceInRawTable: false,
    analyzeTraceProtoContent: false,
    ftraceDropUntilAllCpusValid: false,
  });

  const CHUNK_SIZE_BYTES = 50 * 1024 * 1024;
  for (
    let chunkStart = 0;
    chunkStart < file.size;
    chunkStart += CHUNK_SIZE_BYTES
  ) {
    const chunkEnd = chunkStart + CHUNK_SIZE_BYTES;
    const data = await file.slice(chunkStart, chunkEnd).arrayBuffer();
    await traceProcessor.parse(new Uint8Array(data));
  }
  await traceProcessor.notifyEof();

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

  const traceGeometryData = await buildTraceGeometryData(traceProcessor);

  const parsers: Array<Parser<HierarchyTreeNode> & FileReader> = [];
  for (const ParserType of PERFETTO_PARSERS) {
    try {
      const parser = new ParserType(
        traceFile,
        traceProcessor,
        converter,
        traceGeometryData,
      );
      await parser.parse();
      if (parser instanceof ParserViewCapture) {
        parsers.push(...parser.getWindowParsers());
      } else {
        parsers.push(parser);
      }
    } catch {
      // skip
    }
  }

  createTimestamps(parsers, true, converter);
  return {parsers, traceGeometryData};
}

export async function getParserInput(filename: string): Promise<ParserInput> {
  const {parsers} = await getPerfettoParsers(filename);
  const parserKey = parsers.find(
    (p) => p.getTraceType() === TraceType.INPUT_KEY_EVENT,
  );
  const parserMotion = parsers.find(
    (p) => p.getTraceType() === TraceType.INPUT_MOTION_EVENT,
  );
  const mergedParser = new ParserInput(
    parserKey,
    parserMotion,
    parserKey?.getFiles() ?? assertDefined(parserMotion?.getFiles()),
  );
  await mergedParser.parse();
  return mergedParser;
}

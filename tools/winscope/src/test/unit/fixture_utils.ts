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

import {assertDefined, assertTrue} from '@common/assert';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {getFixtureFile} from '@test/unit/io_helpers';
import {getTimestampConverter} from '@test/unit/time_test_helpers';
import {TraceFile} from '@trace/trace_file';
import {Parser} from '@trace_api/parser';
import {Trace} from '@trace_api/trace';
import {TraceMetadata} from '@trace_api/trace_metadata';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {TraceBuilder} from './trace_builder';
import {LegacyFileReaderFactory} from '@app/legacy_file_reader_factory';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {NonPerfettoParserFactory} from '@app/non_perfetto_parser_factory';
import {LegacyToPerfettoConverter} from '@app/legacy_to_perfetto_converter';
import {PerfettoParserFactory} from '@app/perfetto_parser_factory';
import {FileReader} from '@trace_api/file_reader';
import {
  getReaderWithLatestRealToBootTimeOffset,
  getReaderWithLatestRealToMonotonicTimeOffset,
} from '@app/file_reader_helpers';
import {ParserInput} from '@parsers/input/parser_input';

abstract class ProcessedFileProvider<T extends FileReader> {
  protected timestampConverter = getTimestampConverter();
  private files: Array<{src: string; dst?: string}> = [];
  private initializeRealToElapsedTimeOffsetNs = true;

  /**
   * @param src Path to the trace file in the test fixtures.
   * @param dst An optional destination file name.
   */
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

/**
 * Provides a file reader for a legacy trace file from the test fixtures.
 */
export class LegacyFileReaderProvider extends ProcessedFileProvider<LegacyFileReader> {
  /**
   * @return The file readers for the specified trace files.
   */
  protected override async processFiles(
    files: TraceFile[],
  ): Promise<LegacyFileReader[]> {
    const processedFiles = await new LegacyFileReaderFactory().processFiles(
      files,
      this.timestampConverter,
    );
    return processedFiles.supportedFiles;
  }
}

/**
 * Provides a parser for a non-perfetto trace file from the test fixtures.
 */
export class NonPerfettoParserProvider extends ProcessedFileProvider<
  Parser<unknown> & FileReader
> {
  private metadata: TraceMetadata = {};

  setMetadata(value: TraceMetadata) {
    this.metadata = value;
    return this;
  }

  /**
   * @return The parsers for the specified trace files.
   */
  protected override async processFiles(
    files: TraceFile[],
  ): Promise<Array<Parser<unknown> & FileReader>> {
    const processedFiles = await new NonPerfettoParserFactory().processFiles(
      files,
      this.timestampConverter,
      this.metadata,
    );
    return processedFiles.supportedFiles;
  }
}

/**
 * Parses and converts legacy traces to a single Perfetto trace.
 *
 * @param fileName The file name of the legacy trace to convert.
 * @param timestampConverter The timestamp converter to use.
 * @param existingPerfettoFile An optional existing Perfetto file to merge with.
 * @return The converted Perfetto trace.
 */
export async function parseAndConvertToPerfettoTrace(
  fileName: string,
  existingPerfettoFile?: TraceFile,
): Promise<Parser<HierarchyTreeNode>> {
  const fileReader = await new LegacyFileReaderProvider()
    .addFile(fileName)
    .get();
  const parsers = await convertToPerfettoTrace(
    [fileReader],
    getTimestampConverter(),
    existingPerfettoFile,
  );
  return parsers[0];
}

/**
 * Converts legacy traces to a single Perfetto trace.
 *
 * @param fileReaders The legacy file readers to convert.
 * @param timestampConverter The timestamp converter to use.
 * @param existingPerfettoFile An optional existing Perfetto file to merge with.
 * @return The converted Perfetto trace.
 */
export async function convertToPerfettoTrace(
  fileReaders: LegacyFileReader[],
  timestampConverter: TimestampConverter,
  existingPerfettoFile?: TraceFile,
): Promise<Array<Parser<HierarchyTreeNode>>> {
  const converter = new LegacyToPerfettoConverter()
    .setLegacyFileReaders(fileReaders)
    .setAllFileReaders(fileReaders);
  if (existingPerfettoFile) {
    converter.setPerfettoFile(existingPerfettoFile);
  }
  const perfettoTrace = assertDefined(await converter.convert());
  const processed = await new PerfettoParserFactory().processFile(
    perfettoTrace,
    timestampConverter,
  );
  createTimestamps(processed.parsers, true, timestampConverter);
  return processed.parsers;
}

/**
 * @param type The type of the trace to get.
 * @param filename The name of the trace file in the test fixtures.
 * @return The trace.
 */
export async function getTrace<T extends TraceType>(
  type: T,
  filename: string,
): Promise<Trace<T>> {
  const converter = getTimestampConverter(false);
  const nonPerfettoParsers = await new NonPerfettoParserProvider()
    .addFile(filename)
    .setTimestampConverter(converter)
    .getAll();
  expect(nonPerfettoParsers.length).toBeLessThanOrEqual(1);
  if (nonPerfettoParsers.length === 1) {
    expect(nonPerfettoParsers[0].getTraceType()).toEqual(type);
    return new TraceBuilder<T>()
      .setType(type)
      .setParser(nonPerfettoParsers[0] as unknown as Parser<T>)
      .build();
  }

  const perfettoParsers = await getPerfettoParsers(filename);
  expect(perfettoParsers.length).toBe(1);
  expect(perfettoParsers[0].getTraceType()).toEqual(type);
  return new TraceBuilder<T>()
    .setType(type)
    .setParser(perfettoParsers[0] as unknown as Parser<T>)
    .build();
}

function createTimestamps(
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

/**
 * @param traceType The type of the trace to get.
 * @param fixturePath The path to the trace file in the test fixtures.
 * @param withUTCOffset Whether to include the UTC offset in the timestamp converter.
 * @return The parser for the specified trace file.
 */
export async function getPerfettoParser(
  traceType: TraceType,
  fixturePath: string,
  withUTCOffset = false,
): Promise<Parser<HierarchyTreeNode>> {
  const parsers = await getPerfettoParsers(fixturePath, withUTCOffset);
  const parser = assertDefined(
    parsers.find((parser) => parser.getTraceType() === traceType),
  );
  return parser;
}

/**
 * @param fixturePath The path to the trace file in the test fixtures.
 * @param withUTCOffset Whether to include the UTC offset in the timestamp converter.
 * @param isPerfetto Whether the trace file is a Perfetto trace.
 * @return The parsers for the specified trace file.
 */
export async function getPerfettoParsers(
  fixturePath: string,
  withUTCOffset = false,
  isPerfetto?: boolean,
): Promise<Array<Parser<HierarchyTreeNode> & FileReader>> {
  const file = await getFixtureFile(fixturePath);
  const traceFile = new TraceFile(file);
  const converter = getTimestampConverter(withUTCOffset);
  const {parsers, isPerfettoTrace} =
    await new PerfettoParserFactory().processFile(
      traceFile,
      converter,
      undefined,
    );
  if (isPerfetto !== undefined) {
    expect(isPerfettoTrace).toEqual(isPerfetto);
  }
  createTimestamps(parsers, true, converter);
  return parsers;
}
/**
 * @return The IME trace entries.
 */
export async function getImeTraceEntries(): Promise<
  [Map<TraceType, HierarchyTreeNode>, Map<TraceType, HierarchyTreeNode>]
> {
  const fileReaders = await new LegacyFileReaderProvider()
    .addFile('traces/ime/SurfaceFlinger_with_IME.pb')
    .addFile('traces/ime/InputMethodService.pb')
    .addFile('traces/ime/InputMethodManagerService.pb')
    .addFile('traces/ime/InputMethodClients.pb')
    .addFile('traces/ime/WindowManager_with_IME.pb')
    .getAll();

  const [
    clientsParser,
    managerServiceParser,
    serviceParser,
    sfParser,
    wmParser,
  ] = await convertToPerfettoTrace(fileReaders, getTimestampConverter());

  const surfaceFlingerEntry = await sfParser.getEntry(5);
  const imServiceEntry = await serviceParser.getEntry(0);
  const imManagerServiceEntry = await managerServiceParser.getEntry(0);
  const clientsEntry0 = await clientsParser.getEntry(0);
  const clientsEntry1 = await clientsParser.getEntry(1);
  const windowManagerEntry = await wmParser.getEntry(2);

  const entries = new Map<TraceType, HierarchyTreeNode>();
  entries.set(TraceType.INPUT_METHOD_CLIENTS, clientsEntry0);
  entries.set(TraceType.INPUT_METHOD_MANAGER_SERVICE, imManagerServiceEntry);
  entries.set(TraceType.INPUT_METHOD_SERVICE, imServiceEntry);
  entries.set(TraceType.SURFACE_FLINGER, surfaceFlingerEntry);
  entries.set(TraceType.WINDOW_MANAGER, windowManagerEntry);

  const secondEntries = new Map<TraceType, HierarchyTreeNode>();
  secondEntries.set(TraceType.INPUT_METHOD_CLIENTS, clientsEntry1);
  secondEntries.set(TraceType.SURFACE_FLINGER, surfaceFlingerEntry);
  secondEntries.set(TraceType.WINDOW_MANAGER, windowManagerEntry);

  return [entries, secondEntries];
}

export async function getParserInput(filename: string): Promise<ParserInput> {
  const parsers = await getPerfettoParsers(filename);
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

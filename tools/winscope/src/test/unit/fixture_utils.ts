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

import {assertDefined, assertTrue} from 'common/assert';
import {TimestampConverter} from 'common/time/timestamp_converter';
import {FileAndParser} from 'parsers/file_and_parser';
import {ParserFactory as LegacyParserFactory} from 'parsers/legacy/parser_factory';
import {LegacyToPerfettoConverter} from 'parsers/legacy_to_perfetto_converter';
import {
  getParserWithLatestRealToBootTimeOffset,
  getParserWithLatestRealToMonotonicTimeOffset,
} from 'parsers/parser_time_utils';
import {ParserFactory as PerfettoParserFactory} from 'parsers/perfetto/parser_factory';
import {TracesParserFactory} from 'parsers/traces/traces_parser_factory';
import {getFixtureFile} from 'test/unit/io_helpers';
import {getTimestampConverter} from 'test/unit/time_test_helpers';
import {TraceFile} from 'trace/trace_file';
import {Parser} from 'trace_api/parser';
import {Trace} from 'trace_api/trace';
import {TraceMetadata} from 'trace_api/trace_metadata';
import {TraceEntryTypeMap, TraceType} from 'trace_api/trace_type';
import {Traces} from 'trace_api/traces';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {TraceBuilder} from './trace_builder';

/**
 * Provides a parser for a trace file from the test fixtures.
 */
export class LegacyParserProvider {
  private files: Array<{src: string; dst?: string}> = [];
  private timestampConverter = getTimestampConverter();
  private initializeRealToElapsedTimeOffsetNs = true;
  private metadata: TraceMetadata = {};
  private convertToPerfetto = false;
  private existingPerfettoFile: TraceFile | undefined;

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

  setMetadata(value: TraceMetadata) {
    this.metadata = value;
    return this;
  }

  setConvertToPerfetto(value: boolean) {
    this.convertToPerfetto = value;
    return this;
  }

  setExistingPerfettoFile(value: TraceFile) {
    this.existingPerfettoFile = value;
    return this;
  }

  /**
   * @return The parser for the specified trace file.
   */
  async getParser<T>(): Promise<Parser<T>> {
    const parsers = await this.getParsers();

    expect(parsers.length)
      .withContext(
        `Should have been able to create a parser for ${this.files
          .map((f) => f.src)
          .join(', ')}`,
      )
      .toBeGreaterThanOrEqual(1);

    return parsers[0] as Parser<T>;
  }

  /**
   * @return The parsers for the specified trace files.
   */
  async getParsers(): Promise<Array<Parser<object>>> {
    const files = [];
    for (const fixture of this.files) {
      const file = new TraceFile(
        await getFixtureFile(fixture.src, fixture.dst),
        undefined,
      );
      files.push(file);
    }
    const processedFiles = await new LegacyParserFactory().processFiles(
      files,
      this.timestampConverter,
      this.metadata,
    );

    createTimestamps(
      processedFiles.parsers,
      this.initializeRealToElapsedTimeOffsetNs,
      this.timestampConverter,
    );

    const fileAndParsers = this.convertToPerfetto
      ? await convertToPerfettoTrace(
          processedFiles.parsers,
          this.timestampConverter,
          this.existingPerfettoFile,
        )
      : processedFiles.parsers;

    if (this.convertToPerfetto) {
      this.timestampConverter.clear();
      createTimestamps(
        fileAndParsers,
        this.initializeRealToElapsedTimeOffsetNs,
        this.timestampConverter,
      );
    }

    return fileAndParsers.map((fileAndParser) => {
      return fileAndParser.parser;
    });
  }
}

/**
 * Converts legacy traces to a single Perfetto trace.
 *
 * @param fileAndParsers The legacy traces to convert.
 * @param timestampConverter The timestamp converter to use.
 * @param existingPerfettoFile An optional existing Perfetto file to merge with.
 * @return The converted Perfetto trace.
 */
export async function convertToPerfettoTrace(
  fileAndParsers: FileAndParser[],
  timestampConverter: TimestampConverter,
  existingPerfettoFile?: TraceFile,
): Promise<FileAndParser[]> {
  const parsers = fileAndParsers.map((p) => p.parser);
  const perfettoTrace =
    await LegacyToPerfettoConverter.convertToSinglePerfettoFile(
      parsers,
      parsers,
      existingPerfettoFile,
    );
  if (perfettoTrace) {
    const processed = await new PerfettoParserFactory().processFile(
      perfettoTrace,
      timestampConverter,
    );
    fileAndParsers = processed.parsers.map((parser) => {
      return new FileAndParser(perfettoTrace, parser);
    });
  }
  return fileAndParsers;
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
  const legacyParsers = await new LegacyParserProvider()
    .addFile(filename)
    .setTimestampConverter(converter)
    .getParsers();
  expect(legacyParsers.length).toBeLessThanOrEqual(1);
  if (legacyParsers.length === 1) {
    expect(legacyParsers[0].getTraceType()).toEqual(type);
    return new TraceBuilder<T>()
      .setType(type)
      .setParser(legacyParsers[0] as unknown as Parser<T>)
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
  fileAndParsers: FileAndParser[],
  initializeRealToElapsedTimeOffsetNs: boolean,
  converter: TimestampConverter,
) {
  if (initializeRealToElapsedTimeOffsetNs) {
    const monotonicOffset = getParserWithLatestRealToMonotonicTimeOffset(
      fileAndParsers.map((fileAndParser) => fileAndParser.parser),
    )?.getRealToMonotonicTimeOffsetNs();
    if (monotonicOffset !== undefined) {
      converter.setRealToMonotonicTimeOffsetNs(monotonicOffset);
    }
    const boottimeOffset = getParserWithLatestRealToBootTimeOffset(
      fileAndParsers.map((fileAndParser) => fileAndParser.parser),
    )?.getRealToBootTimeOffsetNs();
    if (boottimeOffset !== undefined) {
      converter.setRealToBootTimeOffsetNs(boottimeOffset);
    }
  }
  fileAndParsers.forEach((fileAndParser) => {
    fileAndParser.parser.createTimestamps();
  });
}

/**
 * @param traceType The type of the trace to get.
 * @param fixturePath The path to the trace file in the test fixtures.
 * @param withUTCOffset Whether to include the UTC offset in the timestamp converter.
 * @return The parser for the specified trace file.
 */
export async function getPerfettoParser<T extends TraceType>(
  traceType: T,
  fixturePath: string,
  withUTCOffset = false,
): Promise<Parser<TraceEntryTypeMap[T]>> {
  const parsers = await getPerfettoParsers(fixturePath, withUTCOffset);
  const parser = assertDefined(
    parsers.find((parser) => parser.getTraceType() === traceType),
  );
  return parser as Parser<TraceEntryTypeMap[T]>;
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
): Promise<Array<Parser<object>>> {
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
  createTimestamps(
    parsers.map((parser) => {
      return new FileAndParser(traceFile, parser);
    }),
    true,
    converter,
  );
  return parsers;
}

/**
 * @param filenames The names of the trace files in the test fixtures.
 * @param withUTCOffset Whether to include the UTC offset in the timestamp converter.
 * @return The traces parser and its constituent parsers.
 */
export async function getTracesParser(
  filenames: string[],
  withUTCOffset = false,
): Promise<{
  tracesParser: Parser<object>;
  constituentParsers: Array<Parser<object>>;
}> {
  const converter = getTimestampConverter(withUTCOffset);
  const provider = new LegacyParserProvider();
  filenames.forEach((filename) => provider.addFile(filename));
  const legacyParsers = await provider
    .setTimestampConverter(converter)
    .setInitializeRealToElapsedTimeOffsetNs(true)
    .getParsers();

  const perfettoParsers = (
    await Promise.all(
      filenames.map(async (filename) => getPerfettoParsers(filename)),
    )
  ).reduce((acc, cur) => acc.concat(cur), []);

  const parsersArray = legacyParsers.concat(perfettoParsers);

  const offset =
    getParserWithLatestRealToBootTimeOffset(
      parsersArray,
    )?.getRealToBootTimeOffsetNs();
  if (offset !== undefined) {
    converter.setRealToBootTimeOffsetNs(offset);
  }

  const traces = new Traces();
  parsersArray.forEach((parser) => {
    const trace = Trace.fromParser(parser);
    traces.addTrace(trace);
  });

  const tracesParsers = await new TracesParserFactory().createParsers(
    traces,
    converter,
  );
  assertTrue(
    tracesParsers.length === 1,
    () =>
      `Should have been able to create a traces parser for [${filenames.join()}]`,
  );
  return {tracesParser: tracesParsers[0], constituentParsers: parsersArray};
}

/**
 * @param index The index of the entry to get.
 * @return The WindowManager state at the specified index.
 */
export async function getWindowManagerState(
  index = 0,
): Promise<HierarchyTreeNode> {
  return getTraceEntry(
    'traces/elapsed_and_real_timestamp/WindowManager.pb',
    index,
  );
}

/**
 * @return The IME trace entries.
 */
export async function getImeTraceEntries(): Promise<
  [Map<TraceType, HierarchyTreeNode>, Map<TraceType, HierarchyTreeNode>]
> {
  const [clientsParser, managerServiceParser, serviceParser, sfParser] =
    (await new LegacyParserProvider()
      .addFile('traces/ime/SurfaceFlinger_with_IME.pb')
      .addFile('traces/ime/InputMethodService.pb')
      .addFile('traces/ime/InputMethodManagerService.pb')
      .addFile('traces/ime/InputMethodClients.pb')
      .setConvertToPerfetto(true)
      .getParsers()) as Array<Parser<HierarchyTreeNode>>;

  const surfaceFlingerEntry = await sfParser.getEntry(5);
  const imServiceEntry = await serviceParser.getEntry(0);
  const imManagerServiceEntry = await managerServiceParser.getEntry(0);
  const clientsEntry0 = await clientsParser.getEntry(0);
  const clientsEntry1 = await clientsParser.getEntry(1);

  const windowManagerEntry = await getTraceEntry<HierarchyTreeNode>(
    'traces/ime/WindowManager_with_IME.pb',
    2,
  );

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

async function getTraceEntry<T>(filename: string, index = 0) {
  const parser = await new LegacyParserProvider()
    .addFile(filename)
    .getParser<T>();
  return parser.getEntry(index);
}

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
import {LegacyToPerfettoConverter} from '@app/legacy_to_perfetto_converter';
import {PerfettoParserFactory} from '@app/perfetto_parser_factory';
import {assertDefined} from '@common/assert';
import {makeConverterNoRteOffsets} from '@common/time/test_helpers';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {FileReaderConstructor} from '@legacy_file_readers/common/file_reader_constructor';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {LegacyFileReaderFactory} from '@legacy_file_readers/common/legacy_file_reader_factory';
import {createTimestamps, ProcessedFileProvider,} from '@test/unit/parsers/fixture_utils';
import {Parser} from '@trace_api/parser';
import {TraceFile} from '@trace_api/trace_file';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

/**
 * Provides a file reader for a legacy trace file from the test fixtures.
 */
export class LegacyFileReaderProvider extends ProcessedFileProvider<LegacyFileReader> {
  constructor(private readonly constructors: FileReaderConstructor[]) {
    super();
  }

  /**
   * @return The file readers for the specified trace files.
   */
  protected override async processFiles(
    files: TraceFile[],
  ): Promise<LegacyFileReader[]> {
    const factory = new LegacyFileReaderFactory();
    for (const constructor of this.constructors) {
      factory.addConstructor(constructor);
    }
    const processedFiles = await factory.processFiles(
      files,
      this.timestampConverter,
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
  constructors: FileReaderConstructor[],
  existingPerfettoFile?: TraceFile,
): Promise<Parser<HierarchyTreeNode>> {
  const fileReader = await new LegacyFileReaderProvider(constructors)
    .addFile(fileName)
    .get();
  const parsers = await convertToPerfettoTrace(
    [fileReader],
    makeConverterNoRteOffsets(),
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

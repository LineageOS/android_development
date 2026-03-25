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
import {makeConverterNoRteOffsets} from '@common/time/testing/test_helpers';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {FileReaderConstructor} from '@legacy_file_readers/common/file_reader_constructor';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {LegacyFileReaderFactory} from '@legacy_file_readers/common/legacy_file_reader_factory';
import {LegacyToPerfettoConverter} from '@legacy_file_readers/common/legacy_to_perfetto_converter';
import {ParserCujs} from '@parsers/cujs/perfetto/parser_cujs';
import {createTimestamps, ProcessedFileProvider} from '@parsers/fixture_utils';
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
  const processed = await createPerfettoParserFactory().processFile(
    perfettoTrace,
    timestampConverter,
  );
  createTimestamps(processed.parsers, true, timestampConverter);
  return processed.parsers;
}

function createPerfettoParserFactory(): PerfettoParserFactory {
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

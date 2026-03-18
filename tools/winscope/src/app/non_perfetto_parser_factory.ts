/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {assertTrue} from '@common/assert';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {ProcessedFiles} from '@legacy_file_readers/common/processed_files';
import {ProgressListener} from '@messaging/progress_listener';
import {ParserCujs} from '@parsers/cujs/non_perfetto/parser_cujs';
import {FileReaderAndParser} from '@parsers/file_reader_and_parser';
import {makeWarningInvalidNonPerfettoTrace} from '@parsers/helpers/warnings';
import {ParserScreenRecording} from '@parsers/screen_recording/parser_screen_recording';
import {ParserScreenRecordingLegacy} from '@parsers/screen_recording/parser_screen_recording_legacy';
import {ParserScreenshot} from '@parsers/screenshot/parser_screenshot';
import {UserNotifier} from '@services/user_notifier';
import {TraceFile} from '@trace_api/trace_file';
import {TraceMetadata} from '@trace_api/trace_metadata';

export class NonPerfettoParserFactory {
  static readonly PARSERS = [
    ParserScreenshot,
    ParserCujs,
    ParserScreenRecording,
    ParserScreenRecordingLegacy,
  ];

  async processFiles(
    traceFiles: TraceFile[],
    timestampConverter: ParserTimestampConverter,
    metadata: TraceMetadata,
    progressListener?: ProgressListener,
  ): Promise<ProcessedFiles<FileReaderAndParser>> {
    const supportedFiles: FileReaderAndParser[] = [];
    const unsupportedFiles: TraceFile[] = [];

    for (const [index, traceFile] of traceFiles.entries()) {
      progressListener?.onProgressUpdate(
        'Parsing non-proto files',
        (index / traceFiles.length) * 100,
      );

      let hasFoundParser = false;

      for (const ParserType of NonPerfettoParserFactory.PARSERS) {
        try {
          const parser = new ParserType(
            traceFile,
            timestampConverter,
            metadata,
          );
          await parser.parse();
          hasFoundParser = true;
          assertTrue(parser.getLengthEntries() > 0, () => 'Trace is empty');
          supportedFiles.push(parser);
          break;
        } catch (error) {
          if (hasFoundParser) {
            UserNotifier.add(
              makeWarningInvalidNonPerfettoTrace(
                [traceFile.getDescriptor()],
                (error as Error).message,
              ),
            );
            break;
          }
          // skip current parser
        }
      }

      if (!hasFoundParser) {
        unsupportedFiles.push(traceFile);
      }
    }
    return {supportedFiles, unsupportedFiles};
  }
}

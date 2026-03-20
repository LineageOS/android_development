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
import {ProgressListener} from '@messaging/progress_listener';
import {makeWarningInvalidLegacyTrace} from '@parsers/helpers/warnings';
import {UserNotifier} from '@services/user_notifier';
import {TraceFile} from '@trace_api/trace_file';

import {FileReaderConstructor} from './file_reader_constructor';
import {LegacyFileReader} from './legacy_file_reader';
import {ProcessedFiles} from './processed_files';

/**
 * Factory for creating legacy file readers.
 * Used by {@link FileLoader} to instantiate readers capable of parsing a specific {@link TraceFile}.
 */
export class LegacyFileReaderFactory {
  private readonly constructors: FileReaderConstructor[] = [];

  addConstructor(ctor: FileReaderConstructor) {
    this.constructors.push(ctor);
    return this;
  }

  async processFiles(
    traceFiles: TraceFile[],
    timestampConverter: ParserTimestampConverter,
    progressListener?: ProgressListener,
  ): Promise<ProcessedFiles<LegacyFileReader>> {
    const supportedFiles: LegacyFileReader[] = [];
    const unsupportedFiles: TraceFile[] = [];

    for (const [index, traceFile] of traceFiles.entries()) {
      progressListener?.onProgressUpdate(
        'Parsing proto files',
        (index / traceFiles.length) * 100,
      );

      let hasFoundFileReader = false;

      for (const constructor of this.constructors) {
        try {
          const fileReaders = await constructor(traceFile, timestampConverter);
          hasFoundFileReader = true;
          for (const fileReader of fileReaders) {
            assertTrue(
              fileReader.getLengthEntries() > 0,
              () => 'Trace is empty',
            );
            supportedFiles.push(fileReader);
          }
          break;
        } catch (error) {
          if (hasFoundFileReader) {
            UserNotifier.add(
              makeWarningInvalidLegacyTrace(
                [traceFile.getDescriptor()],
                (error as Error).message,
              ),
            );
            break;
          }
          // skip current file reader
        }
      }

      if (!hasFoundFileReader) {
        unsupportedFiles.push(traceFile);
      }
    }
    return {supportedFiles, unsupportedFiles};
  }
}

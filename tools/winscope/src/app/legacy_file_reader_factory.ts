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
import {UserNotifier} from '@services/user_notifier';
import {TraceFile} from '@trace/trace_file';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {ProcessedFiles} from '@app/processed_files';

export class LegacyFileReaderFactory {
  static readonly READERS = [
    FileReaderInputMethodClients,
    FileReaderInputMethodManagerService,
    FileReaderInputMethodService,
    FileReaderProtoLog,
    FileReaderSurfaceFlinger,
    FileReaderTransactions,
    FileReaderWindowManager,
    FileReaderWindowManagerDump,
    FileReaderTransitionsWm,
    FileReaderTransitionsShell,
    FileReaderViewCapture,
  ];

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

      for (const FileReaderType of LegacyFileReaderFactory.READERS) {
        try {
          const fileReader = new FileReaderType(traceFile, timestampConverter);
          await fileReader.read();
          hasFoundFileReader = true;

          if (fileReader instanceof FileReaderViewCapture) {
            fileReader.getWindowParsers().forEach((subReader) => {
              assertTrue(
                subReader.getLengthEntries() > 0,
                () => 'Trace is empty',
              );
              supportedFiles.push(subReader);
            });
          } else {
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

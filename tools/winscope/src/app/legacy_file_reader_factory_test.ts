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
import {LegacyFileReaderFactory} from '@app/legacy_file_reader_factory';
import {getFixtureFile} from '@test/unit/common/io_helpers';
import {UTC_CONVERTER} from '@common/time/test_helpers';
import {TraceFile} from '@trace/trace_file';
import {TraceType} from '@trace_api/trace_type';

describe('LegacyFileReaderFactory', () => {
  describe('is robust to', () => {
    it('empty trace file', async () => {
      await checkRobustToFile('invalid_files/empty.pb', true);
    });

    it('trace with no entries', async () => {
      await checkRobustToFile('invalid_files/no_entries_InputMethodClients.pb');
    });

    it('view capture trace with no entries', async () => {
      await checkRobustToFile('invalid_files/no_entries_view_capture.vc');
    });

    async function checkRobustToFile(file: string, unsupported = false) {
      const trace = new TraceFile(await getFixtureFile(file), undefined);
      const processed = await new LegacyFileReaderFactory().processFiles(
        [trace],
        UTC_CONVERTER,
      );
      expect(processed.supportedFiles.length).toBe(0);
      expect(processed.unsupportedFiles).toEqual(unsupported ? [trace] : []);
    }
  });

  describe('creates', () => {
    let sfFile: TraceFile;
    let wmTransitionsFile: TraceFile;

    beforeAll(async () => {
      sfFile = new TraceFile(
        await getFixtureFile('traces/elapsed_timestamp/SurfaceFlinger.pb'),
      );
      wmTransitionsFile = new TraceFile(
        await getFixtureFile(
          'traces/elapsed_and_real_timestamp/wm_transition_trace.pb',
        ),
      );
    });

    it('InputMethodClients reader', async () => {
      await createsReaderForFile(
        'traces/elapsed_timestamp/InputMethodClients.pb',
        TraceType.INPUT_METHOD_CLIENTS,
      );
    });

    it('InputMethodManagerService reader', async () => {
      await createsReaderForFile(
        'traces/elapsed_timestamp/InputMethodManagerService.pb',
        TraceType.INPUT_METHOD_MANAGER_SERVICE,
      );
    });

    it('InputMethodService reader', async () => {
      await createsReaderForFile(
        'traces/elapsed_timestamp/InputMethodService.pb',
        TraceType.INPUT_METHOD_SERVICE,
      );
    });

    it('ProtoLog reader', async () => {
      await createsReaderForFile(
        'traces/elapsed_and_real_timestamp/ProtoLog32.pb',
        TraceType.PROTO_LOG,
      );
    });

    it('SurfaceFlinger reader', async () => {
      await processFiles([sfFile], [TraceType.SURFACE_FLINGER]);
    });

    it('Transactions reader', async () => {
      await createsReaderForFile(
        'traces/elapsed_timestamp/Transactions.pb',
        TraceType.TRANSACTIONS,
      );
    });

    it('WindowManager reader', async () => {
      await createsReaderForFile(
        'traces/elapsed_timestamp/WindowManager.pb',
        TraceType.WINDOW_MANAGER,
      );
    });

    it('WindowManager dump reader', async () => {
      await createsReaderForFile(
        'traces/elapsed_timestamp/dump_WindowManager.pb',
        TraceType.WINDOW_MANAGER,
      );
    });

    it('WM Transitions reader', async () => {
      await processFiles([wmTransitionsFile], [TraceType.WM_TRANSITION]);
    });

    it('Shell Transitions reader', async () => {
      await createsReaderForFile(
        'traces/elapsed_and_real_timestamp/shell_transition_trace.pb',
        TraceType.SHELL_TRANSITION,
      );
    });

    it('ViewCapture readers', async () => {
      const file = await getFixtureFile(
        'traces/elapsed_and_real_timestamp/com.google.android.apps.nexuslauncher_0.vc',
      );
      await processFiles(
        [new TraceFile(file)],
        [TraceType.VIEW_CAPTURE, TraceType.VIEW_CAPTURE],
      );
    });

    it('multiple readers of different types', async () => {
      await processFiles(
        [wmTransitionsFile, sfFile],
        [TraceType.WM_TRANSITION, TraceType.SURFACE_FLINGER],
      );
    });

    async function createsReaderForFile(filepath: string, type: TraceType) {
      const file = new TraceFile(await getFixtureFile(filepath));
      await processFiles([file], [type]);
    }

    async function processFiles(
      files: TraceFile[],
      types: TraceType[],
      unsupportedFiles: TraceFile[] = [],
    ) {
      const processedFiles = await new LegacyFileReaderFactory().processFiles(
        files,
        UTC_CONVERTER,
      );
      expect(
        processedFiles.supportedFiles.map((p) => p.getTraceType()),
      ).toEqual(types);
      expect(processedFiles.unsupportedFiles).toEqual(unsupportedFiles);
      return processedFiles;
    }
  });
});

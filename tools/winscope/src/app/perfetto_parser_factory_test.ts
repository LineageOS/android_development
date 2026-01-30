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

import { getFixtureFile } from '@test/unit/common/io_helpers';
import {UTC_CONVERTER} from '@common/time/test_helpers';
import {TraceFile} from '@trace/trace_file';
import {TraceType} from '@trace_api/trace_type';
import {PerfettoParserFactory} from './perfetto_parser_factory';
import {UserNotifierChecker} from '@test/unit/user_notifier_checker';
import {makeWarningInvalidPerfettoTrace} from '@parsers/helpers/warnings';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';

describe('PerfettoParserFactory', () => {
  const emptyGeometryData = new TraceGeometryData();

  describe('is robust to', () => {
    it('invalid perfetto file', async () => {
      const userNotifierChecker = new UserNotifierChecker();
      await checkRobustToFile('invalid_files/invalid_protolog.perfetto-trace');
      userNotifierChecker.expectAdded([
        makeWarningInvalidPerfettoTrace('invalid_protolog.perfetto-trace', [
          'Perfetto trace has no Winscope trace entries',
        ]),
      ]);
    });

    it('non-perfetto file', async () => {
      await checkRobustToFile(
        'traces/elapsed_timestamp/SurfaceFlinger.pb',
        false,
      );
    });

    it('empty perfetto file', async () => {
      await checkRobustToFile(
        'invalid_files/no_winscope_traces.perfetto-trace',
      );
    });

    async function checkRobustToFile(filepath: string, isPerfettoTrace = true) {
      const file = new TraceFile(await getFixtureFile(filepath));
      const processed = await new PerfettoParserFactory().processFile(
        file,
        UTC_CONVERTER,
      );
      expect(processed.parsers.length).toBe(0);
      expect(processed.isPerfettoTrace).toEqual(isPerfettoTrace);
      expect(processed.traceGeometryData).toEqual(emptyGeometryData);
    }
  });

  describe('creates', () => {
    it('IME readers', async () => {
      await createsReaderForFile('traces/perfetto/ime.perfetto-trace', [
        TraceType.INPUT_METHOD_CLIENTS,
        TraceType.INPUT_METHOD_MANAGER_SERVICE,
        TraceType.INPUT_METHOD_SERVICE,
      ]);
    });

    it('ProtoLog reader', async () => {
      await createsReaderForFile('traces/perfetto/protolog.perfetto-trace', [
        TraceType.PROTO_LOG,
      ]);
    });

    it('SurfaceFlinger reader', async () => {
      await createsReaderForFile(
        'traces/perfetto/layers_trace.perfetto-trace',
        [TraceType.SURFACE_FLINGER],
        true,
      );
    });

    it('Transactions reader', async () => {
      await createsReaderForFile(
        'traces/perfetto/transactions_trace.perfetto-trace',
        [TraceType.TRANSACTIONS],
      );
    });

    it('Transitions reader', async () => {
      await createsReaderForFile(
        'traces/perfetto/shell_transitions_trace.perfetto-trace',
        [TraceType.TRANSITION],
      );
    });

    it('ViewCapture reader', async () => {
      await createsReaderForFile(
        'traces/perfetto/viewcapture.perfetto-trace',
        [TraceType.VIEW_CAPTURE],
        true,
      );
    });

    it('WindowManager reader', async () => {
      await createsReaderForFile(
        'traces/perfetto/windowmanager.perfetto-trace',
        [TraceType.WINDOW_MANAGER],
        true,
      );
    });

    it('Input readers', async () => {
      await createsReaderForFile(
        'traces/perfetto/input-events.perfetto-trace',
        [TraceType.INPUT_MOTION_EVENT, TraceType.INPUT_KEY_EVENT],
      );
    });

    it('CUJ reader', async () => {
      await createsReaderForFile('traces/perfetto/cujs.perfetto-trace', [
        TraceType.CUJS,
      ]);
    });

    async function createsReaderForFile(
      filepath: string,
      types: TraceType[],
      hasGeometryData = false,
    ) {
      const file = new TraceFile(await getFixtureFile(filepath));
      await processFiles(file, types, hasGeometryData);
    }

    async function processFiles(
      file: TraceFile,
      types: TraceType[],
      hasGeometryData: boolean,
    ) {
      const processedFiles = await new PerfettoParserFactory().processFile(
        file,
        UTC_CONVERTER,
      );
      expect(processedFiles.parsers.map((p) => p.getTraceType())).toEqual(
        types,
      );
      expect(processedFiles.isPerfettoTrace).toEqual(true);
      if (hasGeometryData) {
        expect(processedFiles.traceGeometryData).not.toEqual(emptyGeometryData);
      } else {
        expect(processedFiles.traceGeometryData).toEqual(emptyGeometryData);
      }
    }
  });
});

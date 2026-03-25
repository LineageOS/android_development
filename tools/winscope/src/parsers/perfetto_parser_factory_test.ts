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

import {getFixtureFile} from '@common/testing/io_helpers';
import {makeConverterNoRteOffsets} from '@common/time/testing/test_helpers';
import {ParserCujs} from '@parsers/cujs/perfetto/parser_cujs';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {makeWarningInvalidPerfettoTrace} from '@parsers/helpers/warnings';
import {ParserInputMethodClients} from '@parsers/input_method/parser_input_method_clients';
import {ParserInputMethodManagerService} from '@parsers/input_method/parser_input_method_manager_service';
import {ParserInputMethodService} from '@parsers/input_method/parser_input_method_service';
import {ParserKeyEvent} from '@parsers/input/parser_key_event';
import {ParserMotionEvent} from '@parsers/input/parser_motion_event';
import {ParserProtolog} from '@parsers/protolog/parser_protolog';
import {ParserSurfaceFlinger} from '@parsers/surface_flinger/parser_surface_flinger';
import {ParserTransactions} from '@parsers/transactions/parser_transactions';
import {ParserTransitions} from '@parsers/transitions/parser_transitions';
import {ParserViewCapture} from '@parsers/view_capture/parser_view_capture';
import {ParserWindowManager} from '@parsers/window_manager/parser_window_manager';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

import {PerfettoParserFactory} from './perfetto_parser_factory';

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
      const processed = await createPerfettoParserFactory().processFile(
        file,
        makeConverterNoRteOffsets(),
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

    it('robust to non-perfetto file', async () => {
      const file = await getFixtureFile('traces/screenshot/screenshot.png');
      const processedFiles = await createPerfettoParserFactory().processFile(
        new TraceFile(file),
        makeConverterNoRteOffsets(),
        undefined,
      );
      expect(processedFiles.parsers.length).toBe(0);
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
      const processedFiles = await createPerfettoParserFactory().processFile(
        file,
        makeConverterNoRteOffsets(),
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
});

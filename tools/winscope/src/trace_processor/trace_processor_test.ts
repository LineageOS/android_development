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

import {getFixtureFile} from '@common/testing/io_helpers';
import {initWasm} from '@trace_processor/perfetto/wasm_engine_proxy';

import {TraceProcessorProxy} from './trace_processor';

describe('TraceProcessorProxy', () => {
  beforeAll(() => {
    initWasm(location.origin + '/');
  });

  it('can parse and query a trace', async () => {
    const processor = new TraceProcessorProxy('test_engine');

    // Load a test fixture
    const file = await getFixtureFile(
      'traces/perfetto/layers_trace.perfetto-trace',
    );
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    // Parse the trace
    await processor.parse(data);
    await processor.notifyEof();

    // Query the trace
    const result = await processor.query(
      'SELECT count(*) as count FROM surfaceflinger_layers_snapshot',
    );
    expect(result.numRows()).toBe(1);
    const row = result.firstRow({count: 0n});
    expect(Number(row.count)).toBeGreaterThan(0);
  });
});

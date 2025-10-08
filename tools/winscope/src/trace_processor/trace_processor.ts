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

import {analyticsLogEvent} from 'common/analytics';
import {TraceProcessorConfig} from './perfetto/engine';
import {WasmEngineProxy} from './perfetto/wasm_engine_proxy';
import {QueryResult} from './query_result';
import {RawDataQueryResult} from 'trace_processor/raw_data_query_result';
import {NOT_IMPLEMENTED_ERROR} from 'common/errors';

export interface TraceProcessor {
  query(sqlQuery: string): Promise<QueryResult>;
  rawQuery(sqlQuery: string): Promise<RawDataQueryResult>;
  reset(config: TraceProcessorConfig): Promise<void>;
  parse(data: Uint8Array): Promise<void>;
  notifyEof(): Promise<void>;
}

export class TraceProcessorWrapper implements TraceProcessor {
  private tp: TraceProcessor | undefined;

  setTraceProcessor(value: TraceProcessor) {
    this.tp = value;
  }

  async query(sqlQuery: string): Promise<QueryResult> {
    if (!this.tp) {
      throw NOT_IMPLEMENTED_ERROR;
    }
    return this.tp.query(sqlQuery);
  }

  async rawQuery(sqlQuery: string): Promise<RawDataQueryResult> {
    if (!this.tp) {
      throw NOT_IMPLEMENTED_ERROR;
    }
    return this.tp.rawQuery(sqlQuery);
  }

  async reset(config: TraceProcessorConfig) {
    if (!this.tp) {
      throw NOT_IMPLEMENTED_ERROR;
    }
    return this.tp.reset(config);
  }

  async parse(data: Uint8Array) {
    if (!this.tp) {
      throw NOT_IMPLEMENTED_ERROR;
    }
    return this.tp.parse(data);
  }

  async notifyEof() {
    if (!this.tp) {
      throw NOT_IMPLEMENTED_ERROR;
    }
    return this.tp.notifyEof();
  }
}

export class TraceProcessorProxy implements TraceProcessor {
  private wasmEngine: WasmEngineProxy;

  constructor(engineId: string) {
    this.wasmEngine = new WasmEngineProxy(engineId);
  }

  async query(sqlQuery: string): Promise<QueryResult> {
    const startTimeMs = Date.now();
    const result = await this.wasmEngine.query(sqlQuery);
    analyticsLogEvent('tp_general_query_time', {
      value: Date.now() - startTimeMs,
    });
    return result;
  }

  async rawQuery(sqlQuery: string): Promise<RawDataQueryResult> {
    const result = new RawDataQueryResult();
    this.wasmEngine.streamingQuery(result, sqlQuery);
    const resolvedResult = await result.waitAllBatches();
    return resolvedResult;
  }

  async reset(config: TraceProcessorConfig) {
    await this.wasmEngine.resetTraceProcessor(config);
  }

  async parse(data: Uint8Array) {
    await this.wasmEngine.parse(data);
  }

  async notifyEof() {
    await this.wasmEngine.notifyEof();
  }
}

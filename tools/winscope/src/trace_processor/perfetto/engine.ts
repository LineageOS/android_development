// Copyright (C) 2018 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {
  TraceProcessorRpc,
  TraceProcessorRpcStream,
  QueryArgs,
  ComputeMetricArgs,
  EnableMetatraceArgs,
  ResetTraceProcessorArgs,
  RegisterSqlPackageArgs,
  DisableAndReadMetatraceResult,
} from 'protos/protos/perfetto/trace_processor/trace_processor_pb';
import {MetatraceCategories, MetatraceCategoriesMap} from 'protos/protos/perfetto/trace_processor/metatrace_categories_pb';
import {defer, Deferred} from './deferred';
import {getLogger, Logger} from '@compat/logging';
import {ProtoRingBuffer} from './proto_ring_buffer';
import {
  createQueryResult,
  QueryError,
  QueryResult,
  WritableQueryResult,
} from './query_result';
import {ProtoReader} from './proto_reader';
import {assertDefined} from '@common/assert';

// Aliases for brevity
const TPM = TraceProcessorRpc.TraceProcessorMethod;

export type EngineMode = 'WASM' | 'HTTP_RPC';
export type NewEngineMode = 'USE_HTTP_RPC_IF_AVAILABLE' | 'FORCE_BUILTIN_WASM';

// This is used to skip the decoding of queryResult from protobufjs and deal
// with it ourselves.
interface QueryResultBypass {
  rawQueryResult: Uint8Array;
}

export interface TraceProcessorConfig {
  cropTrackEvents: boolean;
  ingestFtraceInRawTable: boolean;
  analyzeTraceProtoContent: boolean;
  ftraceDropUntilAllCpusValid: boolean;
}

const QUERY_LOG_BUFFER_SIZE = 100;

interface QueryLog {
  readonly tag?: string;
  readonly query: string;
  readonly startTime: number;
  readonly endTime?: number;
  readonly success?: boolean;
}

export interface Engine {
  readonly mode: EngineMode;
  readonly engineId: string;

  /**
   * A list of the most recent queries along with their start times, end times
   * and success status (if completed).
   */
  readonly queryLog: ReadonlyArray<QueryLog>;

  /**
   * Execute a query against the database, returning a promise that resolves
   * when the query has completed but rejected when the query fails for whatever
   * reason. On success, the promise will only resolve once all the resulting
   * rows have been received.
   *
   * The promise will be rejected if the query fails.
   *
   * @param sql The query to execute.
   * @param tag An optional tag used to trace the origin of the query.
   */
  query(sql: string, tag?: string): Promise<QueryResult>;

  /**
   * Execute a query against the database, returning a promise that resolves
   * when the query has completed or failed. The promise will never get
   * rejected, it will always successfully resolve. Use the returned wrapper
   * object to determine whether the query completed successfully.
   *
   * The promise will only resolve once all the resulting rows have been
   * received.
   *
   * @param sql The query to execute.
   * @param tag An optional tag used to trace the origin of the query.
   */
  tryQuery(sql: string, tag?: string): Promise<QueryResult>;

  /**
   * Execute one or more metric and get the result.
   *
   * @param metrics The metrics to run.
   * @param format The format of the response.
   */
  computeMetric(
    metrics: string[],
    format: 'json' | 'prototext' | 'proto',
  ): Promise<string | Uint8Array>;

  enableMetatrace(categories?: MetatraceCategoriesMap[keyof MetatraceCategoriesMap]): void;
  stopAndGetMetatrace(): Promise<DisableAndReadMetatraceResult>;

  getProxy(tag: string): EngineProxy;
  readonly numRequestsPending: number;
  readonly failed: string | undefined;
}

// Abstract interface of a trace proccessor.
// This is the TypeScript equivalent of src/trace_processor/rpc.h.
// There are two concrete implementations:
//   1. WasmEngineProxy: creates a Wasm module and interacts over postMessage().
//   2. HttpRpcEngine: connects to an external `trace_processor_shell --httpd`.
//      and interacts via fetch().
// In both cases, we have a byte-oriented pipe to interact with TraceProcessor.
// The derived class is only expected to deal with these two functions:
// 1. Implement the abstract rpcSendRequestBytes() function, sending the
//    proto-encoded TraceProcessorRpc requests to the TraceProcessor instance.
// 2. Call onRpcResponseBytes() when response data is received.
export abstract class EngineBase implements Engine {
  abstract readonly id: string;
  abstract readonly mode: EngineMode;
  private txSeqId = 0;
  private rxSeqId = 0;
  private rxBuf = new ProtoRingBuffer();
  private pendingParses = new Array<Deferred<void>>();
  private pendingEOFs = new Array<Deferred<void>>();
  private pendingResetTraceProcessors = new Array<Deferred<void>>();
  private pendingQueries = new Array<WritableQueryResult>();
  private pendingRestoreTables = new Array<Deferred<void>>();
  private pendingComputeMetrics = new Array<Deferred<string | Uint8Array>>();
  private pendingReadMetatrace?: Deferred<DisableAndReadMetatraceResult>;
  private pendingRegisterSqlPackage?: Deferred<void>;
  private _isMetatracingEnabled = false;
  private _numRequestsPending = 0;
  private _failed: string | undefined = undefined;
  private _queryLog: Array<QueryLog> = [];
  constructor(private readonly logger: Logger = getLogger('EngineBase')) {}

  get queryLog(): ReadonlyArray<QueryLog> {
    return this._queryLog;
  }

  // TraceController sets this to raf.scheduleFullRedraw().
  onResponseReceived?: () => void;

  // Called to send data to the TraceProcessor instance. This turns into a
  // postMessage() or a HTTP request, depending on the Engine implementation.
  abstract rpcSendRequestBytes(data: Uint8Array): void;

  // Called when an inbound message is received by the Engine implementation
  // (e.g. onmessage for the Wasm case, on when HTTP replies are received for
  // the HTTP+RPC case).
  onRpcResponseBytes(dataWillBeRetained: Uint8Array) {
    // Note: when hitting the fastpath inside ProtoRingBuffer, the |data| buffer
    // is returned back by readMessage() (% subarray()-ing it) and held onto by
    // other classes (e.g., QueryResult). For both fetch() and Wasm we are fine
    // because every response creates a new buffer.
    this.rxBuf.append(dataWillBeRetained);
    for (;;) {
      const msg = this.rxBuf.readMessage();
      if (msg === undefined) break;
      this.onRpcResponseMessage(msg);
    }
  }

  // Parses a response message.
  // |rpcMsgEncoded| is a sub-array to to the start of a TraceProcessorRpc
  // proto-encoded message (without the proto preamble and varint size).
  private onRpcResponseMessage(rpcMsgEncoded: Uint8Array) {
    let rpc: TraceProcessorRpc | undefined;
    let queryResultBytes: Uint8Array | undefined;

    // We scan the message primarily to:
    // 1. Check if it's a TPM_QUERY_STREAMING response (field 3 == 3).
    // 2. If so, extract the queryResult bytes (field 203) without parsing it.
    // 3. Otherwise, parse the whole message using the standard decoder.
    const reader = new ProtoReader(rpcMsgEncoded);
    let seq = 0;
    let fatalError: string | undefined;
    let response = 0;

    // We can't use ProtoReader loop easily to *just* find fields because we need to handle all wire types
    // to skip correctly. ProtoReader has skipType() which is good.
    // We'll peek/scan manually.
    try {
      while (reader.pos < reader.len) {
        const startPos = reader.pos;
        const tag = reader.uint32();
        const fieldId = tag >>> 3;
        const wireType = tag & 7;

        if (fieldId === 1) { // seq
           seq = reader.int64().low; // Assuming standard int64 or varint logic
        } else if (fieldId === 5) { // fatalError
           fatalError = reader.string();
        } else if (fieldId === 3) { // response
           response = reader.uint32();
        } else if (fieldId === 203) { // queryResult
           const len = reader.uint32();
           const payloadStart = reader.pos;
           reader.pos += len;
           if (reader.pos > reader.len) throw new Error('Truncated message');
           queryResultBytes = reader.buf.subarray(payloadStart, reader.pos);
        } else {
           reader.skipType(wireType);
        }
      }
    } catch (e) {
      this.fail(`Failed to parse RPC: ${e}`);
      return;
    }

    if (fatalError !== undefined && fatalError.length > 0) {
      this.fail(`${fatalError}`);
      return;
    }

    // Allow restarting sequences from zero (when reloading the browser).
    if (seq !== this.rxSeqId + 1 && this.rxSeqId !== 0 && seq !== 0) {
      // "(ERR:rpc_seq)" is intercepted by error_dialog.ts to show a more
      // graceful and actionable error.
      this.fail(
        `RPC sequence id mismatch ` +
          `cur=${seq} last=${this.rxSeqId} (ERR:rpc_seq)`,
      );
      return;
    }

    this.rxSeqId = seq;

    let isFinalResponse = true;

    // Helper to fully parse RPC if we haven't already extracted what we need.
    // Only parse if not skipping query result or if we need other fields.
    // Actually we only extracted seq and response and queryResultBytes.
    // For other messages, we need to parse.
    const getRpc = () => {
       if (!rpc) {
          rpc = TraceProcessorRpc.deserializeBinary(rpcMsgEncoded);
       }
       return rpc;
    };

    switch (response) {
      case TPM.TPM_APPEND_TRACE_DATA: {
        const appendResult = assertDefined(getRpc().getAppendResult());
        const pendingPromise = assertDefined(this.pendingParses.shift());
        const error = appendResult.getError();
        if (error && error.length > 0) {
          pendingPromise.reject(error);
        } else {
          pendingPromise.resolve();
        }
        break;
      }
      case TPM.TPM_FINALIZE_TRACE_DATA: {
        const finalizeResult = assertDefined(getRpc().getFinalizeDataResult());
        const pendingPromise = assertDefined(this.pendingEOFs.shift());
        const error = finalizeResult.getError();
        if (error && error.length > 0) {
          pendingPromise.reject(error);
        } else {
          pendingPromise.resolve();
        }
        break;
      }
      case TPM.TPM_RESET_TRACE_PROCESSOR:
        assertDefined(this.pendingResetTraceProcessors.shift()).resolve();
        break;
      case TPM.TPM_RESTORE_INITIAL_TABLES:
        assertDefined(this.pendingRestoreTables.shift()).resolve();
        break;
      case TPM.TPM_QUERY_STREAMING:
        const qResRaw = assertDefined(queryResultBytes);
        const pendingQuery = assertDefined(this.pendingQueries[0]);
        pendingQuery.appendResultBatch(qResRaw);
        if (pendingQuery.isComplete()) {
          this.pendingQueries.shift();
        } else {
          isFinalResponse = false;
        }
        break;
      case TPM.TPM_COMPUTE_METRIC:
        const metricRes = assertDefined(getRpc().getMetricResult());
        const pendingComputeMetric = assertDefined(
          this.pendingComputeMetrics.shift(),
        );
        const error = metricRes.getError();
        if (error && error.length > 0) {
          const queryError = new QueryError(
            `ComputeMetric() error: ${error}`,
            {
              query: 'COMPUTE_METRIC',
            },
          );
          pendingComputeMetric.reject(queryError);
        } else {
          const result =
            metricRes.getMetricsAsPrototext() ??
            metricRes.getMetricsAsJson() ??
            metricRes.getMetrics_asU8() ??
            '';
          pendingComputeMetric.resolve(result);
        }
        break;
      case TPM.TPM_DISABLE_AND_READ_METATRACE:
        const metatraceRes = assertDefined(
          getRpc().getMetatrace(),
        );
        assertDefined(this.pendingReadMetatrace).resolve(metatraceRes);
        this.pendingReadMetatrace = undefined;
        break;
      case TPM.TPM_REGISTER_SQL_PACKAGE:
        const registerResult = assertDefined(getRpc().getRegisterSqlPackageResult());
        const res = assertDefined(this.pendingRegisterSqlPackage);
        const err = registerResult.getError();
        if (err && err.length > 0) {
          res.reject(err);
        } else {
          res.resolve();
        }
        break;
      default:
        this.logger.warn(
          'Unexpected TraceProcessor response received: ',
          response,
        );
        break;
    } // switch(rpc.response);

    if (isFinalResponse) {
      --this._numRequestsPending;
    }

    this.onResponseReceived?.();
  }

  // TraceProcessor methods below this point.
  // The methods below are called by the various controllers in the UI and
  // deal with marshalling / unmarshaling requests to/from TraceProcessor.

  // Push trace data into the engine. The engine is supposed to automatically
  // figure out the type of the trace (JSON vs Protobuf).
  parse(data: Uint8Array): Promise<void> {
    const asyncRes = defer<void>();
    this.pendingParses.push(asyncRes);
    const rpc = new TraceProcessorRpc();
    rpc.setRequest(TPM.TPM_APPEND_TRACE_DATA);
    rpc.setAppendTraceData(data);
    this.rpcSendRequest(rpc);
    return asyncRes; // Linearize with the worker.
  }

  // Notify the engine that we reached the end of the trace.
  // Called after the last parse() call.
  notifyEof(): Promise<void> {
    const asyncRes = defer<void>();
    this.pendingEOFs.push(asyncRes);
    const rpc = new TraceProcessorRpc();
    rpc.setRequest(TPM.TPM_FINALIZE_TRACE_DATA);
    this.rpcSendRequest(rpc);
    return asyncRes; // Linearize with the worker.
  }

  // Updates the TraceProcessor Config. This method creates a new
  // TraceProcessor instance, so it should be called before passing any trace
  // data.
  resetTraceProcessor({
    cropTrackEvents,
    ingestFtraceInRawTable,
    analyzeTraceProtoContent,
    ftraceDropUntilAllCpusValid,
  }: TraceProcessorConfig): Promise<void> {
    const asyncRes = defer<void>();
    this.pendingResetTraceProcessors.push(asyncRes);
    const rpc = new TraceProcessorRpc();
    rpc.setRequest(TPM.TPM_RESET_TRACE_PROCESSOR);
    const args = new ResetTraceProcessorArgs();
    args.setDropTrackEventDataBefore(cropTrackEvents
      ? ResetTraceProcessorArgs.DropTrackEventDataBefore
          .TRACK_EVENT_RANGE_OF_INTEREST
      : ResetTraceProcessorArgs.DropTrackEventDataBefore.NO_DROP);
    args.setIngestFtraceInRawTable(ingestFtraceInRawTable);
    args.setAnalyzeTraceProtoContent(analyzeTraceProtoContent);
    args.setFtraceDropUntilAllCpusValid(ftraceDropUntilAllCpusValid);
    rpc.setResetTraceProcessorArgs(args);
    this.rpcSendRequest(rpc);
    return asyncRes;
  }

  // Resets the trace processor state by destroying any table/views created by
  // the UI after loading.
  restoreInitialTables(): Promise<void> {
    const asyncRes = defer<void>();
    this.pendingRestoreTables.push(asyncRes);
    const rpc = new TraceProcessorRpc();
    rpc.setRequest(TPM.TPM_RESTORE_INITIAL_TABLES);
    this.rpcSendRequest(rpc);
    return asyncRes; // Linearize with the worker.
  }

  // Shorthand for sending a compute metrics request to the engine.
  async computeMetric(
    metrics: string[],
    format: 'json' | 'prototext' | 'proto',
  ): Promise<string | Uint8Array> {
    const asyncRes = defer<string | Uint8Array>();
    this.pendingComputeMetrics.push(asyncRes);
    const rpc = new TraceProcessorRpc();
    rpc.setRequest(TPM.TPM_COMPUTE_METRIC);
    const args = new ComputeMetricArgs();
    args.setMetricNamesList(metrics);
    if (format === 'json') {
      args.setFormat(ComputeMetricArgs.ResultFormat.JSON);
    } else if (format === 'prototext') {
      args.setFormat(ComputeMetricArgs.ResultFormat.TEXTPROTO);
    } else if (format === 'proto') {
      args.setFormat(ComputeMetricArgs.ResultFormat.BINARY_PROTOBUF);
    } else {
      throw new Error(`Unknown compute metric format ${format}`);
    }
    rpc.setComputeMetricArgs(args);
    this.rpcSendRequest(rpc);
    return asyncRes;
  }

  // Issues a streaming query and retrieve results in batches.
  // The returned QueryResult object will be populated over time with batches
  // of rows (each batch conveys ~128KB of data and a variable number of rows).
  // The caller can decide whether to wait that all batches have been received
  // (by awaiting the returned object or calling result.waitAllRows()) or handle
  // the rows incrementally.
  //
  // Example usage:
  // const res = engine.execute('SELECT foo, bar FROM table');
  // this.logger.debug(res.numRows());  // Will print 0 because we didn't await.
  // await(res.waitAllRows());
  // this.logger.debug(res.numRows());  // Will print the total number of rows.
  //
  // for (const it = res.iter({foo: NUM, bar:STR}); it.valid(); it.next()) {
  //   this.logger.debug(it.foo, it.bar);
  // }
  //
  // Optional |tag| (usually a component name) can be provided to allow
  // attributing trace processor workload to different UI components.
  // NOTE: the only reason why this is public is so that Winscope (which uses a
  // fork of our codebase) can invoke this directly. See commit msg of #3051.
  streamingQuery(result: WritableQueryResult, sqlQuery: string, tag?: string) {
    const rpc = new TraceProcessorRpc();
    rpc.setRequest(TPM.TPM_QUERY_STREAMING);
    const args = new QueryArgs();
    args.setSqlQuery(sqlQuery);
    if (tag) {
      args.setTag(tag);
    }
    rpc.setQueryArgs(args);
    this.pendingQueries.push(result);
    this.rpcSendRequest(rpc);
  }

  private logQueryStart(
    query: string,
    tag?: string,
  ): {
    endTime?: number;
    success?: boolean;
  } {
    const startTime = performance.now();
    const queryLog: QueryLog = {query, tag, startTime};
    this._queryLog.push(queryLog);
    if (this._queryLog.length > QUERY_LOG_BUFFER_SIZE) {
      this._queryLog.shift();
    }
    return queryLog;
  }

  // Wraps .streamingQuery(), captures errors and re-throws with current stack.
  //
  // Note: This function is less flexible than .execute() as it only returns a
  // promise which must be unwrapped before the QueryResult may be accessed.
  async query(sqlQuery: string, tag?: string): Promise<QueryResult> {
    const queryLog = this.logQueryStart(sqlQuery);
    try {
      const result = createQueryResult({query: sqlQuery});
      this.streamingQuery(result, sqlQuery, tag);
      const resolvedResult = await result;
      queryLog.success = true;
      return resolvedResult;
    } catch (e) {
      // Replace the error's stack trace with the one from here
      // Note: It seems only V8 can trace the stack up the promise chain, so its
      // likely this stack won't be useful on !V8.
      // See
      // https://docs.google.com/document/d/13Sy_kBIJGP0XT34V1CV3nkWya4TwYx9L3Yv45LdGB6Q
      captureStackTrace(e as Error);
      queryLog.success = false;
      throw e;
    } finally {
      queryLog.endTime = performance.now();
    }
  }

  async tryQuery(sql: string, tag?: string): Promise<QueryResult> {
    try {
      const result = await this.query(sql, tag);
      return result;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = error as any;
      const msg = 'message' in e ? `${e.message}` : `${error}`;
      throw new Error(msg);
    }
  }

  isMetatracingEnabled(): boolean {
    return this._isMetatracingEnabled;
  }

  enableMetatrace(categories?: MetatraceCategoriesMap[keyof MetatraceCategoriesMap]) {
    const rpc = new TraceProcessorRpc();
    rpc.setRequest(TPM.TPM_ENABLE_METATRACE);
    if (categories !== undefined && categories !== MetatraceCategories.NONE) {
      const args = new EnableMetatraceArgs();
      args.setCategories(categories);
      rpc.setEnableMetatraceArgs(args);
    }
    this._isMetatracingEnabled = true;
    this.rpcSendRequest(rpc);
  }

  stopAndGetMetatrace(): Promise<DisableAndReadMetatraceResult> {
    // If we are already finalising a metatrace, ignore the request.
    if (this.pendingReadMetatrace) {
      return Promise.reject(new Error('Already finalising a metatrace'));
    }

    const result = defer<DisableAndReadMetatraceResult>();

    const rpc = new TraceProcessorRpc();
    rpc.setRequest(TPM.TPM_DISABLE_AND_READ_METATRACE);
    this._isMetatracingEnabled = false;
    this.pendingReadMetatrace = result;
    this.rpcSendRequest(rpc);
    return result;
  }

  registerSqlPackages(pkg: {
    name: string;
    modules: {name: string; sql: string}[];
  }): Promise<void> {
    if (this.pendingRegisterSqlPackage) {
      return Promise.reject(new Error('Already registering SQL package'));
    }

    const result = defer<void>();

    const rpc = new TraceProcessorRpc();
    rpc.setRequest(TPM.TPM_REGISTER_SQL_PACKAGE);
    const args = new RegisterSqlPackageArgs();
    args.setPackageName(pkg.name);
    const modules = pkg.modules.map(m => {
      const mod = new RegisterSqlPackageArgs.Module();
      mod.setName(m.name);
      mod.setSql(m.sql);
      return mod;
    });
    args.setModulesList(modules);
    args.setAllowOverride(true);
    rpc.setRegisterSqlPackageArgs(args);
    this.pendingRegisterSqlPackage = result;
    this.rpcSendRequest(rpc);
    return result;
  }

  // Marshals the TraceProcessorRpc request arguments and sends the request
  // to the concrete Engine (Wasm or HTTP).
  private rpcSendRequest(rpc: TraceProcessorRpc) {
    rpc.setSeq(this.txSeqId++);
    // Each message is wrapped in a TraceProcessorRpcStream to add the varint
    // preamble with the size, which allows tokenization on the other end.
    const outerProto = new TraceProcessorRpcStream();
    outerProto.addMsg(rpc);
    const buf = outerProto.serializeBinary();
    ++this._numRequestsPending;
    this.rpcSendRequestBytes(buf);
  }

  get engineId(): string {
    return this.id;
  }

  get numRequestsPending(): number {
    return this._numRequestsPending;
  }

  getProxy(tag: string): EngineProxy {
    return new EngineProxy(this, tag);
  }

  protected fail(reason: string) {
    this._failed = reason;
    throw new Error(reason);
  }

  get failed(): string | undefined {
    return this._failed;
  }

  abstract dispose(): void;
}

// Lightweight engine proxy which annotates all queries with a tag
export class EngineProxy implements Engine {
  private engine: EngineBase;
  private tag: string;
  private disposed = false;

  get queryLog() {
    return this.engine.queryLog;
  }

  constructor(engine: EngineBase, tag: string) {
    this.engine = engine;
    this.tag = tag;
  }

  async query(query: string, tag?: string): Promise<QueryResult> {
    if (this.disposed) {
      // If we are disposed (the trace was closed), return an empty QueryResult
      // that will never see any data or EOF. We can't do otherwise or it will
      // cause crashes to code calling firstRow() and expecting data.
      return createQueryResult({query});
    }
    return await this.engine.query(query, tag);
  }

  async tryQuery(query: string, tag?: string): Promise<QueryResult> {
    if (this.disposed) {
      throw new Error(`EngineProxy ${this.tag} was disposed`);
    }
    return await this.engine.tryQuery(query, tag);
  }

  async computeMetric(
    metrics: string[],
    format: 'json' | 'prototext' | 'proto',
  ): Promise<string | Uint8Array> {
    if (this.disposed) {
      return defer<string>(); // Return a promise that will hang forever.
    }
    return this.engine.computeMetric(metrics, format);
  }

  enableMetatrace(categories?: MetatraceCategoriesMap[keyof MetatraceCategoriesMap]): void {
    this.engine.enableMetatrace(categories);
  }

  stopAndGetMetatrace(): Promise<DisableAndReadMetatraceResult> {
    return this.engine.stopAndGetMetatrace();
  }

  get engineId(): string {
    return this.engine.id;
  }

  getProxy(tag: string): EngineProxy {
    return this.engine.getProxy(`${this.tag}/${tag}`);
  }

  get numRequestsPending() {
    return this.engine.numRequestsPending;
  }

  get mode() {
    return this.engine.mode;
  }

  get failed() {
    return this.engine.failed;
  }

  dispose() {
    this.disposed = true;
  }
}

// Capture stack trace and attach to the given error object
function captureStackTrace(e: Error): void {
  const stack = new Error().stack;
  if ('captureStackTrace' in Error) {
    // V8 specific
    Error.captureStackTrace(e, captureStackTrace);
  } else {
    // Generic
    Object.defineProperty(e, 'stack', {
      value: stack,
      writable: true,
      configurable: true,
    });
  }
}

// A convenience interface to inject the App in Mithril components.
export interface EngineAttrs {
  engine: Engine;
}

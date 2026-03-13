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

import {assertDefined} from '@common/assert';
import {getLogger, Logger} from '@compat/logging';
import {PerfettoQueryArgs, PerfettoRegisterSqlPackageArgs, PerfettoResetTraceProcessorArgs, PerfettoTraceProcessorRpc, PerfettoTraceProcessorRpcStream,} from '@compat/protobuf';

import {defer, Deferred} from './deferred';
import {ProtoReader} from './proto_reader';
import {ProtoRingBuffer} from './proto_ring_buffer';
import {createQueryResult, QueryResult, WritableQueryResult,} from './query_result';

// Aliases for brevity
const TPM = PerfettoTraceProcessorRpc.TraceProcessorMethod;

export interface TraceProcessorConfig {
  cropTrackEvents: boolean;
  ingestFtraceInRawTable: boolean;
  analyzeTraceProtoContent: boolean;
  ftraceDropUntilAllCpusValid: boolean;
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
export abstract class EngineBase {
  abstract readonly id: string;
  private txSeqId = 0;
  private rxSeqId = 0;
  private rxBuf = new ProtoRingBuffer();
  private pendingParses = new Array<Deferred<void>>();
  private pendingEOFs = new Array<Deferred<void>>();
  private pendingResetTraceProcessors = new Array<Deferred<void>>();
  private pendingQueries = new Array<WritableQueryResult>();
  private pendingRestoreTables = new Array<Deferred<void>>();
  private pendingRegisterSqlPackage?: Deferred<void>;
  constructor(private readonly logger: Logger = getLogger('EngineBase')) {}

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
    let rpc: PerfettoTraceProcessorRpc | undefined;
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

    // Helper to fully parse RPC if we haven't already extracted what we need.
    // Only parse if not skipping query result or if we need other fields.
    // Actually we only extracted seq and response and queryResultBytes.
    // For other messages, we need to parse.
    const getRpc = () => {
       if (!rpc) {
          rpc = PerfettoTraceProcessorRpc.deserializeBinary(rpcMsgEncoded);
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
        }
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
          `Unexpected TraceProcessor response received: ${response}`,
        );
        break;
    } // switch(rpc.response);

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
    const rpc = new PerfettoTraceProcessorRpc();
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
    const rpc = new PerfettoTraceProcessorRpc();
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
    const rpc = new PerfettoTraceProcessorRpc();
    rpc.setRequest(TPM.TPM_RESET_TRACE_PROCESSOR);
    const args = new PerfettoResetTraceProcessorArgs();
    args.setDropTrackEventDataBefore(cropTrackEvents
      ? PerfettoResetTraceProcessorArgs.DropTrackEventDataBefore
          .TRACK_EVENT_RANGE_OF_INTEREST
      : PerfettoResetTraceProcessorArgs.DropTrackEventDataBefore.NO_DROP);
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
    const rpc = new PerfettoTraceProcessorRpc();
    rpc.setRequest(TPM.TPM_RESTORE_INITIAL_TABLES);
    this.rpcSendRequest(rpc);
    return asyncRes; // Linearize with the worker.
  }

  //
  // NOTE: the only reason why this is public is so that Winscope (which uses a
  // fork of our codebase) can invoke this directly. See commit msg of #3051.
  streamingQuery(result: WritableQueryResult, sqlQuery: string) {
    const rpc = new PerfettoTraceProcessorRpc();
    rpc.setRequest(TPM.TPM_QUERY_STREAMING);
    const args = new PerfettoQueryArgs();
    args.setSqlQuery(sqlQuery);
    rpc.setQueryArgs(args);
    this.pendingQueries.push(result);
    this.rpcSendRequest(rpc);
  }

  // Wraps .streamingQuery(), captures errors and re-throws with current stack.
  //
  // Note: This function is less flexible than .execute() as it only returns a
  // promise which must be unwrapped before the QueryResult may be accessed.
  async query(sqlQuery: string): Promise<QueryResult> {
    const result = createQueryResult({query: sqlQuery});
    this.streamingQuery(result, sqlQuery);
    const resolvedResult = await result;
    return resolvedResult;
  }

  registerSqlPackages(pkg: {
    name: string;
    modules: Array<{name: string; sql: string}>;
  }): Promise<void> {
    if (this.pendingRegisterSqlPackage) {
      return Promise.reject(new Error('Already registering SQL package'));
    }

    const result = defer<void>();

    const rpc = new PerfettoTraceProcessorRpc();
    rpc.setRequest(TPM.TPM_REGISTER_SQL_PACKAGE);
    const args = new PerfettoRegisterSqlPackageArgs();
    args.setPackageName(pkg.name);
    const modules = pkg.modules.map(m => {
      const mod = new PerfettoRegisterSqlPackageArgs.Module();
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
  private rpcSendRequest(rpc: PerfettoTraceProcessorRpc) {
    rpc.setSeq(this.txSeqId++);
    // Each message is wrapped in a TraceProcessorRpcStream to add the varint
    // preamble with the size, which allows tokenization on the other end.
    const outerProto = new PerfettoTraceProcessorRpcStream();
    outerProto.addMsg(rpc);
    const buf = outerProto.serializeBinary();
    this.rpcSendRequestBytes(buf);
  }

  get engineId(): string {
    return this.id;
  }

  protected fail(reason: string) {
    throw new Error(reason);
  }
}

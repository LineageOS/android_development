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
import {NOT_IMPLEMENTED_ERROR} from '@common/errors';
import {ProtoReader} from '@trace_processor/perfetto/proto_reader';
import {QueryResult, Row, RowIterator, WritableQueryResult,} from '@trace_processor/perfetto/query_result';

/**
 * Represents a query result where the raw data is received in multiple batches.
 * This class implements `WritableQueryResult` and a skeleton implementation of 'Query Result'
 * to allow appending byte arrays as they become available.
 * It's useful for handling large query results
 * that are streamed or processed in chunks, providing a mechanism to wait
 * until all batches have been received before further processing.
 */
export class RawDataQueryResult implements WritableQueryResult, QueryResult {
  batches: Uint8Array[] = [];
  private lastBatchReceived = false;
  private resolveAllBatches:
    | ((value: void | PromiseLike<void>) => void)
    | undefined;
  private allBatchesPromise = new Promise<void>(
    (resolve) => (this.resolveAllBatches = resolve),
  );

  // QueryResult interface skeleton implementation
  iter<T extends Row>(_: T): RowIterator<T> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  firstRow<T extends Row>(_: T): RowIterator<T> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  maybeFirstRow<T extends Row>(_: T): RowIterator<T> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  waitAllRows(): Promise<QueryResult> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  waitMoreRows(): Promise<QueryResult> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  isComplete(): boolean {
    return this.lastBatchReceived;
  }

  numRows(): number {
    return this.batches.length;
  }

  columns(): string[] {
    throw NOT_IMPLEMENTED_ERROR;
  }

  error(): string | undefined {
    throw NOT_IMPLEMENTED_ERROR;
  }

  statementCount(): number {
    throw NOT_IMPLEMENTED_ERROR;
  }

  statementWithOutputCount(): number {
    throw NOT_IMPLEMENTED_ERROR;
  }

  lastStatementSql(): string {
    throw NOT_IMPLEMENTED_ERROR;
  }

  async waitAllBatches(): Promise<RawDataQueryResult> {
    return this.allBatchesPromise.then(() => {
      return this;
    });
  }

  appendResultBatch(resBytes: Uint8Array): void {
    this.batches.push(resBytes);
    // We need to do enough decoding to determine if this is the last batch
    const reader = ProtoReader.create(resBytes);
    assertTrue(reader.pos === 0);
    while (reader.pos < reader.len) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 3: {
          const batchLen = reader.uint32();
          const batchRaw = resBytes.subarray(reader.pos, reader.pos + batchLen);
          reader.pos += batchLen;
          this.lastBatchReceived = this.extractIsLastBatch(batchRaw);
          break;
        }
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    if (this.lastBatchReceived && this.resolveAllBatches !== undefined) {
      this.resolveAllBatches();
    }
  }

  private extractIsLastBatch(batchBytes: Uint8Array): boolean {
    const reader = ProtoReader.create(batchBytes);
    assertTrue(reader.pos === 0);
    const end = reader.len;
    let result = false;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 6:
          result = !!reader.bool();
          break;

        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return result;
  }
}

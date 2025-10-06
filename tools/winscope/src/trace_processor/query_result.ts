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
import {WritableQueryResult} from './perfetto/query_result';
import protobuf from 'protobufjs/minimal';
import {assertTrue} from 'common/assert';

/**
 * Represents the possible data types for a column in a query result.
 * It can be a string, number, bigint, null, or a Uint8Array for binary data.
 */
export type ColumnType = string | number | bigint | Uint8Array;

/**
 * Defines the structure of a single row in a query result, where each key
 * is a column name and the value is of a type defined by `ColumnType`.
 */
export interface Row {
  [key: string]: ColumnType | null;
}

/**
 * An iterator for traversing rows in a query result.
 */
export interface RowIterator {
  /**
   * Checks if the iterator is currently pointing to a valid row.
   * @return True if the iterator is valid, false otherwise.
   */
  valid(): boolean;

  /**
   * Moves the iterator to the next row in the result set.
   */
  next(): void;

  /**
   * Retrieves the value of a specific column from the current row.
   * @param columnName The name of the column to retrieve.
   * @return The value of the column.
   */
  get(columnName: string): ColumnType | null;
}

/**
 * Represents the result of a database query, providing methods to access
 * the data and its metadata.
 */
export declare interface QueryResult {
  /**
   * Gets the total number of rows in the query result.
   * @return The number of rows.
   */
  numRows(): number;

  /**
   * Retrieves the names of all columns in the query result.
   * @return An array of column names.
   */
  columns(): string[];

  /**
   * Creates an iterator for traversing the rows in the result set.
   * @param spec An object specifying the structure of the rows to iterate over.
   * @return A `RowIterator` for the result set.
   */
  iter<T extends Row>(spec: T): RowIterator;

  /**
   * Retrieves the first row of the query result.
   * @param spec An object specifying the structure of the first row.
   * @return The first row of the result.
   */
  firstRow<T extends Row>(spec: T): T;
}

/**
 * A container for multiple query results, typically related to a specific
 * analysis or snapshot of trace data.
 */
export interface QueryResults<T> {
  /**
   * The result of a query for a snapshot range.
   */
  snapshotRange: T;

  /**
   * The result of a query for a layers range.
   */
  layersRange: T;

  /**
   * The result of a query for all visible rectangles, or undefined if not available.
   */
  allVisibleRects: QueryResult | undefined;

  /**
   * The result of a query for all snapshots, or undefined if not available.
   */
  allSnapshots: T | undefined;
}

/**
 * Represents a query result where the raw data is received in multiple batches.
 * This class implements `WritableQueryResult` to allow appending byte arrays
 * as they become available. It's useful for handling large query results
 * that are streamed or processed in chunks, providing a mechanism to wait
 * until all batches have been received before further processing.
 */
export class RawDataQueryResult implements WritableQueryResult {
  batches: Uint8Array[] = [];
  private lastBatchReceived = false;
  private resolveAllBatches:
    | ((value: void | PromiseLike<void>) => void)
    | undefined;
  private readonly allBatchesPromise = new Promise<void>((resolve) => {
    this.resolveAllBatches = resolve;
  });

  waitAllBatches(): Promise<RawDataQueryResult> {
    return this.allBatchesPromise.then(() => {
      return this;
    });
  }

  appendResultBatch(resBytes: Uint8Array): void {
    this.batches.push(resBytes);
    // We need to do enough decoding to determine if this is the last batch
    const reader = protobuf.Reader.create(resBytes);
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

  isComplete(): boolean {
    return this.lastBatchReceived;
  }

  private extractIsLastBatch(batchBytes: Uint8Array) {
    const reader = protobuf.Reader.create(batchBytes);
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

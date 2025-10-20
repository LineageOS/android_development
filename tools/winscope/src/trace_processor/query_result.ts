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

/**
 * Represents the possible data types for a column in a query result.
 * It can be a string, number, bigint, null, or a Uint8Array for binary data.
 */
export declare type ColumnType = string | number | bigint | Uint8Array;

/**
 * Defines the structure of a single row in a query result, where each key
 * is a column name and the value is of a type defined by `ColumnType`.
 */
export declare interface Row {
  [key: string]: ColumnType | null;
}

/**
 * An iterator for traversing rows in a query result.
 */
export declare interface RowIterator {
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
export declare interface QueryResults<T> {
  /**
   * The result of a query for a node range.
   */
  nodeRange: T;

  /**
   * The result of a query for a snapshot range.
   */
  snapshotRange: T | undefined;

  /**
   * The result of a query for all visible rectangles, or undefined if not available.
   */
  allVisibleRects: QueryResult | undefined;

  /**
   * The result of a query for all snapshots, or undefined if not available.
   */
  allSnapshots: T | undefined;
}

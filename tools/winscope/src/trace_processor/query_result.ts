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

export type ColumnType = string | number | bigint | null | Uint8Array;

export interface Row {
  [key: string]: ColumnType;
}

export interface RowIterator {
  valid(): boolean;
  next(): void;
  get(columnName: string): ColumnType;
}

export interface QueryResult {
  numRows(): number;
  columns(): string[];
  iter<T extends Row>(spec: T): RowIterator;
  firstRow<T extends Row>(spec: T): T;
}

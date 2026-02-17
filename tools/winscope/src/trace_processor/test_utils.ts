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

import {assertDefined} from '@common/assert';
import {Timestamp} from '@common/time/time';

import {ColumnType, QueryResult, RowIterator} from './query_result';
import {TraceProcessorFactory} from './trace_processor_factory';

/**
 * Creates Jasmine spy objects for `QueryResult` and `RowIterator` to mock the
 * results of a trace processor search query.
 * @param ts Optional timestamp to include in the mock results.
 * @param value Optional value to include in the mock results.
 * @return A tuple containing the `QueryResult` spy and the `RowIterator` spy.
 */
export function makeSearchTraceSpies(
  ts?: Timestamp,
  additionalColumns: {[key: string]: ColumnType | null} = {},
): [jasmine.SpyObj<QueryResult>, jasmine.SpyObj<RowIterator>] {
  const spyQueryResult = jasmine.createSpyObj<QueryResult>('result', [
    'numRows',
    'columns',
    'iter',
  ]);
  spyQueryResult.numRows.and.returnValue(1);
  const columns: string[] = [];
  if (ts !== undefined) columns.push('ts', 'ts_other');
  columns.push('property');
  columns.push(...Object.keys(additionalColumns));
  spyQueryResult.columns.and.returnValue(columns);

  const spyIter = jasmine.createSpyObj<RowIterator>('iter', [
    'valid',
    'next',
    'get',
  ]);
  if (ts !== undefined) {
    spyIter.get.withArgs('ts').and.returnValue(ts.getValueNs());
    spyIter.get.withArgs('ts_other').and.returnValue(ts.getValueNs() + 100n);
  }
  spyIter.get.withArgs('property').and.returnValue('test_property');
  Object.entries(additionalColumns).forEach(([col, val]) => {
    spyIter.get.withArgs(col).and.returnValue(val);
  });

  spyIter.valid.and.returnValue(true);
  spyIter.next.and.callFake(() =>
    assertDefined(spyIter).valid.and.returnValue(false),
  );
  spyQueryResult.iter.and.returnValue(spyIter);

  return [spyQueryResult, spyIter];
}

/**
 * Runs a trace processor query using the singleton `TraceProcessorFactory`.
 * @param query The query string to execute.
 * @return A Promise resolving to the `QueryResult`.
 */
export async function runQueryAndGetResult(
  query: string,
): Promise<QueryResult> {
  const tp = TraceProcessorFactory.getSingleInstance();
  return tp.query(query);
}

export function makeSpyQueryResult(
  iter?: jasmine.SpyObj<RowIterator>,
): jasmine.SpyObj<QueryResult> {
  const qr = jasmine.createSpyObj<QueryResult>('result', [
    'numRows',
    'iter',
    'firstRow',
  ]);
  if (iter) {
    qr.iter.and.returnValue(iter);
  }
  return qr;
}

/**
 * Sets the number of rows returned by a `QueryResult` spy's `numRows` method.
 * @param rows The number of rows to return.
 * @param spyQueryResult Optional existing `QueryResult` spy. If not provided, a
 *     new one is created.
 * @return The `QueryResult` spy with `numRows` configured.
 */
export function setNumRowsSpyQueryResult(
  rows: number,
  spyQueryResult?: jasmine.SpyObj<QueryResult>,
): jasmine.SpyObj<QueryResult> {
  const spy = spyQueryResult ?? makeSpyQueryResult();
  spy.numRows.and.returnValue(rows);
  return spy;
}

/**
 * Creates a basic Jasmine spy object for `RowIterator`.
 * The iterator is initially valid and becomes invalid after the first call to
 * `next`.
 * @return A Jasmine spy object for `RowIterator`.
 */
export function makeSpyRowIterator(): jasmine.SpyObj<RowIterator> {
  const iter = jasmine.createSpyObj<RowIterator>('row', [
    'get',
    'valid',
    'next',
  ]);
  iter.valid.and.returnValue(true);
  iter.next.and.callFake(() => iter.valid.and.returnValue(false));
  return iter;
}

/**
 * Configures a `RowIterator` spy to simulate iterating through a provided array
 * of row data.
 * @param iter The `RowIterator` spy to configure.
 * @param rows An array of objects, where each object represents a row and keys
 *     are column names.
 */
export function setupMockIteratorWithRows(
  iter: jasmine.SpyObj<RowIterator>,
  rows: Array<{[key: string]: ColumnType | null}>,
) {
  let currentRow = 0;
  iter.valid.and.callFake(() => currentRow < rows.length);
  iter.next.and.callFake(() => {
    currentRow++;
  });
  iter.get.and.callFake((key: string) => {
    if (currentRow >= rows.length) {
      throw new Error(
        `Attempted to 'get' on an invalid row index: ${currentRow}`,
      );
    }
    const rowData = rows[currentRow];
    return rowData ? rowData[key] : null;
  });
}

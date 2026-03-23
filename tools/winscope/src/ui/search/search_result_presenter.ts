/*
 * Copyright (C) 2024 The Android Open Source Project
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

import {MakeTimestampStrategyType, Timestamp} from '@common/time/time';
import {Trace, TraceEntry} from '@trace_api/trace';
import {ColumnType, QueryResult, RowIterator,} from '@trace_processor/query_result';
import {AbstractLogViewerPresenter, NotifyLogViewCallbackType,} from '@ui/shared/log/abstract_log_viewer_presenter';
import {LogPresenter} from '@ui/shared/log/log_presenter';
import {LogEntry, LogField, LogFieldValue, LogHeader,} from '@ui/shared/log/ui_data_log';

import {SearchResult} from './ui_data';

export class SearchResultPresenter extends AbstractLogViewerPresenter<
  SearchResult,
  QueryResult
> {
  protected override logPresenter = new LogPresenter<LogEntry>();
  constructor(
    trace: Trace<QueryResult>,
    notifyViewCallback: NotifyLogViewCallbackType<SearchResult>,
    private readonly makeTimestampStrategy: MakeTimestampStrategyType,
    private readonly queryResult?: QueryResult,
  ) {
    super(trace, notifyViewCallback, new SearchResult([], []));
  }

  override onDestroy() {
    // Until Presenter is garbage collected it may still receive events
    // so we must make sure it can no longer affect ui data
    this.notifyViewChanged = () => {};
  }

  protected override makeHeaders(): LogHeader[] {
    return (
      this.queryResult?.columns().map((colName) => {
        return new LogHeader({name: colName, cssClass: 'search-result'});
      }) ?? []
    );
  }

  protected override async makeUiDataEntries(
    headers: LogHeader[],
  ): Promise<LogEntry[]> {
    if (!this.queryResult || this.trace.lengthEntries === 0) {
      return [];
    }
    const entry = this.trace.getEntry(0);
    const hasTimestamps = !this.trace.isDumpWithoutTimestamp();
    const entries: LogEntry[] = [];
    let i = 0;
    for (const it = this.queryResult.iter({}); it.valid(); it.next()) {
      entries.push(
        this.makeLogEntry(
          headers,
          it,
          i,
          hasTimestamps ? this.trace.getEntry(i) : entry,
        ),
      );
      i++;
    }
    return entries;
  }

  private makeLogEntry(
    headers: LogHeader[],
    it: RowIterator,
    entryIndex: number,
    traceEntry: TraceEntry<QueryResult>,
  ): LogEntry {
    const fields: LogField[] = [];
    for (const header of headers) {
      const column = header.spec.name;
      const value = it.get(column);
      const fieldValue =
        this.tryMakeTsFieldValue(column, value, entryIndex, headers, it) ??
        this.convertToLogFieldValue(value);
      fields.push(new LogField(header.spec, fieldValue));
    }
    return {
      traceEntry,
      fields,
      getPropertiesTree: undefined,
    };
  }

  private tryMakeTsFieldValue(
    columnName: string,
    value: ColumnType | null | undefined,
    entryIndex: number,
    headers: LogHeader[],
    it: RowIterator,
  ): Timestamp | undefined {
    return (
      this.tryMakeTraceEntryTs(columnName, entryIndex) ??
      this.tryMakePropertyValueTs(columnName, value, headers, it) ??
      this.tryMakeColumnTs(columnName, value)
    );
  }

  private tryMakeTraceEntryTs(
    columnName: string,
    entryIndex: number,
  ): Timestamp | undefined {
    // Assume that the 'ts' column is meant to represent trace entry timestamps.
    if (columnName !== 'ts') {
      return undefined;
    }
    const entry = this.trace.getEntry(entryIndex);
    if (!entry.hasValidTimestamp()) {
      return undefined;
    }
    return entry.getTimestamp();
  }

  private tryMakePropertyValueTs(
    columnName: string,
    value: ColumnType | null | undefined,
    headers: LogHeader[],
    it: RowIterator,
  ): Timestamp | undefined {
    // For search views, if the 'property' column value indicates the field may
    // be a timestamp, try to convert the 'value' column value to a timestamp.
    if (columnName !== 'value') {
      return undefined;
    }
    const propertyHeader = headers.find((h) => h.spec.name === 'property');
    if (!propertyHeader) {
      return undefined;
    }
    const property = it.get(propertyHeader.spec.name);
    if (typeof property !== 'string' || !property.endsWith('time_ns')) {
      return undefined;
    }
    return this.tryMakeTs(value);
  }

  private tryMakeColumnTs(
    columnName: string,
    value: ColumnType | null | undefined,
  ): Timestamp | undefined {
    // For general queries, if the column name starts with 'ts' or ends with 'time_ns',
    // try to convert its value to a timestamp.
    if (!columnName.startsWith('ts') && !columnName.endsWith('time_ns')) {
      return undefined;
    }
    return this.tryMakeTs(value);
  }

  private tryMakeTs(value: ColumnType | null | undefined) {
    const numberValue = Number(value);
    if (isNaN(numberValue) || numberValue <= 0) {
      return undefined;
    }
    return this.makeTimestampStrategy(BigInt(numberValue));
  }

  private convertToLogFieldValue(value: ColumnType | null): LogFieldValue {
    if (value === null) {
      return 'NULL';
    }
    if (typeof value === 'bigint') {
      return Number(value);
    }
    if (value instanceof Uint8Array) {
      return '[]';
    }
    return value;
  }
}

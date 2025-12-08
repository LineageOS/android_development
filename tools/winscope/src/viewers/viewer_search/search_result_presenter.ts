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

import {MakeTimestampStrategyType} from 'common/time/time';
import {Trace, TraceEntry} from 'trace_api/trace';
import {
  ColumnType,
  QueryResult,
  RowIterator,
} from 'trace_processor/query_result';
import {
  AbstractLogViewerPresenter,
  NotifyLogViewCallbackType,
} from 'viewers/common/abstract_log_viewer_presenter';
import {LogPresenter} from 'viewers/common/log_presenter';
import {
  LogEntry,
  LogField,
  LogFieldValue,
  LogHeader,
} from 'viewers/common/ui_data_log';
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

  onDestroy() {
    // until presenter is garbage collected it may still receive events
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
    i: number,
    traceEntry: TraceEntry<QueryResult>,
  ): LogEntry {
    const fields: LogField[] = [];
    for (const header of headers) {
      const value = it.get(header.spec.name);
      const fieldValue =
        this.tryMakeEntryTsFieldValue(header, i) ??
        this.tryMakeTsFieldValue(headers, it, header, value) ??
        this.convertToLogFieldValue(value);
      fields.push({
        spec: header.spec,
        value: fieldValue,
      });
    }
    return {
      traceEntry,
      fields,
      getPropertiesTree: undefined,
    };
  }

  private tryMakeEntryTsFieldValue(
    header: LogHeader,
    entryIndex: number,
  ): LogFieldValue | undefined {
    if (header.spec.name === 'ts') {
      const entry = this.trace.getEntry(entryIndex);
      if (entry.hasValidTimestamp()) {
        return entry.getTimestamp();
      }
    }
    return undefined;
  }

  private tryMakeTsFieldValue(
    headers: LogHeader[],
    it: RowIterator,
    header: LogHeader,
    value: ColumnType | undefined,
  ): LogFieldValue | undefined {
    if (
      header.spec.name === 'value' &&
      typeof value === 'string' &&
      Number(value)
    ) {
      const propertyHeader = headers.find((h) => h.spec.name === 'property');
      if (propertyHeader) {
        const property = it.get(propertyHeader.spec.name);
        if (typeof property === 'string' && property.endsWith('time_ns')) {
          return this.makeTimestampStrategy(BigInt(value));
        }
      }
    }
    if (
      header.spec.name.startsWith('ts') &&
      (typeof value === 'number' || typeof value === 'bigint') &&
      value > 0
    ) {
      return this.makeTimestampStrategy(BigInt(value));
    }
    return undefined;
  }

  private convertToLogFieldValue(value: ColumnType): LogFieldValue {
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

/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {NOT_IMPLEMENTED_ERROR} from '@common/errors';
import {Timestamp} from '@common/time/time';
import {CoarseVersion} from '@trace_api/coarse_version';
import {CustomQueryParamTypeMap, CustomQueryParserResultTypeMap, CustomQueryType,} from '@trace_api/custom_query';
import {AbsoluteEntryIndex, EntriesRange} from '@trace_api/index_types';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';
import {QueryResult, QueryResults} from '@trace_processor/query_result';
import {RawDataQueryResult} from '@trace_processor/raw_data_query_result';

/**
 * A mock implementation of the Parser interface.
 *
 * This class is used in tests to simulate the behavior of a real trace parser
 * without needing to load and parse actual trace files. It allows tests to
 * inject predefined data (timestamps, entries, custom query results) and
 * control certain behaviors, such as simulating corrupted traces or traces
 * without time offsets. This makes unit testing components that depend on
 * a `Parser` more predictable and efficient.
 */
export class ParserMock<T> implements Parser<T> {
  constructor(
    private readonly type: TraceType,
    private readonly timestamps: Timestamp[],
    private readonly entries: T[],
    private readonly customQueryResult: Map<
      CustomQueryType,
      Map<CustomQueryParamTypeMap[CustomQueryType], object>
    >,
    private readonly descriptors: string[],
    private readonly isCorrupted: boolean,
  ) {
    if (timestamps.length !== entries.length) {
      throw new Error(`Timestamps and entries must have the same length`);
    }
  }

  onDestroy() {
    // do nothing
  }

  getTraceType(): TraceType {
    return this.type;
  }

  getLengthEntries(): number {
    return this.entries.length;
  }

  getCoarseVersion(): CoarseVersion {
    return CoarseVersion.MOCK;
  }

  getTimestamps(): Timestamp[] {
    return this.timestamps;
  }

  getEntry(index: AbsoluteEntryIndex): Promise<T> {
    if (this.isCorrupted) throw new Error('Corrupted trace');
    return Promise.resolve(this.entries[index]);
  }

  getAllEntries(): Promise<T[]> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  getRangeOfEntries(_: EntriesRange): Promise<T[]> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  getQueryResults(
    _: EntriesRange,
  ): Promise<QueryResults<QueryResult | RawDataQueryResult>> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  customQuery<Q extends CustomQueryType>(
    type: Q,
    entriesRange: EntriesRange,
    param?: CustomQueryParamTypeMap[Q],
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    const resultMap = this.customQueryResult.get(type);
    let result =
      (param ? resultMap?.get(param) : undefined) ??
      resultMap?.values().next().value;
    if (result === undefined) {
      throw new Error(
        `This mock was not configured to support custom query type '${type}' with param ${param}. Something missing in your test set up?`,
      );
    }
    if (
      type !== CustomQueryType.SF_LAYERS_ID_AND_NAME &&
      Array.isArray(result)
    ) {
      result = result.slice(entriesRange.start, entriesRange.end);
    }
    return Promise.resolve(result) as Promise<
      CustomQueryParserResultTypeMap[Q]
    >;
  }

  isPerfetto(): boolean {
    return true;
  }

  getDescriptors(): string[] {
    return this.descriptors;
  }
}

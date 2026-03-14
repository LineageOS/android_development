/*
 * Copyright (C) 2026 The Android Open Source Project
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
import {CustomQueryParserResultTypeMap, CustomQueryType,} from '@trace_api/custom_query';
import {AbsoluteEntryIndex, EntriesRange} from '@trace_api/index_types';
import {Parser} from '@trace_api/parser';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';
import {QueryResult, QueryResults} from '@trace_processor/query_result';
import {RawDataQueryResult} from '@trace_processor/raw_data_query_result';

import {TestFileReader} from './test_file_reader';

/**
 * A test implementation of the FileReader and Parser interfaces.
 *
 * This class is used in tests to simulate the behavior of a real file reader
 * and parser without needing to load and parse actual trace files.
 */
export class TestFileReaderAndParser
  extends TestFileReader
  implements Parser<unknown>
{
  constructor(
    type: TraceType,
    timestamps: Timestamp[],
    descriptors: string[],
    traceFile: TraceFile,
    private readonly isPerfettoTrace: boolean,
  ) {
    super(type, timestamps, descriptors, false, traceFile);
  }

  onDestroy() {
    // do nothing
  }

  getCoarseVersion(): CoarseVersion {
    return CoarseVersion.MOCK;
  }

  getEntry(_: AbsoluteEntryIndex): Promise<unknown> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  getAllEntries(): Promise<unknown[]> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  getRangeOfEntries(_: EntriesRange): Promise<unknown[]> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  getQueryResults(
    _: EntriesRange,
  ): Promise<QueryResults<QueryResult | RawDataQueryResult>> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  customQuery<Q extends CustomQueryType>(
    _: Q,
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  isPerfetto(): boolean {
    return this.isPerfettoTrace;
  }
}

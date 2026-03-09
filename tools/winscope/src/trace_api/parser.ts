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

import {Timestamp} from '@common/time/time';
import {QueryResult, QueryResults} from '@trace_processor/query_result';
import {RawDataQueryResult} from '@trace_processor/raw_data_query_result';
import {RectsForTrace} from '@tree_node/rect_extractor_result';

import {CoarseVersion} from './coarse_version';
import {CustomQueryParamTypeMap, CustomQueryParserResultTypeMap, CustomQueryType,} from './custom_query';
import {AbsoluteEntryIndex, EntriesRange} from './index_types';
import {TraceType} from './trace_type';

/**
 * Interface for a trace parser.
 *
 * This interface defines the methods required to parse and interact with a specific trace format.
 * It provides access to trace entries, timestamps, version information, and allows for custom queries.
 *
 * @template T The type of the individual trace entries parsed by this interface.
 */
export interface Parser<T> {
  getCoarseVersion(): CoarseVersion;
  getTraceType(): TraceType;
  getLengthEntries(): number;
  getTimestamps(): Timestamp[];
  getEntry(index: AbsoluteEntryIndex): Promise<T>;
  getRangeOfEntries(
    entriesRange: EntriesRange,
    precomputedQuery?: QueryResults<QueryResult>,
  ): Promise<T[]>;
  getAllEntries(): Promise<Array<T | undefined>>;
  getQueryResults(
    entriesRange: EntriesRange,
    queryRawData: boolean,
  ): Promise<QueryResults<QueryResult | RawDataQueryResult>>;
  customQuery<Q extends CustomQueryType>(
    type: Q,
    entriesRange: EntriesRange,
    param?: CustomQueryParamTypeMap[Q],
  ): Promise<CustomQueryParserResultTypeMap[Q]>;
  getDescriptors(): string[];
  isPerfetto(): boolean;
  getRectsMap?(): Promise<RectsForTrace | undefined>;
  onDestroy(): void;
}

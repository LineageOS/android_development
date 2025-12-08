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

import {NOT_IMPLEMENTED_ERROR} from 'common/errors';
import {Timestamp} from 'common/time/time';
import {ParserTimestampConverter} from 'common/time/timestamp_converter';
import {CoarseVersion} from 'trace_api/coarse_version';
import {
  CustomQueryParamTypeMap,
  CustomQueryParserResultTypeMap,
  CustomQueryType,
} from 'trace_api/custom_query';
import {AbsoluteEntryIndex, EntriesRange} from 'trace_api/index_types';
import {Parser} from 'trace_api/parser';
import {TraceType} from 'trace_api/trace_type';

/**
 * A parser that processes and merges multiple traces of different types.
 */
export abstract class AbstractTracesParser<T> implements Parser<T> {
  protected timestamps: Timestamp[] | undefined;
  protected timestampConverter: ParserTimestampConverter;

  constructor(timestampConverter: ParserTimestampConverter) {
    this.timestampConverter = timestampConverter;
  }

  customQuery<Q extends CustomQueryType>(
    type: Q,
    entriesRange: EntriesRange,
    param?: CustomQueryParamTypeMap[Q],
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  isPerfetto(): boolean {
    return false;
  }

  getTimestamps(): Timestamp[] | undefined {
    return this.timestamps;
  }

  canConvertToPerfetto(): boolean {
    return false;
  }

  getAllEntries(): Promise<Array<T | undefined>> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  getRangeOfEntries(entriesRange: EntriesRange): Promise<Array<T | undefined>> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  abstract getCoarseVersion(): CoarseVersion;
  abstract parse(): Promise<void>;
  abstract createTimestamps(): Promise<void>;
  abstract getDescriptors(): string[];
  abstract getTraceType(): TraceType;
  abstract getEntry(index: AbsoluteEntryIndex): Promise<T>;
  abstract getLengthEntries(): number;
  abstract getRealToMonotonicTimeOffsetNs(): bigint | undefined;
  abstract getRealToBootTimeOffsetNs(): bigint | undefined;
}

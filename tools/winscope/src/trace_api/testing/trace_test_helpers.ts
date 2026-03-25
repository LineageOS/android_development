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
import {CustomQueryParamTypeMap, CustomQueryParserResultTypeMap, CustomQueryType,} from '@trace_api/custom_query';
import {AbsoluteFrameIndex} from '@trace_api/index_types';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';

import {TraceBuilder} from './trace_builder';

/**
 * Extracts all entries from a trace.
 *
 * This utility function is useful in tests to easily obtain all the underlying
 * data values from a `Trace` object without dealing with individual `TraceEntry`
 * objects.
 * @param trace The trace to extract entries from.
 * @return A promise that resolves to an array containing all trace entry values.
 */
export async function extractEntries<T>(trace: Trace<T>): Promise<T[]> {
  const promises = trace.mapEntry(async (entry) => {
    return await entry.getValue();
  });
  return await Promise.all(promises);
}

/**
 * Extracts all timestamps from a trace.
 *
 * This function provides a convenient way to get all timestamps present in a
 * trace, which is often needed for test assertions or setup.
 * @param trace The trace to extract timestamps from.
 * @return An array of `Timestamp` objects.
 */
export function extractTimestamps<T>(trace: Trace<T>): Timestamp[] {
  const timestamps = new Array<Timestamp>();
  trace.forEachTimestamp((timestamp) => {
    timestamps.push(timestamp);
  });
  return timestamps;
}

/**
 * Extracts all frames from a trace, mapping each frame index to its entries.
 *
 * This is useful for tests that need to verify the content of each frame within
 * a trace, providing a map from `AbsoluteFrameIndex` to an array of entries
 * within that frame.
 * @param trace The trace to extract frames from.
 * @return A promise that resolves to a Map where keys are frame indices and values are arrays of entries.
 */
export async function extractFrames<T>(
  trace: Trace<T>,
): Promise<Map<AbsoluteFrameIndex, T[]>> {
  const frames = new Map<AbsoluteFrameIndex, T[]>();
  const promises = trace.mapFrame(async (frame, index) => {
    frames.set(index, await extractEntries(frame));
  });
  await Promise.all(promises);
  return frames;
}

/**
 * Creates an empty `Trace` object of a specified type.
 *
 * This function simplifies the creation of empty or minimal trace objects for
 * testing purposes, allowing tests to focus on specific behaviors without
 * needing a fully populated trace. It can also include custom query results.
 * @param traceType The type of the trace.
 * @param descriptors Optional descriptors for the trace.
 * @param parserCustomQueryResult Optional custom query results to include in the trace.
 * @return An empty `Trace` instance.
 */
export function makeEmptyTrace<T>(
  traceType: TraceType,
  descriptors: string[] = [],
  parserCustomQueryResult: Array<{
    queryType: CustomQueryType;
    result: CustomQueryParserResultTypeMap[CustomQueryType];
    param?: CustomQueryParamTypeMap[CustomQueryType];
  }> = [],
): Trace<T> {
  const builder = new TraceBuilder<T>()
    .setEntries([])
    .setTimestamps([])
    .setDescriptors(descriptors)
    .setType(traceType);

  for (const {queryType, result, param} of parserCustomQueryResult) {
    builder.setParserCustomQueryResult(queryType, result, param);
  }

  return builder.build();
}

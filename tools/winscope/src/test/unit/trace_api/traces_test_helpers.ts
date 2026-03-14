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

import {AbsoluteFrameIndex} from '@trace_api/index_types';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';

import {extractEntries as extractTraceEntries} from './trace_test_helpers';

/**
 * Extracts all traces from a Traces object.
 *
 * @param traces The Traces object to extract traces from.
 * @return An array of Trace objects.
 */
export function extractTraces(traces: Traces): Array<Trace<unknown>> {
  return traces.mapTrace((trace) => trace);
}

/**
 * Extracts all entries from a Traces object.
 *
 * @param traces The Traces object to extract entries from.
 * @return A map of TraceType to an array of entries.
 */
export async function extractEntries(
  traces: Traces,
): Promise<Map<TraceType, unknown[]>> {
  const traceEntries: Array<[TraceType, unknown[]]> = await Promise.all(
    traces.mapTrace(async (trace) => {
      return [trace.type, await extractTraceEntries(trace)];
    }),
  );
  return new Map<TraceType, unknown[]>(traceEntries);
}

/**
 * Extracts all frames from a Traces object.
 *
 * @param traces The Traces object to extract frames from.
 * @return A map of frame index to a map of TraceType to an array of entries.
 */
export async function extractFrames(
  traces: Traces,
): Promise<Map<AbsoluteFrameIndex, FrameMap>> {
  const frames: Array<[AbsoluteFrameIndex, FrameMap]> = await Promise.all(
    traces.mapFrame(async (frame, index) => {
      const frameEntries = await extractEntries(frame);
      return [index, frameEntries];
    }),
  );
  return new Map<AbsoluteFrameIndex, FrameMap>(frames);
}

type FrameMap = Map<TraceType, unknown[]>;

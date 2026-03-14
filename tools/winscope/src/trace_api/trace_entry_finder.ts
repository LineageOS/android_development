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

import {analyticsLogEvent} from '@common/analytics';
import {getLogger} from '@compat/logging';

import {Trace, TraceEntry} from './trace';
import {TracePosition} from './trace_position';
import {compareByUiPipelineOrder} from './trace_type';

/**
 * Finds the trace entry in the provided trace that best corresponds to the given trace position.
 * The method uses different strategies to find the corresponding entry based on the trace type,
 * frame information, and timestamp.
 *
 * @param trace The trace to search within.
 * @param position The trace position to find the corresponding entry for.
 * @return The corresponding trace entry, or undefined if no suitable entry is found.
 */
export function findCorrespondingEntry<T>(
  trace: Trace<T>,
  position: TracePosition,
): TraceEntry<T> | undefined {
  if (trace.lengthEntries === 0) {
    return undefined;
  }

  if (trace.isDump()) {
    // always display dumps regardless of the current trace position
    return trace.getEntry(0);
  }

  if (position.entry?.getFullTrace() === trace.getEntry(0).getFullTrace()) {
    return position.entry as TraceEntry<T>;
  }

  if (position.frame !== undefined && trace.hasFrameInfo()) {
    try {
      const frame = trace.getFrame(position.frame);
      if (frame.lengthEntries > 0) {
        return frame.getEntry(0);
      }
    } catch (e) {
      const message = (e as Error).message;
      getLogger('trace_entry_finder').warn(
        `Could not retrieve frame: ${message}`,
      );
      analyticsLogEvent('frame_map_error', {
        message,
      });
    }
  }

  if (position.entry) {
    const entryTraceType = position.entry.getFullTrace().type;
    const timestamp = position.entry.getTimestamp();
    if (compareByUiPipelineOrder(entryTraceType, trace.type)) {
      return (
        trace.findFirstGreaterEntry(timestamp) ??
        trace.findFirstGreaterOrEqualEntry(timestamp)
      );
    } else {
      return (
        trace.findLastLowerEntry(timestamp) ??
        trace.findLastLowerOrEqualEntry(timestamp)
      );
    }
  }

  return trace.findLastLowerOrEqualEntry(position.timestamp);
}

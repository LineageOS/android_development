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

/**
 * Metadata associated with a trace. Contains information needed to synchronize
 * and interpret the trace data.
 */
export declare interface TraceMetadata {
  /**
   * Offsets required to synchronize screen recording timestamps with the
   * trace's elapsed time base.
   */
  screenRecordingOffsets?: ScreenRecordingOffsets;
}

/**
 * Contains timestamps and offsets necessary to align screen recording
 * timestamps with the trace's elapsed time base. This allows converting
 * between real time (often used by screen recordings) and elapsed time
 * (often used by other traces).
 */
export declare interface ScreenRecordingOffsets {
  /**
   * The elapsed real time in nanoseconds at a specific point.
   */
  elapsedRealTimeNanos: bigint;
  /**
   * The offset to convert from real time to elapsed time.
   * The relationship is: `elapsedTime = realTime - realToElapsedTimeOffsetNanos`.
   */
  realToElapsedTimeOffsetNanos: bigint;
}

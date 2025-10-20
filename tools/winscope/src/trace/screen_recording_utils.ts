/*
 * Copyright (C) 2022 The Android Open Source Project
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

/*
 * Video time correction epsilon. Without correction, we could display the previous frame.
 * This correction was already present in the legacy Winscope.
 */
const EPSILON_SECONDS = 0.00001;

/**
 * Converts a timestamp from nanoseconds to seconds, relative to a starting timestamp.
 * This function is used to calculate the corresponding time in a screen recording
 * video for a given trace timestamp.
 *
 * An `EPSILON_SECONDS` is added to the calculated time. This correction is essential
 * to prevent displaying the previous video frame when seeking. Without it,
 * slight precision issues or video player behavior could cause the frame
 * *before* the desired timestamp to be shown instead of the correct one.
 * This ensures that seeking to a specific trace time correctly displays the
 * video frame at or after that time.
 *
 * @param firstTimestampNs The starting timestamp in nanoseconds (e.g., the timestamp of the first frame).
 * @param currentTimestampNs The current timestamp in nanoseconds to convert.
 * @return The video time in seconds.
 */
export function timestampToVideoTimeSeconds(
  firstTimestampNs: bigint,
  currentTimestampNs: bigint,
) {
  const videoTimeSeconds =
    Number(currentTimestampNs - firstTimestampNs) / 1000000000 +
    EPSILON_SECONDS;
  return videoTimeSeconds;
}

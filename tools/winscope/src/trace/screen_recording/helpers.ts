/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {createFile, FileInfo, MP4ArrayBuffer, MP4File} from 'mp4box';

/**
 * Callback to parse an MP4 for an arbitrary purpose.
 * @param info File info parsed by mp4box
 * @param mp4File MP4File parsed by mp4box
 * @param resolve To be called when all timestamps are retrieved
 */
export type MP4FileOnReady = (
  info: FileInfo,
  mp4File: MP4File,
  resolve: (value: void | PromiseLike<void>) => void,
) => void;

/**
 * Data required for WebCodecs manipulation.
 */
export interface WebCodecData {
  chunks: EncodedVideoChunk[];
  config: VideoDecoderConfig;
  duration: number;
  rotationAngle: number;
}

/**
 * Parses an MP4 file using mp4box.
 * @param videoData File data
 * @param onReady Callback to parse data
 */
export async function parseMp4(videoData: Uint8Array, onReady: MP4FileOnReady) {
  const arrayBuffer = videoData.buffer.slice(
    videoData.byteOffset,
    videoData.byteLength + videoData.byteOffset,
  );
  // There's an export issue with the createFile alias for TypeScript (1.5.0 - Jun 2025)
  // It fails with the error below, use this as a bypass until the library is fixed.
  // ERROR in src/parsers/screen_recording/parser_screen_recording.ts:288:48
  // - error TS2554: Expected 0 arguments, but got 2.
  const createFileAny = createFile as any;
  const mp4File: MP4File = createFileAny(true, undefined);
  await new Promise<void>((resolve) => {
    mp4File.onReady = (info) => onReady(info, mp4File, resolve);
    const buffer = arrayBuffer as MP4ArrayBuffer;
    buffer.fileStart = 0;
    mp4File.appendBuffer(buffer);
    mp4File.start();
  });
}

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

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

/**
 * Represents a single entry in a media-based trace, such as a video or image sequence.
 * Each entry contains media data (a video frame or an image) and the timestamp
 * within the video timeline. This is useful for synchronizing trace events with
 * visual media, allowing users to see what was happening on screen at a specific
 * point in the trace.
 */
export class MediaBasedTraceEntry {
  /**
   * @param videoTimeSeconds The timestamp in seconds within the video timeline.
   * @param videoData The raw media data as a Blob (e.g., a video frame or an image).
   * @param isImage True if the media data is an image, false if it's part of a video.
   */
  constructor(
    /** The timestamp in seconds within the video timeline. */
    public videoTimeSeconds: number,
    /** The raw media data as a Blob (e.g., a video frame or an image). */
    public videoData: Blob,
    /** True if the media data is an image, false if it's part of a video. */
    public isImage = false,
  ) {}
}

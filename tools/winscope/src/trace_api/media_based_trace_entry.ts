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
import {assertDefined} from 'common/assert';

/**
 * Represents a single entry in a media-based trace, such as a video or image sequence.
 * Each entry contains media data for a video frame or an image.
 */
export class MediaBasedTraceEntry {
  /**
   * @param imgData The raw image data as a Blob (for images).
   * @param videoFrame The decoded frame to be visualised (for videos).
   * @param videoRotationAngle The rotation angle for the video frame if provided.
   */
  constructor(
    /**  Defined if the media data is an image. */
    readonly imgData?: Blob,
    /** Defined if the media data is a video. */
    readonly videoFrame?: VideoFrame,
    /** Gives rotation angle for video frame. */
    readonly videoRotationAngle = 0,
  ) {}

  shouldFlipDimensions(): boolean {
    return this.videoRotationAngle % 180 !== 0;
  }

  yOffset(): number {
    if (this.videoRotationAngle === 90 || this.videoRotationAngle === 180) {
      return -assertDefined(this.videoFrame).codedHeight;
    }
    return 0;
  }

  xOffset(): number {
    if (this.videoRotationAngle === 180 || this.videoRotationAngle === 270) {
      return -assertDefined(this.videoFrame).codedWidth;
    }
    return 0;
  }
}

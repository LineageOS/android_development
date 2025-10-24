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
import {Size} from 'common/geometry/size';

/**
 * Represents a single entry in a media-based trace, such as a video or image sequence.
 * Each entry contains media data for a video frame or an image.
 */
export class MediaBasedTraceEntry {
  /**
   * @param imgData The raw image data as a Blob (for images).
   * @param videoFrame The decoded frame to be visualized (for videos).
   * @param videoRotationAngle The rotation angle for the video frame if provided.
   */
  constructor(
    /**  Defined if the media data is an image. */
    readonly imgData?: Blob,
    /** Defined if the media data is a video. */
    readonly videoFrame?: VideoFrame,
    /** Gives rotation angle for video frame. */
    private readonly videoRotationAngle = 0,
  ) {}

  tryDrawOnCanvas(canvas: HTMLCanvasElement) {
    if (!this.videoFrame) {
      return;
    }

    const ctx = assertDefined(canvas.getContext('2d'));

    const canvasDimensions = this.canvasDimensions(this.videoFrame);
    canvas.width = canvasDimensions.width;
    canvas.height = canvasDimensions.height;

    ctx.rotate(this.rotationAngleRadians());

    ctx.drawImage(
      this.videoFrame,
      this.xOffset(this.videoFrame),
      this.yOffset(this.videoFrame),
      this.videoFrame.codedWidth,
      this.videoFrame.codedHeight,
    );

    ctx.resetTransform();
  }

  private canvasDimensions(videoFrame: VideoFrame): Size {
    if (this.shouldFlipDimensions()) {
      return {
        width: videoFrame.codedHeight,
        height: videoFrame.codedWidth,
      };
    }
    return {
      width: videoFrame.codedWidth,
      height: videoFrame.codedHeight,
    };
  }

  private shouldFlipDimensions(): boolean {
    return this.videoRotationAngle % 180 !== 0;
  }

  private yOffset(videoFrame: VideoFrame): number {
    if (this.videoRotationAngle === 90 || this.videoRotationAngle === 180) {
      return -videoFrame.codedHeight;
    }
    return 0;
  }

  private xOffset(videoFrame: VideoFrame): number {
    if (this.videoRotationAngle === 180 || this.videoRotationAngle === 270) {
      return -videoFrame.codedWidth;
    }
    return 0;
  }

  private rotationAngleRadians() {
    return (this.videoRotationAngle * Math.PI) / 180;
  }
}

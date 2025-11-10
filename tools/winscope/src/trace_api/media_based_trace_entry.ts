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
   * @param image The image bitmap to be visualized.
   * @param videoRotationAngle The rotation angle for the video frame if provided.
   */
  constructor(
    /** Defined if the media data is a video. */
    readonly image: ImageBitmap,
    /** Gives rotation angle for video frame. */
    private readonly videoRotationAngle = 0,
  ) {}

  tryDrawOnCanvas(canvas: HTMLCanvasElement) {
    const canvasDimensions = this.canvasDimensions(this.image);
    canvas.width = canvasDimensions.width;
    canvas.height = canvasDimensions.height;

    const ctx = assertDefined(canvas.getContext('2d'));
    ctx.rotate(this.rotationAngleRadians());
    ctx.drawImage(
      this.image,
      this.xOffset(this.image),
      this.yOffset(this.image),
      this.image.width,
      this.image.height,
    );
    ctx.resetTransform();
  }

  private canvasDimensions(image: ImageBitmap): Size {
    if (this.shouldFlipDimensions()) {
      return {
        width: image.height,
        height: image.width,
      };
    }
    return {
      width: image.width,
      height: image.height,
    };
  }

  private shouldFlipDimensions(): boolean {
    return this.videoRotationAngle % 180 !== 0;
  }

  private yOffset(image: ImageBitmap): number {
    if (this.videoRotationAngle === 90 || this.videoRotationAngle === 180) {
      return -image.height;
    }
    return 0;
  }

  private xOffset(image: ImageBitmap): number {
    if (this.videoRotationAngle === 180 || this.videoRotationAngle === 270) {
      return -image.width;
    }
    return 0;
  }

  private rotationAngleRadians() {
    return (this.videoRotationAngle * Math.PI) / 180;
  }
}

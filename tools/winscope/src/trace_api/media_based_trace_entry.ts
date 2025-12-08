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
import {NOT_IMPLEMENTED_ERROR} from 'common/errors';
import {Size} from 'common/geometry/size';

/**
 * Represents a single entry in a media-based trace, such as a video or a
 * screenshot. Contains data for rendering a frame either in HTMLVideoElement or
 * HTMLCanvasElement.
 */
export interface MediaBasedTraceEntry {
  frameData: Blob | undefined;
  videoTimeSeconds: number;
  image: ImageBitmap | undefined;
  rotationAngle: number;
  tryDrawOnCanvas(canvas: HTMLCanvasElement): void;
}

export class VideoEntry implements MediaBasedTraceEntry {
  readonly rotationAngle = 0;
  readonly image = undefined;

  constructor(
    readonly frameData: Blob,
    readonly videoTimeSeconds: number,
  ) {}

  tryDrawOnCanvas(canvas: HTMLCanvasElement) {
    throw NOT_IMPLEMENTED_ERROR;
  }
}

export class CanvasEntry implements MediaBasedTraceEntry {
  readonly videoTimeSeconds = 0;
  readonly frameData = undefined;

  constructor(
    readonly image: ImageBitmap,
    readonly rotationAngle = 0,
  ) {}

  tryDrawOnCanvas(canvas: HTMLCanvasElement) {
    if (!this.image) {
      return;
    }
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
    return this.rotationAngle % 180 !== 0;
  }

  private yOffset(image: ImageBitmap): number {
    if (this.rotationAngle === 90 || this.rotationAngle === 180) {
      return -image.height;
    }
    return 0;
  }

  private xOffset(image: ImageBitmap): number {
    if (this.rotationAngle === 180 || this.rotationAngle === 270) {
      return -image.width;
    }
    return 0;
  }

  private rotationAngleRadians() {
    return (this.rotationAngle * Math.PI) / 180;
  }
}

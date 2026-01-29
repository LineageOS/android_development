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

import {assertDefined} from '@common/assert';
import {Point} from '@common/geometry/point';
import {Size} from '@common/geometry/size';

export class MediaBasedFrame<T extends ImageBitmap | VideoFrame> {
  readonly size: Size;

  constructor(
    private readonly image: T,
    private readonly rotationAngle = 0,
    private readonly translation?: Point,
    size?: Size,
  ) {
    this.size = size ?? {
      width:
        'codedWidth' in this.image ? this.image.codedWidth : this.image.width,
      height:
        'codedHeight' in this.image
          ? this.image.codedHeight
          : this.image.height,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tryDrawOnCanvas(canvas: any, updateCanvasDimensions = true) {
    if (!this.image) {
      return;
    }

    if (updateCanvasDimensions) {
      const canvasDimensions = this.canvasDimensions();
      canvas.width = canvasDimensions.width;
      canvas.height = canvasDimensions.height;
    }

    const ctx = assertDefined(canvas.getContext('2d'));
    if (this.translation) {
      ctx.translate(this.translation.x, this.translation.y);
    }
    ctx.rotate(this.rotationAngleRadians());
    ctx.drawImage(
      this.image,
      this.xOffset(),
      this.yOffset(),
      this.size.width,
      this.size.height,
    );
    ctx.resetTransform();
  }

  private canvasDimensions(): Size {
    if (this.shouldFlipDimensions()) {
      return {
        width: this.size.height,
        height: this.size.width,
      };
    }
    return {
      width: this.size.width,
      height: this.size.height,
    };
  }

  private shouldFlipDimensions(): boolean {
    return this.rotationAngle % 180 !== 0;
  }

  private yOffset(): number {
    if (this.rotationAngle === 90 || this.rotationAngle === 180) {
      return -this.size.height;
    }
    return 0;
  }

  private xOffset(): number {
    if (this.rotationAngle === 180 || this.rotationAngle === 270) {
      return -this.size.width;
    }
    return 0;
  }

  private rotationAngleRadians() {
    return (this.rotationAngle * Math.PI) / 180;
  }
}

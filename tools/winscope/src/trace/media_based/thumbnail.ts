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

import {Point} from '@common/geometry/point';
import {Size} from '@common/geometry/size';
import {objectUrlFromSafeSource} from '@compat/safevalues';

/**
 * Represents sprite sheet for thumbnail video preview. Provides css for visualizing
 * sprites as background image to div.
 */

export class Thumbnail {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly url: any;
  private readonly spritesPerRow: number;
  private readonly rows: number;
  private thumbWidth = 150;
  private thumbHeight = 300;

  constructor(
    private readonly totalSprites: number,
    private readonly spriteHeight: number,
    private readonly spriteWidth: number,
    blob: Blob,
    sheetHeight: number,
    sheetWidth: number,
  ) {
    this.url = objectUrlFromSafeSource(blob);
    this.spritesPerRow = Math.floor(sheetWidth / spriteWidth);
    this.rows = Math.ceil(sheetHeight / spriteHeight);
    this.setThumbWidth(150);
  }

  onDestroy() {
    URL.revokeObjectURL(this.url);
  }

  setThumbWidth(value: number) {
    this.thumbWidth = value;
    this.thumbHeight = (this.spriteHeight * this.thumbWidth) / this.spriteWidth;
  }

  getThumbWidth() {
    return this.thumbWidth;
  }

  getThumbHeight() {
    return this.thumbHeight;
  }

  getBackgroundImageUrl(): string {
    return this.url;
  }

  getBackgroundSize(): Size {
    const width = this.spritesPerRow * this.thumbWidth;
    const height = this.rows * this.getThumbHeight();
    return {width, height};
  }

  getBackgroundPosition(fractionalPosition: number): Point {
    const spriteNumber = Math.floor(fractionalPosition * this.totalSprites);
    const x = -(spriteNumber % this.spritesPerRow) * this.thumbWidth;
    const y = -Math.floor(spriteNumber / this.spritesPerRow) * this.thumbHeight;
    return {x, y};
  }
}

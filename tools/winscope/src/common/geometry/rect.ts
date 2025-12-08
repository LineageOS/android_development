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

import {Point} from './point';

/**
 * A rectangle class in 2D space.
 */
export class Rect {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly w: number,
    readonly h: number,
  ) {}

  containsPoint(point: Point): boolean {
    return (
      this.x <= point.x &&
      point.x <= this.x + this.w &&
      this.y <= point.y &&
      point.y <= this.y + this.h
    );
  }

  isEmpty(): boolean {
    const [x, y, w, h] = [this.x, this.y, this.w, this.h];
    const nullValuePresent =
      x === -1 || y === -1 || x + w === -1 || y + h === -1;
    const nullHeightOrWidth = w <= 0 || h <= 0;
    return nullValuePresent || nullHeightOrWidth;
  }
}

/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {Segment} from 'app/components/timeline/segment';
import {TimeRange, Timestamp} from 'common/time/time';
import {ComponentTimestampConverter} from 'common/time/timestamp_converter';

/**
 * A class for transforming timestamps to canvas coordinates and vice versa.
 */
export class Transformer {
  private tsRangeWidth: bigint;
  private canvasWidth: number;

  private tsOffset: bigint;
  private canvasOffset: number;

  constructor(
    private tsRange: TimeRange,
    private canvasPosRange: Segment,
    private timestampConverter: ComponentTimestampConverter,
  ) {
    this.tsRangeWidth = BigInt(this.tsRange.endNs - this.tsRange.startNs);
    // Needs to be a whole number to be compatible with bigints
    this.canvasWidth = Math.round(
      this.canvasPosRange.to - this.canvasPosRange.from,
    );

    this.tsOffset = this.tsRange.startNs;
    // Needs to be a whole number to be compatible with bigints
    this.canvasOffset = this.canvasPosRange.from;
  }

  transform(x: Timestamp): number {
    return (
      this.canvasOffset +
      (this.canvasWidth * Number(x.getValueNs() - this.tsOffset)) /
        Number(this.tsRangeWidth)
    );
  }

  untransform(x: number): Timestamp {
    x = Math.round(x);
    const valueNs =
      this.tsOffset +
      (BigInt(x - this.canvasOffset) * this.tsRangeWidth) /
        BigInt(this.canvasWidth);
    return this.timestampConverter.makeTimestampFromNs(valueNs);
  }
}

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

import {MediaBasedFrame} from './media_based_frame';
import {Thumbnail} from './thumbnail';

/**
 * Represents a single entry in a media-based trace, such as a video or a
 * screenshot. Contains data for rendering a frame either in HTMLVideoElement or
 * HTMLCanvasElement.
 */
export interface MediaBasedTraceEntry {
  thumbnail: Thumbnail | undefined;
  frameData: Blob | undefined;
  videoTimeSeconds: number;
  frame: MediaBasedFrame<ImageBitmap> | undefined;
}

export class VideoEntry implements MediaBasedTraceEntry {
  readonly frame = undefined;

  constructor(
    readonly frameData: Blob,
    readonly videoTimeSeconds: number,
    readonly thumbnail: Thumbnail | undefined = undefined,
  ) {}
}

export class CanvasEntry implements MediaBasedTraceEntry {
  readonly videoTimeSeconds = 0;
  readonly frameData = undefined;
  readonly thumbnail = undefined;

  readonly frame: MediaBasedFrame<ImageBitmap>;

  constructor(image: ImageBitmap, rotationAngle = 0) {
    this.frame = new MediaBasedFrame<ImageBitmap>(image, rotationAngle);
  }
}

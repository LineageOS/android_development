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

import {WebCodecData} from './helpers';

/**
 * Decodes and caches video frames for visualization in the UI. Uses a
 * single buffer cache storing all frames in the key-frame range associated
 * with the last requested index.
 */
export class VideoFrameCache {
  private readonly webCodecData: WebCodecData;
  private readonly cache: Map<number, VideoFrame> = new Map();

  constructor(webCodecData: WebCodecData) {
    this.webCodecData = webCodecData;
  }

  async get(
    index: number,
  ): Promise<{frame: VideoFrame; rotationAngle: number}> {
    let frame = this.cache.get(index);
    if (frame) {
      return {frame, rotationAngle: this.webCodecData.rotationAngle};
    }
    await this.updateCache(index);

    frame = this.cache.get(index);
    if (!frame) {
      throw new Error('index out of bounds');
    }
    return {
      frame,
      rotationAngle: this.webCodecData.rotationAngle,
    };
  }

  private async updateCache(target: number) {
    this.cache.clear();

    let prevKeyFrameIndex = 0;
    for (let i = target; i >= 0; i--) {
      if (this.webCodecData.chunks[i].type === KEY_FRAME_TYPE) {
        prevKeyFrameIndex = i;
        break;
      }
    }

    let frameIndex = prevKeyFrameIndex;
    const onOutput = (frame: VideoFrame) => {
      this.cache.set(frameIndex, frame);
      frameIndex++;
    };
    const frameDecoder = this.createFrameDecoder(onOutput);

    let i = prevKeyFrameIndex;
    do {
      frameDecoder.decode(this.webCodecData.chunks[i]);
      i++;
    } while (
      i < this.webCodecData.chunks.length &&
      this.webCodecData.chunks[i].type !== KEY_FRAME_TYPE
    );

    await frameDecoder.flush();
  }

  private createFrameDecoder(
    onOutput: (frame: VideoFrame) => void,
  ): VideoDecoder {
    const decoder = new VideoDecoder({
      output: onOutput,
      error: (e) => {
        console.error('VideoDecoder Error:', e);
      },
    });
    decoder.configure(this.webCodecData.config);
    return decoder;
  }
}

export const KEY_FRAME_TYPE = 'key';

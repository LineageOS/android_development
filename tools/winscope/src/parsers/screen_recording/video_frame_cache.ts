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

import {Timer} from 'common/time/timer';
import {WebCodecData} from 'parsers/screen_recording/helpers';
import {UserNotifier} from 'services/user_notifier';
import {makeWarningVideoFrameCacheStall} from 'parsers/warnings';
import {assertDefined} from 'common/assert';
import {getVideoFrameCacheWorkerUrl} from 'compat/video_frame_cache_worker_url';

/**
 * Decodes and caches video frames for visualization in the UI. Uses a single
 * buffer to store all frames. This implementation aims to optimize the latency
 * of entry retrieval, at the expense of initial loading time, as the key-frame
 * range for the first requested index must be cached in its entirety before
 * the remaining key-frame ranges are decoded. Frame decoding is offloaded to a
 * WebWorker to avoid stalling the UI after the initial load.
 */
export class VideoFrameCache {
  private readonly webCodecData: WebCodecData;
  private readonly keyFrameIndices: Readonly<number[]>;
  private readonly cache: FrameCache = new Map();
  private readonly worker: Worker;

  private firstRequest = true;
  private notifiedCacheStall = false;

  constructor(webCodecData: WebCodecData) {
    this.webCodecData = webCodecData;

    const keyFrameIndices: number[] = [];
    for (const [i, chunk] of webCodecData.chunks.entries()) {
      if (chunk.type === KEY_FRAME_TYPE) {
        keyFrameIndices.push(i);
      }
    }
    this.keyFrameIndices = keyFrameIndices;

    this.worker = this.createWorker();
  }

  onDestroy() {
    this.worker.terminate();
  }

  async get(
    index: number,
  ): Promise<{frame: ImageBitmap; rotationAngle: number}> {
    if (index < 0 || index >= this.webCodecData.chunks.length) {
      throw new Error(`index ${index} out of bounds`);
    }
    if (this.firstRequest) {
      this.firstRequest = false;
      await this.updateCache(index);
    }

    await new Timer(30000, 100).wait(
      () => {
        return this.cache.has(index);
      },
      () => `Timed out waiting for SR frame ${index} to be decoded.`,
    );

    const frame = assertDefined(this.cache.get(index));
    return {frame, rotationAngle: this.webCodecData.rotationAngle};
  }

  private async updateCache(target: number) {
    if (target < 0 || target >= this.webCodecData.chunks.length) {
      return;
    }

    let prevKeyFrameIndex = 0;
    let nextKeyFrameIndex = this.webCodecData.chunks.length;
    for (const keyFrameIndex of this.keyFrameIndices) {
      if (keyFrameIndex > target) {
        nextKeyFrameIndex = keyFrameIndex;
        break;
      }
      prevKeyFrameIndex = keyFrameIndex;
    }

    this.decodeChunk(prevKeyFrameIndex, nextKeyFrameIndex);
    await new Timer(30000, 100).wait(
      () => {
        return this.cache.has(nextKeyFrameIndex - 1);
      },
      () =>
        `Timed out waiting for first SR chunk` +
        ` ${prevKeyFrameIndex}-${nextKeyFrameIndex - 1} to be decoded.`,
    );

    this.keyFrameIndices.forEach((keyFrame, j) => {
      if (keyFrame === prevKeyFrameIndex) {
        return;
      }
      const nextKeyFrameIndex =
        this.keyFrameIndices.at(j + 1) ?? this.webCodecData.chunks.length;
      this.decodeChunk(keyFrame, nextKeyFrameIndex);
    });
  }

  private decodeChunk(prevKeyFrameIndex: number, nextKeyFrameIndex: number) {
    this.worker.postMessage({
      prevKeyFrameIndex,
      nextKeyFrameIndex,
      config: this.webCodecData.config,
      chunks: this.webCodecData.chunks.slice(
        prevKeyFrameIndex,
        nextKeyFrameIndex,
      ),
    });
  }

  private tryNotifyCacheStall() {
    if (this.notifiedCacheStall) {
      return;
    }
    UserNotifier.add(makeWarningVideoFrameCacheStall()).notify();
    this.notifiedCacheStall = true;
  }

  private createWorker(): Worker {
    const workerUrl = getVideoFrameCacheWorkerUrl();
    const worker = new Worker(workerUrl);

    worker.onmessage = (event: MessageEvent) => {
      if (event.data.log) {
        console.log(event.data.log);
      }
      if (event.data.cacheStalled) {
        this.tryNotifyCacheStall();
      }
      if (event.data.error) {
        throw event.data.error;
      }
      if (event.data.imageIndex !== undefined) {
        this.cache.set(event.data.imageIndex, event.data.image);
      }
      if (!event.data.cacheComplete) {
        return;
      }
    };

    worker.onerror = (error) => {
      throw new Error(error.message);
    };

    return worker;
  }
}

export const KEY_FRAME_TYPE = 'key';
type FrameCache = Map<number, ImageBitmap>;

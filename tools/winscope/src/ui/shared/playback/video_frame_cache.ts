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
import {Timer} from '@common/time/timer';
import {getLogger} from '@compat/logging';
import {makeWarningVideoFrameCacheStall} from '@parsers/helpers/warnings';
import {UserNotifier} from '@services/user_notifier';
import {KEY_FRAME_TYPE, WebCodecData} from '@trace/media_based/helpers';

import {PlaybackState} from './playback_state';

/**
 * Decodes and caches video frames for visualization in the UI. Uses an LRU cache
 * to store frames, limited by a max cache size. Frame decoding is offloaded
 * to a Worker to avoid stalling the UI after the cache is initially populated.
 *
 * This cache is intended for use with playback, i.e. sequential video frame updates.
 * If a target index is requested that is not within the cached key-frame ranges, or
 * if playback direction is reversed, the cache is cleared and decoding is restarted
 * from the key-frame range that includes the target.
 */
export class VideoFrameCache {
  private static readonly MAX_BITMAPS_PER_CACHE = 100;
  private static readonly INITIAL_BATCH_SIZE = 32;
  private static readonly PENDING_BATCH_SIZE = 16;

  private readonly webCodecData: WebCodecData;
  private readonly keyFrameRanges: readonly KeyFrameRange[];

  private worker: Worker;
  private cache: FrameCache = new Map();
  private cachedRanges: KeyFrameRange[] = [];

  private currPlaybackState = PlaybackState.FORWARDS;
  private updatingCache = false;
  private videoCacheStall = false;

  constructor(webCodecData: WebCodecData) {
    this.webCodecData = webCodecData;
    this.keyFrameRanges = this.extractKeyFrameRanges();
    this.worker = this.createWorker();
  }

  onDestroy() {
    this.cachedRanges.forEach((range) => {
      this.cancelFetch(range);
    });
    this.cache.forEach((image) => image.close());
    this.worker.terminate();
  }

  reset() {
    this.onDestroy();
    this.worker = this.createWorker();
    this.cachedRanges = [];
    this.cache = new Map();
  }

  async get(
    index: number,
    playbackState: PlaybackState,
  ): Promise<{frame: ImageBitmap; rotationAngle: number}> {
    const playbackStateChanged = this.currPlaybackState !== playbackState;
    this.currPlaybackState = playbackState;

    const keyFrameRange = this.getKeyFrameRangeForTarget(index);
    if (!keyFrameRange) {
      throw new Error(`index ${index} out of bounds`);
    }

    const range = this.cachedRanges.find(
      (r) => index >= r.decodedStart && index < r.end,
    );

    if (!playbackStateChanged && range !== undefined) {
      const indexQueuedForwards =
        this.currPlaybackState === PlaybackState.FORWARDS &&
        this.cache.has(Math.max(index - 10, range.decodedStart));
      const indexQueuedBackwards =
        this.currPlaybackState === PlaybackState.BACKWARDS &&
        index < range.decodedEnd;
      if (indexQueuedForwards || indexQueuedBackwards) {
        return await this.waitForTargetInCache(index, range);
      }
    }

    this.reset();
    this.updateCache(keyFrameRange, index);
    const cachedRange = this.getCachedRange(keyFrameRange);
    return await this.waitForTargetInCache(index, cachedRange);
  }

  private cancelFetch(keyFrameRange: KeyFrameRange) {
    this.worker.postMessage({
      cancelFetch: true,
      keyFrameIndex: keyFrameRange.start,
    });
  }

  private getKeyFrameRangeForTarget(target: number): KeyFrameRange | undefined {
    if (target < 0 || target >= this.webCodecData.chunks.length) {
      return undefined;
    }
    return assertDefined(
      this.keyFrameRanges.find((range) => {
        return target >= range.start && target < range.end;
      }),
    );
  }

  private getCachedRange(range: KeyFrameRange) {
    return assertDefined(
      this.cachedRanges.find((r) => {
        return r.start === range.start && r.end === range.end;
      }),
    );
  }

  private updateCache(range: KeyFrameRange, target: number) {
    if (this.updatingCache) {
      return;
    }
    this.updatingCache = true;
    this.decodeRange(range, target);
    this.updatingCache = false;
  }

  private evictFromOldestCacheRange(numberOfFrames: number) {
    const oldestRange = this.cachedRanges[0];
    if (!oldestRange) {
      return;
    }

    let lim: number;

    if (this.currPlaybackState === PlaybackState.FORWARDS) {
      lim = Math.min(
        oldestRange.decodedStart + numberOfFrames,
        oldestRange.end,
      );
      for (let i = oldestRange.decodedStart; i < lim; i++) {
        this.cache.get(i)?.close();
        this.cache.delete(i);
      }
      oldestRange.decodedStart += numberOfFrames;
    } else {
      lim = Math.max(
        oldestRange.decodedStart - 1,
        oldestRange.decodedEnd - 1 - numberOfFrames,
      );
      for (let i = oldestRange.decodedEnd - 1; i > lim; i--) {
        this.cache.get(i)?.close();
        this.cache.delete(i);
      }
      oldestRange.decodedEnd -= numberOfFrames;
    }

    if (oldestRange.decodedStart >= oldestRange.end) {
      this.cachedRanges.shift();
      this.evictFromOldestCacheRange(
        numberOfFrames - (lim - oldestRange.decodedStart),
      );
    }
  }

  private decodeRange(
    keyFrameRange: KeyFrameRange,
    target: number,
    editCachedRange = false,
  ) {
    const range = editCachedRange
      ? this.getCachedRange(keyFrameRange)
      : keyFrameRange;

    const fetchFromEnd = this.currPlaybackState === PlaybackState.BACKWARDS;

    let decodedStart = target;
    if (fetchFromEnd) {
      decodedStart = Math.max(
        range.start,
        editCachedRange
          ? target - VideoFrameCache.PENDING_BATCH_SIZE
          : target - VideoFrameCache.INITIAL_BATCH_SIZE,
      );
    }

    const fetchedLastFrame = fetchFromEnd
      ? decodedStart === range.start
      : decodedStart + VideoFrameCache.INITIAL_BATCH_SIZE >= range.end;

    if (editCachedRange) {
      range.decodedStart = decodedStart;
      range.lastBatchStart = decodedStart;
      range.fetchedLastFrame = fetchedLastFrame;
    } else {
      this.cachedRanges.push({
        start: range.start,
        end: range.end,
        decodedStart,
        decodedEnd: Math.min(
          range.end,
          decodedStart + VideoFrameCache.INITIAL_BATCH_SIZE + 1,
        ),
        lastBatchStart: decodedStart,
        fetchedLastFrame,
      });
    }

    const end = fetchFromEnd ? target + 1 : range.end;

    this.worker.postMessage({
      startKeyFrameIndex: range.start,
      nextKeyFrameIndex: range.end,
      target: decodedStart,
      chunks: this.webCodecData.chunks.slice(range.start, end),
    });
  }

  private async waitForTargetInCache(
    target: number,
    range: KeyFrameRange,
    isRetry = false,
  ): Promise<{frame: ImageBitmap; rotationAngle: number}> {
    try {
      await new Timer(10000, 100).wait(
        () => this.cache.has(target),
        () => `Timed out waiting for SR frame ${target} to be decoded.`,
      );
      const frame = assertDefined(
        this.cache.get(target),
        () => 'could not find ' + target,
      );
      this.maybeFetchPendingBatch(target, range);
      return {frame, rotationAngle: this.webCodecData.rotationAngle};
    } catch (e) {
      if (isRetry) {
        throw e;
      }
      if (!this.videoCacheStall) {
        UserNotifier.add(makeWarningVideoFrameCacheStall()).notify();
        this.videoCacheStall = true;
      }
      this.reset();
      await this.get(target, this.currPlaybackState);
      return this.waitForTargetInCache(target, range, true);
    }
  }

  private maybeFetchPendingBatch(target: number, targetRange: KeyFrameRange) {
    const diff = target - targetRange.lastBatchStart;

    if (this.currPlaybackState === PlaybackState.FORWARDS) {
      const fetchNextBatch =
        diff > VideoFrameCache.PENDING_BATCH_SIZE &&
        !this.cachedRanges.some((r) => {
          return r.start === targetRange.end;
        });
      if (fetchNextBatch) {
        this.fetchNextBatch(targetRange);
      }
      return;
    }

    const fetchPrevBatch =
      diff < VideoFrameCache.PENDING_BATCH_SIZE &&
      (!targetRange.fetchedLastFrame ||
        !this.cachedRanges.some((r) => {
          return targetRange.start - 1 < r.decodedEnd;
        }));

    if (fetchPrevBatch) {
      this.fetchPrevBatch(targetRange);
    }
  }

  private fetchNextBatch(range: KeyFrameRange) {
    range.lastBatchStart += VideoFrameCache.PENDING_BATCH_SIZE;
    range.fetchedLastFrame =
      range.lastBatchStart + VideoFrameCache.PENDING_BATCH_SIZE >= range.end;
    this.worker.postMessage({
      fetchNextBatch: true,
      startKeyFrameIndex: range.start,
    });
  }

  private fetchPrevBatch(range: KeyFrameRange) {
    const target = range.lastBatchStart - 1;
    if (target >= range.start) {
      this.decodeRange(range, target, true);
    }
    if (
      range.lastBatchStart - VideoFrameCache.PENDING_BATCH_SIZE <
      range.start
    ) {
      const remTarget = range.start - 1;
      const remRange = this.getKeyFrameRangeForTarget(remTarget);
      if (remRange) {
        this.decodeRange(remRange, remTarget);
      }
    }
  }

  private extractKeyFrameRanges(): KeyFrameRange[] {
    const keyFrameRanges: KeyFrameRange[] = [];
    let lastKeyFrame: number | undefined;
    for (const [i, chunk] of this.webCodecData.chunks.entries()) {
      if (chunk.type !== KEY_FRAME_TYPE) {
        continue;
      }
      if (lastKeyFrame !== undefined) {
        keyFrameRanges.push(this.makeKeyFrameRange(lastKeyFrame, i));
      }
      lastKeyFrame = i;
    }
    if (lastKeyFrame !== undefined) {
      keyFrameRanges.push(
        this.makeKeyFrameRange(lastKeyFrame, this.webCodecData.chunks.length),
      );
    }
    return keyFrameRanges;
  }

  private makeKeyFrameRange(start: number, end: number): KeyFrameRange {
    return {
      start,
      end,
      decodedEnd: start,
      decodedStart: start,
      lastBatchStart: start,
      fetchedLastFrame: false,
    };
  }

  private createWorker(): Worker {
    const worker = new Worker(
      new URL('./video_frame_cache.worker', import.meta.url),
    );
    const logger = getLogger('VideoFrameCache');

    worker.onmessage = (event: MessageEvent<WorkerMessageData>) => {
      if (event.data.log !== undefined) {
        logger.debug(event.data.log);
      }

      if (event.data.error !== undefined) {
        logger.error(event.data.error.message);
        throw event.data.error;
      }

      if (event.data.imageIndex !== undefined && event.data.image) {
        this.cache.set(event.data.imageIndex, event.data.image);
        if (this.cache.size > VideoFrameCache.MAX_BITMAPS_PER_CACHE) {
          this.evictFromOldestCacheRange(
            this.cache.size - VideoFrameCache.MAX_BITMAPS_PER_CACHE,
          );
        }
      }

      if (event.data.fetchingPendingRange && event.data.target !== undefined) {
        const range = this.getKeyFrameRangeForTarget(event.data.target);
        if (range) {
          this.decodeRange(range, range.start);
        }
      }
    };

    worker.onerror = (error) => {
      throw new Error(error.message);
    };

    // initialize variables to reduce amount of data that needs to be cloned
    // with each decode request
    worker.postMessage({videoDecoderConfig: this.webCodecData.config});
    worker.postMessage({initialBatchSize: VideoFrameCache.INITIAL_BATCH_SIZE});
    worker.postMessage({pendingBatchSize: VideoFrameCache.PENDING_BATCH_SIZE});
    return worker;
  }
}

type FrameCache = Map<number, ImageBitmap>;

interface KeyFrameRange {
  start: number;
  end: number;
  decodedStart: number;
  decodedEnd: number;
  lastBatchStart: number;
  fetchedLastFrame: boolean;
}

interface WorkerMessageData {
  log?: string;
  error?: Error;
  imageIndex?: number;
  image?: ImageBitmap;
  fetchingPendingRange?: boolean;
  target?: number;
}

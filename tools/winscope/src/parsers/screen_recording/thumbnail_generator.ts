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
import {getLogger} from '@compat/logging';
import {Thumbnail} from '@trace/media_based/thumbnail';

class ThumbnailBuilder {
  private spriteSheet: Blob | undefined;
  private totalSprites: number | undefined;
  private spriteHeight: number | undefined;
  private spriteWidth: number | undefined;
  private sheetHeight: number | undefined;
  private sheetWidth: number | undefined;

  setTotalSprites(value: number): this {
    this.totalSprites = value;
    return this;
  }

  setSpriteHeight(value: number): this {
    this.spriteHeight = value;
    return this;
  }

  setSpriteWidth(value: number): this {
    this.spriteWidth = value;
    return this;
  }

  setSpriteSheet(value: Blob): this {
    this.spriteSheet = value;
    return this;
  }

  setSheetHeight(value: number): this {
    this.sheetHeight = value;
    return this;
  }

  setSheetWidth(value: number): this {
    this.sheetWidth = value;
    return this;
  }

  build(): Thumbnail {
    return new Thumbnail(
      assertDefined(this.totalSprites),
      assertDefined(this.spriteHeight),
      assertDefined(this.spriteWidth),
      assertDefined(this.spriteSheet),
      assertDefined(this.sheetHeight),
      assertDefined(this.sheetWidth),
    );
  }
}

export class ThumbnailGenerator {
  private videoData: Uint8Array | undefined;
  private worker: Worker | undefined;

  onDestroy() {
    this.worker?.terminate();
  }

  setVideoData(value: Uint8Array): this {
    this.videoData = value;
    return this;
  }

  async generate(): Promise<Thumbnail | undefined> {
    const logger = getLogger('ThumbnailGenerator');
    try {
      const worker = new Worker(
        new URL('./thumbnail_generator.worker', import.meta.url),
        {type: 'module'},
      );
      this.worker = worker;
      const workerData = await new Promise<ThumbnailGeneratorWorkerData>(
        (resolve, reject) => {
          worker.onerror = (error) => {
            logger.error(error.message, error);
            reject(error?.message);
          };
          worker.onmessage = (
            event: MessageEvent<ThumbnailGeneratorWorkerData>,
          ) => {
            if (event.data.log !== undefined) {
              logger.debug(event.data.log);
            }

            if (event.data.error !== undefined) {
              logger.error(event.data.error.message);
              worker.terminate();
              reject(event.data.error.message);
            }

            if (event.data.buffer !== undefined) {
              worker.terminate();
              resolve(event.data);
            }
          };
          const arrayBuffer = assertDefined(this.videoData).buffer;
          worker.postMessage(arrayBuffer, [arrayBuffer]);
        },
      );
      return new ThumbnailBuilder()
        .setTotalSprites(assertDefined(workerData.totalSprites))
        .setSpriteHeight(assertDefined(workerData.rotatedSpriteHeight))
        .setSpriteWidth(assertDefined(workerData.rotatedSpriteWidth))
        .setSpriteSheet(new Blob([assertDefined(workerData.buffer)]))
        .setSheetHeight(assertDefined(workerData.sheetHeight))
        .setSheetWidth(assertDefined(workerData.sheetWidth))
        .build();
    } catch (e) {
      logger.error(e ? (e as Error).message : 'Failed to generate thumbnail.');
      return undefined;
    }
  }
}

interface ThumbnailGeneratorWorkerData {
  log?: string;
  error?: Error;
  buffer?: ArrayBuffer;
  totalSprites?: number;
  rotatedSpriteHeight?: number;
  rotatedSpriteWidth?: number;
  sheetHeight?: number;
  sheetWidth?: number;
}

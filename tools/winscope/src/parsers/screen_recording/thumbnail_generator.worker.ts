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
import {parseWebCodecData} from '@trace/media_based/helpers';
import {MediaBasedFrame} from '@trace/media_based/media_based_frame';

addEventListener('message', async (event) => {
  const thumbnail = await generateThumbnail(event.data);
  postMessage({thumbnail});
});

async function generateThumbnail(videoBuffer: ArrayBuffer) {
  try {
    const videoData = new Uint8Array(videoBuffer);
    const {chunks, config, rotationAngle} = await parseWebCodecData(videoData);

    const unrotatedSpriteWidth = FIXED_SPRITE_WIDTH;
    const unrotatedSpriteHeight =
      (assertDefined(config.codedHeight) * FIXED_SPRITE_WIDTH) /
      assertDefined(config.codedWidth);

    const shouldFlip = rotationAngle % 180 !== 0;
    const rotatedSpriteWidth = shouldFlip
      ? unrotatedSpriteHeight
      : FIXED_SPRITE_WIDTH;
    const rotatedSpriteHeight = shouldFlip
      ? FIXED_SPRITE_WIDTH
      : unrotatedSpriteHeight;

    const maxPossibleSprites = Math.max(
      1,
      Math.floor((chunks.length - 1) / DEFAULT_SPRITE_FRAME_INTERVAL),
    );
    const spritesPerRow = Math.min(
      maxPossibleSprites,
      Math.floor(CANVAS_MAX_DIM / rotatedSpriteWidth),
    );
    const numRows = Math.min(
      Math.ceil(maxPossibleSprites / spritesPerRow),
      Math.floor(CANVAS_MAX_DIM / rotatedSpriteHeight),
    );
    const totalSprites = Math.min(maxPossibleSprites, spritesPerRow * numRows);
    const spriteInterval = Math.floor(chunks.length / totalSprites);

    const canvas = new OffscreenCanvas(
      rotatedSpriteWidth * spritesPerRow,
      rotatedSpriteHeight * numRows,
    );

    let decoder: VideoDecoder | undefined;
    let decodingQueue = Promise.resolve();
    let spriteCount = 0;
    let distanceFromLastSprite = 0;

    const onOutput = (frame: VideoFrame) => {
      if (decoder?.state === 'closed' || spriteCount >= totalSprites) {
        frame.close();
        return;
      }

      if (distanceFromLastSprite === 0) {
        decodingQueue = decodingQueue.then(async () => {
          const xOffset =
            Math.floor(spriteCount % spritesPerRow) * rotatedSpriteWidth;
          const yOffset =
            Math.floor(spriteCount / spritesPerRow) * rotatedSpriteHeight;

          new MediaBasedFrame(
            frame,
            rotationAngle,
            {x: xOffset, y: yOffset},
            {width: unrotatedSpriteWidth, height: unrotatedSpriteHeight},
          ).tryDrawOnCanvas(canvas, false);

          spriteCount++;
          frame.close();
        });
      } else {
        frame.close();
      }

      distanceFromLastSprite = (distanceFromLastSprite + 1) % spriteInterval;
    };

    try {
      decoder = new VideoDecoder({
        output: (frame) => {
          onOutput(frame);
        },
        error: (e) => {
          postMessage({error: e});
        },
      });
      decoder.configure(config);

      const chunksToDecode = chunks.slice(
        0,
        Math.min(chunks.length, totalSprites * spriteInterval + 1),
      );
      for (const chunk of chunksToDecode) {
        decoder.decode(chunk);
      }

      await decoder.flush();
      await decodingQueue;
      decoder.close();
    } catch (e) {
      postMessage({error: e});
    }

    const spriteSheetBlob = await canvas.convertToBlob();
    const buffer = await spriteSheetBlob.arrayBuffer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (postMessage as any)(
      {
        buffer,
        totalSprites,
        rotatedSpriteHeight,
        rotatedSpriteWidth,
        sheetHeight: canvas.height,
        sheetWidth: canvas.width,
      },
      [buffer],
    );
  } catch (e) {
    postMessage({error: e});
    return undefined;
  }
}

const DEFAULT_SPRITE_FRAME_INTERVAL = 25;
const CANVAS_MAX_DIM = 8000;
const FIXED_SPRITE_WIDTH = 300;

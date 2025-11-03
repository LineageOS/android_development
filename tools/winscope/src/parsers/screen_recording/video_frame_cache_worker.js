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

let decodingQueue = Promise.resolve();

self.onmessage = async (event) => {
  decodingQueue.then(async () => {
    await decodeChunk(event.data);
    self.postMessage({cacheComplete: true});
  });
};

async function decodeChunk(data) {
  const {prevKeyFrameIndex, config, chunks} = data;

  let decodedFrameIndex = prevKeyFrameIndex;
  const onOutput = (frame) => {
    const imageIndex = decodedFrameIndex;
    createImageBitmap(frame).then((bitmap) => {
      self.postMessage({imageIndex, image: bitmap}, [bitmap]);
      frame.close();
    });
    decodedFrameIndex++;
  };

  const frameDecoder = createFrameDecoder(onOutput, config);
  for (const chunk of chunks) {
    frameDecoder.decode(chunk);
  }

  try {
    let flushed = false;
    frameDecoder.flush().then(() => {
      flushed = true;
    });
    await wait(
      () => flushed,
      () => {
        return (
          `Timed out waiting for flush.` +
          ` ${prevKeyFrameIndex} to ${decodedFrameIndex} frames decoded.`
        );
      },
    );
  } catch (error) {
    frameDecoder.close();
    if (decodedFrameIndex - prevKeyFrameIndex < 50) {
      self.postMessage({cacheStalled: true, error});
    }
  }

  await wait(
    () => decodedFrameIndex === prevKeyFrameIndex + chunks.length,
    () => {
      return (
        `Timed out waiting for decoded frames to be sent to main thread.` +
        ` ${prevKeyFrameIndex} to ${decodedFrameIndex} frames sent.`
      );
    },
  );
}

function createFrameDecoder(onOutput, config) {
  const decoder = new VideoDecoder({
    output: onOutput,
    error: (e) => {
      console.error('VideoDecoder Error:', e);
    },
  });
  decoder.configure(config);
  return decoder;
}

async function wait(condition, errorMsg) {
  const startTimeMs = Date.now();
  while (Date.now() - startTimeMs < 30000) {
    if (condition()) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
  }
  throw new Error(errorMsg());
}

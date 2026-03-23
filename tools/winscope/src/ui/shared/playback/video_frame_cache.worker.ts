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

// must be initialized before any decoding is requested
let videoDecoderConfig: VideoDecoderConfig;
let initialBatchSize = 32;
let pendingBatchSize = 16;

let decodingQueue = Promise.resolve();
let cancelQueue = Promise.resolve();

// For forwards playback, decoders are stored by absolute key frame start index
// for the key-frame range they are decoding, and tracked by an interface with the
// following fields:
interface Tracker {
  chunks: EncodedVideoChunk[];
  absoluteDecodedFrameIndex: number;
  lastQueuedChunkIndex: number;
  frameDecoder?: VideoDecoder;
}

const trackers = new Map<number, Tracker>();

addEventListener('message', async (event) => {
  if (event.data.videoDecoderConfig) {
    return onVideoDecoderConfig(event.data);
  }

  if (event.data.initialBatchSize !== undefined) {
    return onInitialBatchSize(event.data);
  }

  if (event.data.pendingBatchSize !== undefined) {
    return onPendingBatchSize(event.data);
  }

  if (event.data.cancelFetch) {
    return onCancelFetch(event.data);
  }

  if (event.data.fetchNextBatch) {
    return onFetchNextBatch(event.data);
  }

  if (event.data.chunks) {
    return onChunks(event.data as EncodedVideoChunk);
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onVideoDecoderConfig(data: any) {
  videoDecoderConfig = data.videoDecoderConfig;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onInitialBatchSize(data: any) {
  initialBatchSize = data.initialBatchSize;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onPendingBatchSize(data: any) {
  pendingBatchSize = data.pendingBatchSize;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onCancelFetch(data: any) {
  cancelQueue = cancelQueue.then(async () => {
    trackers.get(data.keyFrameIndex)?.frameDecoder?.close();
    trackers.delete(data.keyFrameIndex);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onFetchNextBatch(data: any) {
  const startKeyFrameIndex = data.startKeyFrameIndex;

  decodingQueue = decodingQueue
    .then(async () => {
      const tracker = trackers.get(startKeyFrameIndex);
      if (!tracker?.frameDecoder) {
        return;
      }

      let i;
      const start = tracker.lastQueuedChunkIndex + 1;
      const end = start + pendingBatchSize;
      const lim = Math.min(end, tracker.chunks.length);

      for (i = start; i < lim; i++) {
        if (tracker.frameDecoder.state === 'closed') {
          break;
        }
        tracker.frameDecoder.decode(tracker.chunks[i]);
        tracker.lastQueuedChunkIndex++;
      }

      if (lim === tracker.chunks.length) {
        await tracker.frameDecoder.flush();
      }

      if (end > tracker.chunks.length) {
        postMessage({
          fetchingPendingRange: true,
          target: startKeyFrameIndex + tracker.chunks.length,
        });
      }
    })
    .catch((e) => {
      postMessage({log: e});
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function onChunks(data: any) {
  const startKeyFrameIndex = data.startKeyFrameIndex;
  const target = data.target;
  const chunks = data.chunks;

  const decode = async () => {
    await cancelQueue;
    await startDecodingChunks(startKeyFrameIndex, target, chunks);
  };
  decodingQueue = decodingQueue.then(decode);
  decodingQueue.catch((e) => {
    postMessage({error: e});
  });
}

async function startDecodingChunks(
  startKeyFrameIndex: number,
  target: number,
  chunks: EncodedVideoChunk[],
) {
  // frameDecoder lazily set so tracker can be referenced in onOutput
  const tracker: Tracker = {
    frameDecoder: undefined,
    chunks,
    absoluteDecodedFrameIndex: startKeyFrameIndex,
    lastQueuedChunkIndex: -1,
  };

  const onOutput = (frame: VideoFrame) => {
    if (tracker.frameDecoder?.state === 'closed') {
      frame.close();
      return false;
    }

    const imageIndex = tracker.absoluteDecodedFrameIndex;
    if (imageIndex >= target) {
      createImageBitmap(frame)
        .then((buffer) => {
          frame.close();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (postMessage as any)({imageIndex, image: buffer}, [buffer]);
        })
        .catch((e) =>
          postMessage({error: e.stack || e.message || e.toString()}),
        );
    } else {
      frame.close();
    }

    if (imageIndex === startKeyFrameIndex + tracker.chunks.length) {
      tracker.frameDecoder?.close();
      trackers.delete(startKeyFrameIndex);
    }

    tracker.absoluteDecodedFrameIndex++;
    return true;
  };

  tracker.frameDecoder = createFrameDecoder(onOutput);
  trackers.set(startKeyFrameIndex, tracker);

  let i;
  const batchEnd = target - startKeyFrameIndex + initialBatchSize + 1;
  for (i = 0; i < Math.min(batchEnd, tracker.chunks.length); i++) {
    if (tracker.frameDecoder.state === 'closed') {
      break;
    }
    tracker.frameDecoder.decode(tracker.chunks[i]);
    tracker.lastQueuedChunkIndex++;
  }

  if (tracker.lastQueuedChunkIndex === tracker.chunks.length - 1) {
    await tracker.frameDecoder.flush();
  }
}

function createFrameDecoder(onOutput: (frame: VideoFrame) => boolean) {
  const decoder = new VideoDecoder({
    output: (frame) => {
      const success = onOutput(frame);
      if (!success) {
        decoder.close();
      }
    },
    error: (e) => {
      postMessage({error: e});
    },
  });
  decoder.configure(videoDecoderConfig);
  return decoder;
}

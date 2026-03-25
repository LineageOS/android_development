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

import {getFixtureFile} from '@common/testing/io_helpers';

import {PlaybackState} from './playback_state';
import {VideoFrameCache} from './video_frame_cache';
import {createVideoFrameCache} from './video_frame_cache_factory';

describe('VideoFrameCache', () => {
  let dataOneKeyFrameAndRotation: Uint8Array;
  let dataThreeKeyFramesNoRotation: Uint8Array;

  let cacheOneKeyFrameAndRotation: VideoFrameCache;
  let cacheThreeKeyFramesNoRotation: VideoFrameCache;

  beforeAll(async () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;
    const file1 = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/screen_recording_metadata_v3.mp4',
    );
    dataOneKeyFrameAndRotation = new Uint8Array(await file1.arrayBuffer());
    cacheOneKeyFrameAndRotation = await createVideoFrameCache(
      dataOneKeyFrameAndRotation,
    );

    const file2 = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/screen_recording_no_metadata.mp4',
    );
    dataThreeKeyFramesNoRotation = new Uint8Array(await file2.arrayBuffer());
    cacheThreeKeyFramesNoRotation = await createVideoFrameCache(
      dataThreeKeyFramesNoRotation,
    );
  });

  beforeEach(() => {
    cacheOneKeyFrameAndRotation.reset();
    cacheThreeKeyFramesNoRotation.reset();
  });

  it('throws error if retrieval attempted out of bounds', async () => {
    await expectAsync(
      cacheOneKeyFrameAndRotation.get(-1, PlaybackState.FORWARDS),
    ).toBeRejected();
    await expectAsync(
      cacheOneKeyFrameAndRotation.get(105, PlaybackState.FORWARDS),
    ).toBeRejected();
  });

  it('retrieves all samples with one key frame', async () => {
    await checkFrameRetrieval(cacheOneKeyFrameAndRotation, 0, 105, 90);
  });

  it('retrieves samples starting middle of single key frame chunk', async () => {
    await checkFrameRetrieval(cacheOneKeyFrameAndRotation, 31, 70, 90);
  });

  it('retrieves all samples with multiple key frames', async () => {
    await checkFrameRetrieval(cacheThreeKeyFramesNoRotation, 0, 158, 0);
  });

  it('retrieves samples starting from middle of key frame chunk', async () => {
    await checkFrameRetrieval(cacheThreeKeyFramesNoRotation, 40, 90, 0);
  });

  it('retrieves samples starting from last key frame chunk', async () => {
    await checkFrameRetrieval(cacheThreeKeyFramesNoRotation, 60, 122, 0);
  });

  it('retrieves samples starting from different places in same chunk - forwards', async () => {
    await checkFrameRetrievalForwards(cacheOneKeyFrameAndRotation, 0, 5, 90);
    await checkFrameRetrievalForwards(cacheOneKeyFrameAndRotation, 80, 85, 90);
    await checkFrameRetrievalForwards(cacheOneKeyFrameAndRotation, 40, 45, 90);
  });

  it('retrieves samples starting from different places in same chunk - backwards', async () => {
    await checkFrameRetrievalBackwards(cacheOneKeyFrameAndRotation, 80, 85, 90);
    await checkFrameRetrievalBackwards(cacheOneKeyFrameAndRotation, 0, 5, 90);
    await checkFrameRetrievalBackwards(cacheOneKeyFrameAndRotation, 40, 45, 90);
  });

  async function checkFrameRetrieval(
    cache: VideoFrameCache,
    first: number,
    last: number,
    angle: number,
  ) {
    await checkFrameRetrievalForwards(cache, first, last, angle);
    cache.reset();
    await checkFrameRetrievalBackwards(cache, first, last, angle);
  }

  async function checkFrameRetrievalForwards(
    cache: VideoFrameCache,
    first: number,
    last: number,
    angle: number,
  ) {
    let prevFrame: ImageBitmap | undefined;
    for (let i = first; i < last; i++) {
      const frame = await retrieveFrame(
        cache,
        i,
        angle,
        PlaybackState.FORWARDS,
      );
      if (prevFrame) {
        expect(frame === prevFrame).toBeFalse();
      }
      prevFrame = frame;
    }
  }

  async function checkFrameRetrievalBackwards(
    cache: VideoFrameCache,
    first: number,
    last: number,
    angle: number,
  ) {
    let prevFrame: ImageBitmap | undefined;
    for (let i = last - 1; i >= first; i--) {
      const frame = await retrieveFrame(
        cache,
        i,
        angle,
        PlaybackState.BACKWARDS,
      );
      if (prevFrame) {
        expect(frame === prevFrame).toBeFalse();
      }
      prevFrame = frame;
    }
  }

  async function retrieveFrame(
    cache: VideoFrameCache,
    i: number,
    expectedAngle: number,
    state: PlaybackState,
  ): Promise<ImageBitmap> {
    const entry = await cache.get(i, state);
    const {frame, rotationAngle} = entry;
    expect(rotationAngle).toEqual(expectedAngle);
    return frame;
  }
});

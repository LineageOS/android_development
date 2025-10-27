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

import {getFixtureFile} from 'test/unit/io_helpers';
import {createVideoFrameCache} from './video_frame_cache_factory';

describe('VideoFrameCache', () => {
  let dataOneKeyFrameAndRotation: Uint8Array;
  let dataThreeKeyFramesNoRotation: Uint8Array;

  beforeAll(async () => {
    const file1 = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/screen_recording_metadata_v3.mp4',
    );
    dataOneKeyFrameAndRotation = new Uint8Array(await file1.arrayBuffer());

    const file2 = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/screen_recording_no_metadata.mp4',
    );
    dataThreeKeyFramesNoRotation = new Uint8Array(await file2.arrayBuffer());
  });

  it('throws error if retrieval attempted out of bounds', async () => {
    const cache = await createVideoFrameCache(dataOneKeyFrameAndRotation);
    await expectAsync(cache.get(105)).toBeRejected();
  });

  it('retrieves all samples from mp4 with one key frame', async () => {
    const cache = await createVideoFrameCache(dataOneKeyFrameAndRotation);

    let prevTimestamp = -1;
    for (let i = 0; i < 105; i++) {
      const {frame, rotationAngle} = await cache.get(i);
      expect(rotationAngle).toEqual(90);
      expect(frame.timestamp).not.toBe(prevTimestamp);
      prevTimestamp = frame.timestamp;
    }
  });

  it('retrieves all samples from mp4 with multiple key frames', async () => {
    const cache = await createVideoFrameCache(dataThreeKeyFramesNoRotation);

    let prevTimestamp = -1;
    for (let i = 0; i < 158; i++) {
      const {frame, rotationAngle} = await cache.get(i);
      expect(rotationAngle).toEqual(0);
      expect(frame.timestamp).not.toBe(prevTimestamp);
      prevTimestamp = frame.timestamp;
    }
  });
});

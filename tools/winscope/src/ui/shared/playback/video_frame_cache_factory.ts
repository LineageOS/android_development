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

import {parseWebCodecData} from '@trace/media_based/helpers';

import {VideoFrameCache} from './video_frame_cache';

/**
 * Parses video data using mp4box into EncodedVideoChunks that are used by
 * VideoFrameCache to decode data into VideoFrames for rendering.
 */
export async function createVideoFrameCache(
  videoData: Uint8Array,
): Promise<VideoFrameCache> {
  const webCodecData = await parseWebCodecData(videoData);
  return new VideoFrameCache(webCodecData);
}

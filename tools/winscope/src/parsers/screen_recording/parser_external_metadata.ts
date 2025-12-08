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

import {ScreenRecordingOffsets} from 'trace_api/trace_metadata';
import {
  ParserResult,
  parseTimestampsFromMp4VideoTrack,
  ScreenRecordingParser,
} from './utils';

export class ParserExternalMetadata implements ScreenRecordingParser {
  private offsets: ScreenRecordingOffsets;

  constructor(offsets: ScreenRecordingOffsets) {
    this.offsets = offsets;
  }

  async parse(videoData: Uint8Array): Promise<ParserResult> {
    const realToBootTimeOffsetNs = this.offsets.realToElapsedTimeOffsetNanos;
    const timestamps = await parseTimestampsFromMp4VideoTrack(
      videoData,
      this.offsets.elapsedRealTimeNanos,
    );
    return {timestamps, realToBootTimeOffsetNs};
  }
}

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

import {
  parseIntFromBuffer,
  parseLongFromBuffer,
  ParserResult,
  ScreenRecordingParser,
} from './utils';

//  Metadata v2 is written as a binary array with the following format:
//  - Winscope magic string
//  - Metadata version number (4B little endian)
//  - Realtime-to-elapsed time offset in ns (8B little endian)
//  - Recorded frames count (4B little endian)
//  - For each recorded frame:
//      - System time in elapsed clock timebase in ns (8B little endian)

export class ParserMetadataV1Or2 implements ScreenRecordingParser {
  private posTimeOffset: number;

  constructor(posTimeOffset: number) {
    this.posTimeOffset = posTimeOffset;
  }

  async parse(videoData: Uint8Array): Promise<ParserResult> {
    const [posCount, realToBootTimeOffsetNs] = parseLongFromBuffer(
      videoData,
      this.posTimeOffset,
    );
    const [posTimestamps, count] = parseIntFromBuffer(videoData, posCount);
    if (posTimestamps + count * 8 > videoData.length) {
      throw new TypeError(
        'Failed to parse timestamps. Video data is too short.',
      );
    }
    const timestamps: Array<bigint> = [];
    let pos = posTimestamps;
    for (let i = 0; i < count; ++i) {
      const [newPos, timestamp] = parseLongFromBuffer(videoData, pos);
      pos = newPos;
      timestamps.push(timestamp);
    }
    return {timestamps, realToBootTimeOffsetNs};
  }
}

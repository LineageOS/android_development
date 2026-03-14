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

import {assertTrue} from '@common/assert';
import {startsWithMagicNumber} from '@common/magic_number_helpers';
import {Sample} from 'mp4box';

import {extractSamplesFromMp4Track, parseLongFromBuffer, ParserResult, ScreenRecordingParser, WINSCOPE_MAGIC_STRING,} from './helpers';

// Metadata v3 is written sample-by-sample. Each sample contains:
// - Realtime-to-elapsed time offset in ns (8B little endian)
// - Elapsed time accounting for elapsed-to-monotonic offset in ns (8B little endian)

// The first sample also contains the following data preceding the above:
// - Winscope magic string (#VV1NSC0PET1ME2#, 16B)
// - Metadata version number (4B little endian)

export class ParserMetadataV3 implements ScreenRecordingParser {
  async parse(videoData: Uint8Array): Promise<ParserResult> {
    // do not set boot time offset as it is more accurate to use the updated offsets
    // from each sample

    const samples = await extractSamplesFromMp4Track(videoData, (info) => {
      assertTrue(info.videoTracks.length === 1);
      assertTrue(info.metadataTracks.length === 1);
      return info.metadataTracks[0];
    });

    const timestamps: bigint[] = [];
    samples.forEach((sample: Sample) => {
      let offset = 0;
      if (startsWithMagicNumber(sample.data, WINSCOPE_MAGIC_STRING)) {
        // magic string + version number (int)
        offset = WINSCOPE_MAGIC_STRING.length + 4;
      }

      let realToElapsedOffsetNs: bigint;
      let elapsedTimeNs: bigint;
      [offset, realToElapsedOffsetNs] = parseLongFromBuffer(
        sample.data,
        offset,
      );
      [offset, elapsedTimeNs] = parseLongFromBuffer(sample.data, offset);
      timestamps.push(elapsedTimeNs + realToElapsedOffsetNs);
    });
    return {
      timestamps,
      realToBootTimeOffsetNs: 0n,
    };
  }
}

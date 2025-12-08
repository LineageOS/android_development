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

import {assertTrue} from 'common/assert';
import {Sample} from 'mp4box';
import {startsWithMagicNumber} from 'parsers/legacy/parsing_utils';
import {
  MP4FileOnReady,
  parseLongFromBuffer,
  ParserResult,
  parseTimestampsFromMp4Track,
  ScreenRecordingParser,
  WINSCOPE_MAGIC_STRING,
} from './utils';

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

    const onReady: MP4FileOnReady = (info, mp4File, timestamps, resolve) => {
      assertTrue(info.videoTracks.length === 1);
      assertTrue(info.metadataTracks.length === 1);
      mp4File.onSamples = (id, _, samples) => {
        if (id !== info.metadataTracks[0].id) {
          throw new Error(`Unexpected track extracted: id ${id}`);
        }
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
        resolve();
      };
      mp4File.setExtractionOptions(info.metadataTracks[0].id);
    };
    return {
      timestamps: await parseTimestampsFromMp4Track(videoData, onReady),
      realToBootTimeOffsetNs: 0n,
    };
  }
}

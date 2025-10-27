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

import {assertDefined} from 'common/assert';
import {MP4FileOnReady, parseMp4, WebCodecData} from './helpers';
import {AvcCBox, Sample} from 'mp4box';
import {TransformMatrix} from 'common/geometry/transform_matrix';
import {VideoFrameCache, KEY_FRAME_TYPE} from './video_frame_cache';

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

async function parseWebCodecData(videoData: Uint8Array): Promise<WebCodecData> {
  const chunks: EncodedVideoChunk[] = [];
  let config: VideoDecoderConfig | undefined;
  let duration: number | undefined;
  let rotationAngle = 0;

  const onReady: MP4FileOnReady = (info, mp4File, resolve) => {
    const videoTrack = info.videoTracks[0];
    const codec = videoTrack.codec;
    duration = videoTrack.duration;

    const codedWidth = videoTrack.video.width;
    const codedHeight = videoTrack.video.height;

    if (videoTrack.matrix) {
      rotationAngle = getRotationAngle(videoTrack.matrix);
    }

    config = {
      codec,
      codedWidth,
      codedHeight,
      description: undefined,
    };

    mp4File.onSamples = (id, user, samples) => {
      samples.forEach((sample: Sample) => {
        if (
          config &&
          config.description === undefined &&
          sample.description.avcC
        ) {
          const avcConfigBox = sample.description.avcC;
          config.description = serializeAvcC(avcConfigBox);
        }
        const data = sample.data;
        const type = sample.is_sync ? KEY_FRAME_TYPE : DELTA_FRAME_TYPE;
        const timestamp = (sample.cts / sample.timescale) * 1000000;

        const encodedChunk = new EncodedVideoChunk({
          type,
          timestamp,
          data,
        });
        chunks.push(encodedChunk);
      });
      resolve();
    };

    mp4File.setExtractionOptions(videoTrack.id);
  };

  await parseMp4(videoData, onReady);
  return {
    chunks,
    config: assertDefined(config),
    duration: assertDefined(duration),
    rotationAngle: assertDefined(rotationAngle),
  };
}

function getRotationAngle(videoMatrix: Int32Array): number {
  const matrix = new TransformMatrix(
    videoMatrix[0] / SCALE_FACTOR_16_16, // dsdx
    videoMatrix[3] / SCALE_FACTOR_16_16, // dtdx
    0,
    videoMatrix[1] / SCALE_FACTOR_16_16, // dtdy
    videoMatrix[4] / SCALE_FACTOR_16_16, // dsdy
    0,
  );
  return matrix.getRotationAngle();
}

// Manually serialization required as there is a bug in the write() method
// from mp4box that prevents VideoDecoderConfig from decoding the box
function serializeAvcC(avcConfigBox: AvcCBox) {
  const spsNalu = avcConfigBox.SPS[0].data; // Sequence Parameter Sets (SPS)
  const ppsNalu = avcConfigBox.PPS[0].data; // Picture Parameter Sets (PPS)

  // Total size usually 34B:
  // - 5B: Fixed header fields
  // - 1B: Number of SPS NALUs (always 1)
  // - 2B: SPS NALU length
  // - 19B: SPS payload
  // - 1B: Number of PPS NALUs
  // - 2B: PPS NALU length
  // - 4B: PPS payload
  const totalSize =
    5 +
    1 +
    2 +
    spsNalu.byteLength +
    avcConfigBox.nb_PPS_nalus +
    2 +
    ppsNalu.byteLength;

  const serialized = new Uint8Array(totalSize);
  let offset = 0;

  // Fixed header fields
  serialized[offset++] = avcConfigBox.configurationVersion;
  serialized[offset++] = avcConfigBox.AVCProfileIndication;
  serialized[offset++] = avcConfigBox.profile_compatibility;
  serialized[offset++] = avcConfigBox.AVCLevelIndication;
  serialized[offset++] = 0xff; // NALU length size

  // Number of SPS NALUs
  serialized[offset++] = 0xe1;

  // SPS NALU Length
  serialized[offset++] = (spsNalu.byteLength >> 8) & 0xff;
  serialized[offset++] = spsNalu.byteLength & 0xff;

  // SPS payload
  serialized.set(spsNalu, offset);
  offset += spsNalu.byteLength;

  // number of PPS NALUs
  serialized[offset++] = avcConfigBox.nb_PPS_nalus;

  // PPS NALU Length
  serialized[offset++] = (ppsNalu.byteLength >> 8) & 0xff;
  serialized[offset++] = ppsNalu.byteLength & 0xff;

  // PPS payload
  serialized.set(ppsNalu, offset);

  return serialized.buffer;
}

const DELTA_FRAME_TYPE = 'delta';
const SCALE_FACTOR_16_16 = 65536;

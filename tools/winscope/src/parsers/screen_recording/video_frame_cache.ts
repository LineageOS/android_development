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

/**
 * Decodes and caches video frames for visualisation in the UI. Uses a
 * single buffer cache storing all frames in the key-frame range associated
 * with the last requested index.
 */
export class VideoFrameCache {
  private static readonly KEY_FRAME_TYPE = 'key';
  private static readonly DELTA_FRAME_TYPE = 'delta';
  private static readonly SCALE_FACTOR_16_16 = 65536;

  private webCodecData: WebCodecData | undefined;
  private cache: Map<number, VideoFrame> = new Map();

  async initialize(videoData: Uint8Array) {
    this.webCodecData = await this.parseWebCodecData(videoData);
  }

  async get(
    index: number,
  ): Promise<{frame: VideoFrame; rotationAngle: number}> {
    const webCodecData = assertDefined(this.webCodecData);
    const frame = this.cache.get(index);
    if (frame) {
      return {frame, rotationAngle: webCodecData.rotationAngle};
    }
    await this.updateCache(index, webCodecData);
    return {
      frame: assertDefined(this.cache.get(index)),
      rotationAngle: webCodecData.rotationAngle,
    };
  }

  private async updateCache(target: number, webCodecData: WebCodecData) {
    this.cache.clear();

    let prevKeyFrameIndex = 0;
    for (let i = target; i >= 0; i--) {
      if (webCodecData.chunks[i].type === VideoFrameCache.KEY_FRAME_TYPE) {
        prevKeyFrameIndex = i;
        break;
      }
    }

    let frameIndex = prevKeyFrameIndex;
    const onOutput = (frame: VideoFrame) => {
      this.cache.set(frameIndex, frame);
      frameIndex++;
    };
    const frameDecoder = this.createFrameDecoder(webCodecData, onOutput);

    let i = prevKeyFrameIndex;
    do {
      frameDecoder.decode(webCodecData.chunks[i]);
      i++;
    } while (
      i < webCodecData.chunks.length &&
      webCodecData.chunks[i].type !== VideoFrameCache.KEY_FRAME_TYPE
    );

    await frameDecoder.flush();
  }

  private createFrameDecoder(
    webCodecData: WebCodecData,
    onOutput: (frame: VideoFrame) => void,
  ): VideoDecoder {
    const decoder = new VideoDecoder({
      output: onOutput,
      error: (e) => {
        console.error('VideoDecoder Error:', e);
      },
    });
    decoder.configure(webCodecData.config);
    return decoder;
  }

  private async parseWebCodecData(
    videoData: Uint8Array,
  ): Promise<WebCodecData> {
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
        rotationAngle = this.getRotationAngle(videoTrack.matrix);
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
            config.description = this.serializeAvcC(avcConfigBox);
          }
          const data = sample.data;
          const type = sample.is_sync
            ? VideoFrameCache.KEY_FRAME_TYPE
            : VideoFrameCache.DELTA_FRAME_TYPE;
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

  private getRotationAngle(videoMatrix: Int32Array): number {
    const matrix = new TransformMatrix(
      videoMatrix[0] / VideoFrameCache.SCALE_FACTOR_16_16, // dsdx
      videoMatrix[3] / VideoFrameCache.SCALE_FACTOR_16_16, // dtdx
      0,
      videoMatrix[1] / VideoFrameCache.SCALE_FACTOR_16_16, // dtdy
      videoMatrix[4] / VideoFrameCache.SCALE_FACTOR_16_16, // dsdy
      0,
    );
    return matrix.getRotationAngle();
  }

  // Manually serialization required as there is a bug in the write() method
  // from mp4box that prevents VideoDecoderConfig from decoding the box
  private serializeAvcC(avcConfigBox: AvcCBox) {
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
}

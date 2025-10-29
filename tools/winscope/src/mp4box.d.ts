/*
 * Copyright (C) 2024 The Android Open Source Project
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

declare module 'mp4box' {
  // mp4box does not have TypeScript support, so we must declare the types below
  export interface FileInfo {
    tracks: Track[];
    videoTracks: Track[];
    metadataTracks: Track[];
  }

  export interface Track {
    id: number;
    nb_samples: number;
    timescale: number;
    codec: string;
    video: {width: number; height: number};
    duration: number;
    matrix: Int32Array;
  }

  export interface Sample {
    number: number;
    duration: number;
    timescale: number;
    data: Uint8Array;
    is_sync: boolean;
    cts: number;
    description: {avcC?: AvcCBox};
  }

  export interface AvcCBox {
    SPS: Array<{length: number; data: Uint8Array}>;
    PPS: Array<{length: number; data: Uint8Array}>;
    configurationVersion: number;
    AVCProfileIndication: number;
    profile_compatibility: number;
    AVCLevelIndication: number;
    nb_PPS_nalus: number;
    nb_SPS_nalus: number;
  }

  export type MP4ArrayBuffer = ArrayBuffer & {fileStart: number};

  export interface MP4File {
    onReady?: (info: FileInfo) => void;
    onSamples?: (id: number, user: unknown, samples: Sample[]) => void;
    appendBuffer(data: MP4ArrayBuffer): number;
    start(): void;
    setExtractionOptions(
      trackId: number,
      user?: unknown,
      options?: {nbSamples?: number; rapAlignment?: number},
    ): void;
    flush(): void;
  }

  export function createFile(): MP4File;

  export interface MP4BoxBuffer extends ArrayBuffer {
    fileStart: number;
  }
}

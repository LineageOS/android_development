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

import {TIME_UNIT_TO_NANO} from 'common/time/time_units';
import {createFile, FileInfo, MP4ArrayBuffer, MP4File, Sample} from 'mp4box';

export type MP4FileOnReady = (
  info: FileInfo,
  mp4File: MP4File,
  timestamps: Array<bigint>,
  resolve: (value: void | PromiseLike<void>) => void,
) => void;

export interface ScreenRecordingParser {
  parse(videoData: Uint8Array): Promise<ParserResult>;
}

export interface ParserResult {
  timestamps: Array<bigint>;
  realToBootTimeOffsetNs: bigint;
}

export const WINSCOPE_MAGIC_STRING = [
  0x23, 0x56, 0x56, 0x31, 0x4e, 0x53, 0x43, 0x30, 0x50, 0x45, 0x54, 0x31, 0x4d,
  0x45, 0x32, 0x23,
]; // #VV1NSC0PET1ME2#

export async function parseTimestampsFromMp4VideoTrack(
  videoData: Uint8Array,
  elapsedRealTimeNanos: bigint,
): Promise<Array<bigint>> {
  const onReady: MP4FileOnReady = (info, mp4File, timestamps, resolve) => {
    mp4File.onSamples = (id, user, samples) => {
      let curr = elapsedRealTimeNanos;
      samples.forEach((sample: Sample) => {
        const timeSeconds = sample.duration / sample.timescale;
        const timeNs = BigInt(Math.floor(TIME_UNIT_TO_NANO.s * timeSeconds));
        curr += timeNs;
        timestamps.push(curr);
      });
      resolve();
    };
    mp4File.setExtractionOptions(info.tracks[0].id);
  };
  return parseTimestampsFromMp4Track(videoData, onReady);
}

export async function parseTimestampsFromMp4Track(
  videoData: Uint8Array,
  onReady: MP4FileOnReady,
): Promise<Array<bigint>> {
  const arrayBuffer = videoData.buffer.slice(
    videoData.byteOffset,
    videoData.byteLength + videoData.byteOffset,
  );
  const timestamps: Array<bigint> = [];
  // There's an export issue with the createFile alias for TypeScript (1.5.0 - Jun 2025)
  // It fails with the error below, use this as a bypass until the library is fixed.
  // ERROR in src/parsers/screen_recording/parser_screen_recording.ts:288:48
  // - error TS2554: Expected 0 arguments, but got 2.
  const createFileAny = createFile as any;
  const mp4File: MP4File = createFileAny(true, undefined);
  await new Promise<void>((resolve) => {
    mp4File.onReady = (info) => onReady(info, mp4File, timestamps, resolve);
    const buffer = arrayBuffer as MP4ArrayBuffer;
    buffer.fileStart = 0;
    mp4File.appendBuffer(buffer);
    mp4File.start();
  });
  return timestamps;
}

export function parseLongFromBuffer(
  videoData: Uint8Array,
  pos: number,
): [number, bigint] {
  if (pos + 8 > videoData.length) {
    throw new TypeError('Failed to parse Long. Video data is too short.');
  }
  const value = toIntLittleEndian(videoData, pos, pos + 8);
  pos += 8;
  return [pos, value];
}

export function parseIntFromBuffer(
  videoData: Uint8Array,
  pos: number,
): [number, number] {
  if (pos + 4 > videoData.length) {
    throw new TypeError('Failed to parse Int. Video data is too short.');
  }
  const value = Number(toUintLittleEndian(videoData, pos, pos + 4));
  pos += 4;
  return [pos, value];
}

/**
 * Converts an array of bytes to a bigint in little-endian order.
 *
 * @param buffer The array of bytes to convert.
 * @param start The starting index of the bytes to convert.
 * @param end The ending index of the bytes to convert.
 * @return The bigint representation of the bytes in little-endian order.
 */
export function toUintLittleEndian(
  buffer: Uint8Array,
  start: number,
  end: number,
): bigint {
  let result = 0n;
  for (let i = end - 1; i >= start; --i) {
    result *= 256n;
    result += BigInt(buffer[i]);
  }
  return result;
}

/**
 * Converts an array of bytes to a bigint in little-endian order, treating the
 * bytes as a signed integer.
 *
 * @param buffer The array of bytes to convert.
 * @param start The starting index of the bytes to convert.
 * @param end The ending index of the bytes to convert.
 * @return The bigint representation of the bytes in little-endian order,
 *   treating the bytes as a signed integer.
 */
export function toIntLittleEndian(
  buffer: Uint8Array,
  start: number,
  end: number,
): bigint {
  const numOfBits = BigInt(Math.max(0, 8 * (end - start)));
  if (numOfBits <= 0n) {
    return 0n;
  }

  let result = toUintLittleEndian(buffer, start, end);
  const maxSignedValue = 2n ** (numOfBits - 1n) - 1n;
  if (result > maxSignedValue) {
    const valuesRange = 2n ** numOfBits;
    result -= valuesRange;
  }

  return result;
}

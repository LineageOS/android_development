/*
 * Copyright (C) 2022 The Android Open Source Project
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

import {searchSubarray} from 'common/typed_array';
import {Timestamp} from 'common/time/time';
import {TIME_UNIT_TO_NANO} from 'common/time/time_units';
import {AbstractParser} from 'parsers/legacy/abstract_parser';
import {timestampToVideoTimeSeconds} from 'trace/screen_recording_utils';
import {MediaBasedTraceEntry} from 'trace_api/media_based_trace_entry';
import {TraceType} from 'trace_api/trace_type';
import {parseIntFromBuffer, parseLongFromBuffer} from './utils';

export class ParserScreenRecordingLegacy extends AbstractParser<
  MediaBasedTraceEntry,
  bigint
> {
  override getTraceType(): TraceType {
    return TraceType.SCREEN_RECORDING;
  }

  override getMagicNumber(): number[] {
    return ParserScreenRecordingLegacy.MPEG4_MAGIC_NUMBER;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override decodeTrace(videoData: Uint8Array): Array<bigint> {
    const posCount = this.searchMagicString(videoData);
    const [posTimestamps, count] = parseIntFromBuffer(videoData, posCount);
    return this.parseVideoData(videoData, posTimestamps, count);
  }

  protected override getTimestamp(decodedEntry: bigint): Timestamp {
    return this.timestampConverter.makeTimestampFromMonotonicNs(decodedEntry);
  }

  override processDecodedEntry(
    index: number,
    entry: bigint,
  ): MediaBasedTraceEntry {
    const videoTimeSeconds = timestampToVideoTimeSeconds(
      this.decodedEntries[0],
      entry,
    );
    const videoData = this.traceFile.file;
    return new MediaBasedTraceEntry(videoTimeSeconds, videoData);
  }

  private searchMagicString(videoData: Uint8Array): number {
    let pos = searchSubarray(
      videoData,
      ParserScreenRecordingLegacy.WINSCOPE_META_MAGIC_STRING,
    );
    if (pos === undefined) {
      throw new TypeError("video data doesn't contain winscope magic string");
    }
    pos += ParserScreenRecordingLegacy.WINSCOPE_META_MAGIC_STRING.length;
    return pos;
  }

  private parseVideoData(
    videoData: Uint8Array,
    pos: number,
    count: number,
  ): Array<bigint> {
    if (pos + count * 8 > videoData.length) {
      throw new TypeError(
        'Failed to parse timestamps. Video data is too short.',
      );
    }
    const timestamps: Array<bigint> = [];
    for (let i = 0; i < count; ++i) {
      const [newPos, timestamp] = parseLongFromBuffer(videoData, pos);
      pos = newPos;
      timestamps.push(timestamp * BigInt(TIME_UNIT_TO_NANO.us));
    }
    return timestamps;
  }

  private static readonly MPEG4_MAGIC_NUMBER = [
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32,
  ]; // ....ftypmp42
  private static readonly WINSCOPE_META_MAGIC_STRING = [
    0x23, 0x56, 0x56, 0x31, 0x4e, 0x53, 0x43, 0x30, 0x50, 0x45, 0x54, 0x31,
    0x4d, 0x45, 0x21, 0x23,
  ]; // #VV1NSC0PET1ME!#
}

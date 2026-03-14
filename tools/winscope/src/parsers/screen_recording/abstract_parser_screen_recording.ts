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

import {searchSubarray} from '@common/typed_array';
import {AbstractParser} from '@parsers/non_perfetto/abstract_parser';
import {TraceType} from '@trace_api/trace_type';
import {timestampToVideoTimeSeconds} from '@trace/media_based/helpers';
import {MediaBasedTraceEntry, VideoEntry,} from '@trace/media_based/media_based_trace_entry';
import {Thumbnail} from '@trace/media_based/thumbnail';

import {ThumbnailGenerator} from './thumbnail_generator';

export abstract class AbstractParserScreenRecording extends AbstractParser<
  bigint,
  MediaBasedTraceEntry
> {
  static readonly TRACE_TYPE = TraceType.SCREEN_RECORDING;
  private thumbnail: Thumbnail | undefined;
  private thumbnailGenerator: ThumbnailGenerator | undefined;

  override onDestroy() {
    this.thumbnailGenerator?.onDestroy();
    this.thumbnail?.onDestroy();
  }

  override getTraceType(): TraceType {
    return TraceType.SCREEN_RECORDING;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  protected queueThumbnailGeneration(videoData: Uint8Array) {
    this.thumbnailGenerator = new ThumbnailGenerator().setVideoData(videoData);
    this.thumbnailGenerator.generate().then((thumbnail) => {
      this.thumbnail = thumbnail;
      this.thumbnailGenerator = undefined;
    });
  }

  protected override async processDecodedEntry(
    index: number,
  ): Promise<MediaBasedTraceEntry> {
    const time = timestampToVideoTimeSeconds(
      this.decodedEntries[0],
      this.decodedEntries[index],
    );
    const videoData = this.getFiles()[0].file;
    return new VideoEntry(videoData, time, this.thumbnail);
  }

  protected searchMagicString(
    videoData: Uint8Array,
    magicString: number[],
  ): number | undefined {
    const pos = searchSubarray(videoData, magicString);
    if (pos === undefined) {
      return undefined;
    }
    return pos + magicString.length;
  }
}

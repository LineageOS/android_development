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

import {Timestamp} from '@common/time/time';
import {makeWarningMonotonicScreenRecording} from '@parsers/helpers/warnings';
import {UserNotifier} from '@services/user_notifier';
import {CoarseVersion} from '@trace_api/coarse_version';

import {AbstractParserScreenRecording} from './abstract_parser_screen_recording';
import {parseIntFromBuffer, ScreenRecordingParser, WINSCOPE_MAGIC_STRING,} from './helpers';
import {ParserExternalMetadata} from './parser_external_metadata';
import {ParserFilename} from './parser_filename';
import {ParserMetadataV1Or2} from './parser_metadata_v1_or_v2';
import {ParserMetadataV3} from './parser_metadata_v3';

export class ParserScreenRecording extends AbstractParserScreenRecording {
  private realToBootTimeOffsetNs: bigint | undefined;
  private makeTimestampFromExactValue = false;

  protected override getMagicNumber(): number[] {
    return [];
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  override getCoarseVersion(): CoarseVersion {
    return CoarseVersion.LATEST;
  }

  protected override async decodeTrace(
    videoData: Uint8Array,
  ): Promise<readonly bigint[]> {
    const posVersion = this.searchMagicString(videoData, WINSCOPE_MAGIC_STRING);

    let parser: ScreenRecordingParser;
    if (posVersion !== undefined) {
      parser = this.getParserForEmbeddedMetadata(videoData, posVersion);
    } else if (this.metadata?.screenRecordingOffsets !== undefined) {
      parser = new ParserExternalMetadata(this.metadata.screenRecordingOffsets);
    } else {
      parser = new ParserFilename(this.traceFile.file.name);
    }

    const result = await parser.parse(videoData);
    this.realToBootTimeOffsetNs = result.realToBootTimeOffsetNs;
    if (result.realToBootTimeOffsetNs === 0n) {
      this.makeTimestampFromExactValue = true;
    }
    this.queueThumbnailGeneration(videoData);
    return result.timestamps;
  }

  protected override getTimestamp(decodedEntry: bigint): Timestamp {
    if (this.makeTimestampFromExactValue) {
      return this.timestampConverter.makeTimestampFromRealNs(decodedEntry);
    }
    return this.timestampConverter.makeTimestampFromBootTimeNs(decodedEntry);
  }

  private getParserForEmbeddedMetadata(
    videoData: Uint8Array,
    posVersion: number,
  ): ScreenRecordingParser {
    const [posTimeOffset, metadataVersion] = parseIntFromBuffer(
      videoData,
      posVersion,
    );

    if (metadataVersion < 1 || metadataVersion > 3) {
      throw new TypeError(
        `Metadata version "${metadataVersion}" not supported`,
      );
    }

    if (metadataVersion === 3) {
      return new ParserMetadataV3();
    }

    if (metadataVersion === 1) {
      // UI traces contain "elapsed" timestamps (SYSTEM_TIME_BOOTTIME), whereas
      // metadata Version 1 contains SYSTEM_TIME_MONOTONIC timestamps.
      //
      // Here we are pretending that metadata Version 1 contains "elapsed"
      // timestamps as well, in order to synchronize with the other traces.
      //
      // If no device suspensions are involved, SYSTEM_TIME_MONOTONIC should
      // indeed correspond to SYSTEM_TIME_BOOTTIME and things will work as
      // expected.
      UserNotifier.add(makeWarningMonotonicScreenRecording());
    }
    return new ParserMetadataV1Or2(posTimeOffset);
  }
}

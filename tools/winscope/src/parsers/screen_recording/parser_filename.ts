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

import {removeDirFromFileName, removeExtensionFromFilename} from '@common/io';
import {TIME_UNIT_TO_NANO} from '@common/time/time_units';
import {getLogger, Logger} from '@compat/logging';

import {ParserResult, parseTimestampsFromMp4VideoTrack, ScreenRecordingParser,} from './helpers';

export class ParserFilename implements ScreenRecordingParser {
  constructor(
    private filename: string,
    private readonly logger: Logger = getLogger('ParserFilename'),
  ) {}

  async parse(videoData: Uint8Array): Promise<ParserResult> {
    // try parse offset from filename
    let filename = removeDirFromFileName(this.filename);
    filename = removeExtensionFromFilename(filename);
    let offsetMs = AndroidScreenRecording.tryParseFilename(filename);
    if (offsetMs === undefined) {
      offsetMs = ScreenRecordingWithUID.tryParseFilename(filename);
    }

    if (offsetMs !== undefined) {
      try {
        const offset = offsetMs * TIME_UNIT_TO_NANO.ms;
        // set realToBootTimeOffsetNs as 0n as we only have the real
        // start time of the recording
        return {
          timestamps: await this.parseTimestampsUsingFilenameOffset(
            videoData,
            offset,
          ),
          realToBootTimeOffsetNs: 0n,
        };
      } catch (e) {
        this.logger.error((e as Error).message);
      }
    }

    throw new TypeError(
      'Cannot parse screen recording. Video data does not contain winscope magic string. ' +
        'Metadata JSON not provided. ' +
        'Filename does not contain offset.',
    );
  }

  private async parseTimestampsUsingFilenameOffset(
    videoData: Uint8Array,
    offset: bigint,
  ): Promise<bigint[]> {
    const timestampsElapsedNs = await parseTimestampsFromMp4VideoTrack(
      videoData,
      offset,
    );
    return timestampsElapsedNs;
  }
}

const START_TIME_REGEX = /^[0-9]+$/;

class AndroidScreenRecording {
  private static readonly DATE_REGEX = /^[0-9]{4}[0-9]{2}[0-9]{2}$/;
  private static readonly TIME_REGEX = /^[0-9]{2}[0-9]{2}[0-9]{2}$/;

  static tryParseFilename(filename: string): bigint | undefined {
    // expected filename: screen-YYYYMMDD-HHmmss-<start_time_ms>
    const [screen, saveDate, saveTime, startTimeMs] = filename.split('-');
    if (!screen.endsWith('screen')) {
      return undefined;
    }
    if (
      saveDate === undefined ||
      !AndroidScreenRecording.DATE_REGEX.test(saveDate)
    ) {
      return undefined;
    }
    if (
      saveTime === undefined ||
      !AndroidScreenRecording.TIME_REGEX.test(saveTime)
    ) {
      return undefined;
    }
    if (startTimeMs === undefined || !START_TIME_REGEX.test(startTimeMs)) {
      return undefined;
    }

    return BigInt(startTimeMs);
  }
}

class ScreenRecordingWithUID {
  private static readonly DATE_REGEX = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
  private static readonly TIME_REGEX = /^[0-9]{2}-[0-9]{2}-[0-9]{2}$/;
  private static readonly UID_REGEX = /^[0-9a-f]{32}$/;

  static tryParseFilename(filename: string): bigint | undefined {
    // expected filename: YYYY-MM-DD_HH-mm-ss-<uid>-<start_time_ms>-screen
    const [date, rem] = filename.split('_');
    if (rem === undefined || !ScreenRecordingWithUID.DATE_REGEX.test(date)) {
      return undefined;
    }
    const time = rem.slice(0, 8);
    if (!ScreenRecordingWithUID.TIME_REGEX.test(time)) {
      return undefined;
    }

    const [uid, startTimeMs, suffix] = rem.slice(9).split('-');
    if (!ScreenRecordingWithUID.UID_REGEX.test(uid)) {
      return undefined;
    }
    if (suffix !== 'screen') {
      return undefined;
    }
    if (startTimeMs === undefined || !START_TIME_REGEX.test(startTimeMs)) {
      return undefined;
    }

    return BigInt(startTimeMs);
  }
}

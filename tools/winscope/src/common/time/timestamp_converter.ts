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

import {assertDefined, assertTrue} from '@common/assert';

import {INVALID_TIME_NS, Timestamp} from './time';
import {TIME_UNIT_TO_NANO, TIME_UNITS} from './time_units';
import {ELAPSED_TIMESTAMP_FORMATTER, REAL_TIMESTAMP_FORMATTER_UTC, RealTimestampFormatter, TimestampType,} from './timestamp_formatter';
import {UserTimestamp} from './user_timestamp';
import {UTCOffset} from './utc_offset';

/**
 * An interface for converting timestamps for parsers.
 */
export declare interface ParserTimestampConverter {
  makeTimestampFromRealNs(valueNs: bigint): Timestamp;
  makeTimestampFromMonotonicNs(valueNs: bigint): Timestamp;
  makeTimestampFromBootTimeNs(valueNs: bigint): Timestamp;
  makeZeroTimestamp(): Timestamp;
}

/**
 * An interface for converting timestamps for UI components.
 */
export declare interface ComponentTimestampConverter {
  makeTimestampFromHuman(timestampHuman: string | UserTimestamp): Timestamp;
  getUTCOffset(): string;
  makeTimestampFromNs(valueNs: bigint): Timestamp;
  makeTimestampFromBootTimeNs(valueNs: bigint): Timestamp;
  makeTimestampFromRealNs(valueNs: bigint): Timestamp;
  validateHumanInput(timestampHuman: string): boolean;
  canMakeRealTimestamps(): boolean;
}

/**
 * An interface for converting timestamps for remote tools.
 */
export declare interface RemoteToolTimestampConverter {
  makeTimestampFromBootTimeNs(valueNs: bigint): Timestamp;
  makeTimestampFromRealNs(valueNs: bigint): Timestamp;
  tryGetBootTimeNs(timestamp: Timestamp): bigint | undefined;
  tryGetRealTimeNs(timestamp: Timestamp): bigint | undefined;
}

/**
 * A class for converting timestamps between different formats.
 */
export class TimestampConverter
  implements
    ParserTimestampConverter,
    ComponentTimestampConverter,
    RemoteToolTimestampConverter
{
  private createdTimestampType: TimestampType | undefined;
  private utcOffset = new UTCOffset();
  private readonly realTimestampFormatter = new RealTimestampFormatter(
    this.utcOffset,
  );

  /**
   * @param realToMonotonicTimeOffsetNs The offset between real and monotonic time.
   * @param realToBootTimeOffsetNs The offset between real and boottime.
   */
  constructor(
    private realToMonotonicTimeOffsetNs?: bigint,
    private realToBootTimeOffsetNs?: bigint,
  ) {}

  /**
   * Sets the UTC offset.
   *
   * @param utcOffset The UTC offset.
   */
  setUTCOffset(utcOffset: UTCOffset) {
    this.utcOffset = utcOffset;
    this.realTimestampFormatter.setUTCOffset(this.utcOffset);
    this.createdTimestampType = TimestampType.REAL;
  }

  /**
   * Sets the real-to-monotonic time offset.
   *
   * @param ns The offset in nanoseconds.
   */
  setRealToMonotonicTimeOffsetNs(ns: bigint) {
    if (this.realToMonotonicTimeOffsetNs !== undefined) {
      return;
    }
    this.realToMonotonicTimeOffsetNs = ns;
  }

  /**
   * Sets the real-to-boottime time offset.
   *
   * @param ns The offset in nanoseconds.
   */
  setRealToBootTimeOffsetNs(ns: bigint) {
    if (this.realToBootTimeOffsetNs !== undefined) {
      return;
    }
    this.realToBootTimeOffsetNs = ns;
  }

  /**
   * Gets the UTC offset.
   *
   * @return The UTC offset.
   */
  getUTCOffset(): string {
    return this.utcOffset.format();
  }

  /**
   * Creates a timestamp from a monotonic time.
   *
   * @param valueNs The monotonic time in nanoseconds.
   * @return The timestamp.
   */
  makeTimestampFromMonotonicNs(valueNs: bigint): Timestamp {
    if (this.realToMonotonicTimeOffsetNs !== undefined) {
      return this.makeRealTimestamp(valueNs + this.realToMonotonicTimeOffsetNs);
    }
    return this.makeElapsedTimestamp(valueNs);
  }

  /**
   * Creates a timestamp from a boottime.
   *
   * @param valueNs The boottime in nanoseconds.
   * @return The timestamp.
   */
  makeTimestampFromBootTimeNs(valueNs: bigint): Timestamp {
    if (this.realToBootTimeOffsetNs !== undefined) {
      return this.makeRealTimestamp(valueNs + this.realToBootTimeOffsetNs);
    }
    return this.makeElapsedTimestamp(valueNs);
  }

  /**
   * Creates a timestamp from a real time.
   *
   * @param valueNs The real time in nanoseconds.
   * @return The timestamp.
   */
  makeTimestampFromRealNs(valueNs: bigint): Timestamp {
    return this.makeRealTimestamp(valueNs);
  }

  /**
   * Creates a timestamp from a human-readable string.
   *
   * @param timestampHuman The human-readable string.
   * @return The timestamp.
   */
  makeTimestampFromHuman(timestampHuman: string | UserTimestamp): Timestamp {
    let ts: UserTimestamp;
    if (timestampHuman instanceof UserTimestamp) {
      ts = timestampHuman;
    } else {
      ts = new UserTimestamp(timestampHuman);
    }
    if (ts.isHumanElapsedTimeFormat()) {
      return this.makeTimestampfromHumanElapsed(ts.timestampHuman);
    }

    if (ts.isISOFormat() || ts.isRealDateTimeFormat()) {
      return this.makeTimestampFromHumanReal(ts.timestampHuman);
    }

    throw new Error('Invalid timestamp format');
  }

  /**
   * Creates a timestamp from a value in nanoseconds.
   *
   * @param valueNs The value in nanoseconds.
   * @return The timestamp.
   */
  makeTimestampFromNs(valueNs: bigint): Timestamp {
    return new Timestamp(
      valueNs,
      this.canMakeRealTimestamps()
        ? this.realTimestampFormatter
        : ELAPSED_TIMESTAMP_FORMATTER,
    );
  }

  /**
   * Creates a zero timestamp.
   *
   * @return The zero timestamp.
   */
  makeZeroTimestamp(): Timestamp {
    if (this.canMakeRealTimestamps()) {
      return new Timestamp(INVALID_TIME_NS, REAL_TIMESTAMP_FORMATTER_UTC);
    } else {
      return new Timestamp(INVALID_TIME_NS, ELAPSED_TIMESTAMP_FORMATTER);
    }
  }

  /**
   * Tries to get the boottime from a timestamp.
   *
   * @param timestamp The timestamp.
   * @return The boottime in nanoseconds, or undefined if it cannot be determined.
   */
  tryGetBootTimeNs(timestamp: Timestamp): bigint | undefined {
    if (
      this.createdTimestampType !== TimestampType.REAL ||
      this.realToBootTimeOffsetNs === undefined
    ) {
      return undefined;
    }
    return timestamp.getValueNs() - this.realToBootTimeOffsetNs;
  }

  /**
   * Tries to get the real time from a timestamp.
   *
   * @param timestamp The timestamp.
   * @return The real time in nanoseconds, or undefined if it cannot be determined.
   */
  tryGetRealTimeNs(timestamp: Timestamp): bigint | undefined {
    if (this.createdTimestampType !== TimestampType.REAL) {
      return undefined;
    }
    return timestamp.getValueNs();
  }

  /**
   * Validates a human-readable timestamp string.
   *
   * @param timestampHuman The human-readable timestamp string.
   * @param context The context to use for validation.
   * @return True if the string is valid, false otherwise.
   */
  validateHumanInput(timestampHuman: string, context = this): boolean {
    const ts = new UserTimestamp(timestampHuman);
    if (context.canMakeRealTimestamps()) {
      return ts.isHumanRealTimestampFormat();
    }
    return ts.isHumanElapsedTimeFormat();
  }

  /**
   * Clears the converter's state.
   */
  clear() {
    this.createdTimestampType = undefined;
    this.realToBootTimeOffsetNs = undefined;
    this.realToMonotonicTimeOffsetNs = undefined;
    this.utcOffset = new UTCOffset();
  }

  canMakeRealTimestamps(): boolean {
    return this.createdTimestampType === TimestampType.REAL;
  }

  private makeRealTimestamp(valueNs: bigint): Timestamp {
    assertTrue(
      this.createdTimestampType === undefined ||
        this.createdTimestampType === TimestampType.REAL,
    );
    this.createdTimestampType = TimestampType.REAL;
    return new Timestamp(valueNs, this.realTimestampFormatter);
  }

  private makeElapsedTimestamp(valueNs: bigint): Timestamp {
    assertTrue(
      this.createdTimestampType === undefined ||
        this.createdTimestampType === TimestampType.ELAPSED,
    );
    this.createdTimestampType = TimestampType.ELAPSED;
    return new Timestamp(valueNs, ELAPSED_TIMESTAMP_FORMATTER);
  }

  private makeTimestampFromHumanReal(timestampHuman: string): Timestamp {
    // Remove trailing Z if present
    timestampHuman = timestampHuman.replace('Z', '');
    const ts = new UserTimestamp(timestampHuman);

    // Convert to ISO format if required
    if (ts.isRealDateTimeFormat()) {
      timestampHuman = timestampHuman.replace(', ', 'T');
    }

    // Date.parse only considers up to millisecond precision,
    // so only pass in YYYY-MM-DDThh:mm:ss
    let nanos = 0n;
    if (timestampHuman.includes('.')) {
      const [datetime, ns] = timestampHuman.split('.');
      nanos += BigInt(Math.floor(Number(ns.padEnd(9, '0'))));
      timestampHuman = datetime;
    }

    timestampHuman += this.utcOffset.format().slice(3);

    return this.makeTimestampFromRealNs(
      BigInt(Date.parse(timestampHuman)) * TIME_UNIT_TO_NANO.ms + nanos,
    );
  }

  private makeTimestampfromHumanElapsed(timestampHuman: string): Timestamp {
    const usedUnits = timestampHuman.split(/[0-9]+/).filter((it) => it !== '');
    const usedValues = timestampHuman
      .split(/[a-z]+/)
      .filter((it) => it !== '')
      .map((it) => Math.floor(Number(it)));

    let ns = 0n;

    for (let i = 0; i < usedUnits.length; i++) {
      const unit = usedUnits[i];
      const value = usedValues[i];
      const unitData = assertDefined(TIME_UNITS.find((it) => it.unit === unit));
      ns += unitData.nanosInUnit * BigInt(value);
    }

    return this.makeElapsedTimestamp(ns);
  }
}

/**
 * Timezone information for UTC.
 */
export const UTC_TIMEZONE_INFO = {
  timezone: 'UTC',
  locale: 'en-US',
};

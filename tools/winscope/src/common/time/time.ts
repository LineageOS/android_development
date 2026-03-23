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

import {UserTimestamp} from './user_timestamp';

/**
 * A type for a function that creates a timestamp.
 */
export type MakeTimestampStrategyType = (valueNs: bigint) => Timestamp;

/**
 * A constant representing an invalid time in nanoseconds.
 */
export const INVALID_TIME_NS = 0n;

/**
 * A class representing a time range.
 */
export class TimeRange {
  /**
   * @param from The start of the time range.
   * @param to The end of the time range.
   */
  constructor(
    readonly from: Timestamp,
    readonly to: Timestamp,
  ) {}

  /**
   * Gets the start of the time range in nanoseconds.
   */
  get startNs(): bigint {
    return this.from.getValueNs();
  }

  /**
   * Gets the end of the time range in nanoseconds.
   */
  get endNs(): bigint {
    return this.to.getValueNs();
  }

  /**
   * Checks if a timestamp is within the time range.
   *
   * @param ts The timestamp to check.
   * @return True if the timestamp is within the time range, false otherwise.
   */
  containsTimestamp(ts: Timestamp): boolean {
    const min = this.from.getValueNs();
    const max = this.to.getValueNs();
    return ts.getValueNs() >= min && ts.getValueNs() <= max;
  }
}

/**
 * An interface for timezone information.
 */
export declare interface TimezoneInfo {
  timezone: string;
  locale: string;
}

/**
 * An interface for a timestamp formatter.
 */
export declare interface TimestampFormatter {
  /**
   * Formats a timestamp.
   *
   * @param timestamp The timestamp to format.
   * @param type The format type.
   * @return The formatted timestamp.
   */
  format(timestampNs: bigint): string;
}

/**
 * A class representing a timestamp.
 */
export class Timestamp {
  private readonly utcValueNs: bigint;
  private readonly formatter: TimestampFormatter;

  /**
   * @param valueNs The value of the timestamp in nanoseconds.
   * @param formatter The formatter to use for formatting the timestamp.
   */
  constructor(valueNs: bigint, formatter: TimestampFormatter) {
    this.utcValueNs = valueNs;
    this.formatter = formatter;
  }

  /**
   * Gets the value of the timestamp in nanoseconds.
   *
   * @return The value of the timestamp in nanoseconds.
   */
  getValueNs(): bigint {
    return this.utcValueNs;
  }

  /**
   * Gets the value of the timestamp in nanoseconds.
   *
   * @return The value of the timestamp in nanoseconds.
   */
  valueOf(): bigint {
    return this.utcValueNs;
  }

  /**
   * Checks if the timestamp is within a time range.
   *
   * @param range The time range to check.
   * @return True if the timestamp is within the time range, false otherwise.
   */
  in(range: TimeRange): boolean {
    return (
      range.startNs <= this.getValueNs() && this.getValueNs() <= range.endNs
    );
  }

  /**
   * Adds a value to the timestamp.
   *
   * @param other The value to add.
   * @return A new timestamp with the added value.
   */
  add(other: bigint | Timestamp): Timestamp {
    let n: bigint;
    if (other instanceof Timestamp) {
      n = other.getValueNs();
    } else {
      n = other;
    }

    return new Timestamp(this.getValueNs() + n, this.formatter);
  }

  /**
   * Subtracts a value from the timestamp.
   *
   * @param other The value to subtract.
   * @return A new timestamp with the subtracted value.
   */
  minus(other: bigint | Timestamp): Timestamp {
    let n: bigint;
    if (other instanceof Timestamp) {
      n = other.getValueNs();
    } else {
      n = other;
    }
    return new Timestamp(this.getValueNs() - n, this.formatter);
  }

  /**
   * Multiplies the timestamp by a value.
   *
   * @param other The value to multiply by.
   * @return A new timestamp with the multiplied value.
   */
  times(other: bigint): Timestamp {
    return new Timestamp(this.getValueNs() * other, this.formatter);
  }

  /**
   * Divides the timestamp by a value.
   *
   * @param other The value to divide by.
   * @return A new timestamp with the divided value.
   */
  div(other: bigint): Timestamp {
    return new Timestamp(this.getValueNs() / other, this.formatter);
  }

  /**
   * Formats the timestamp.
   *
   * @param timeOnly Whether to only format the time part of the timestamp.
   * @return The formatted timestamp.
   */
  format(timeOnly = false): string {
    const value = this.formatter.format(this.getValueNs());
    if (timeOnly) {
      return new UserTimestamp(value).extractTime() ?? value;
    }
    return value;
  }

  /**
   * Returns the minimum of two timestamps.
   *
   * @param ts1 The first timestamp.
   * @param ts2 The second timestamp.
   * @return The minimum of the two timestamps.
   */
  static min(ts1: Timestamp, ts2: Timestamp): Timestamp {
    if (ts2.getValueNs() < ts1.getValueNs()) {
      return ts2;
    }

    return ts1;
  }

  /**
   * Returns the maximum of two timestamps.
   *
   * @param ts1 The first timestamp.
   * @param ts2 The second timestamp.
   * @return The maximum of the two timestamps.
   */
  static max(ts1: Timestamp, ts2: Timestamp): Timestamp {
    if (ts2.getValueNs() > ts1.getValueNs()) {
      return ts2;
    }

    return ts1;
  }
}

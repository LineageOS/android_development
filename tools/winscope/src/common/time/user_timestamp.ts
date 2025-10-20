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

/**
 * Utility functions for working with timestamps.
 */
// (?=.) checks there is at least one character with a lookahead match
const REAL_TIME_ONLY_REGEX =
  /^(0[0-9]|1[0-9]|2[0-3]):(0[0-9]|[1-5][0-9]):(0[0-9]|[1-5][0-9])(\.[0-9]{1,9})?Z?$/;
const REAL_DATE_TIME_REGEX =
  /^[0-9]{4}-((0[13578]|1[02])-(0[1-9]|[12][0-9]|3[01])|(0[469]|11)-(0[1-9]|[12][0-9]|30)|(02)-(0[1-9]|[12][0-9])),\s(0[0-9]|1[0-9]|2[0-3]):(0[0-9]|[1-5][0-9]):(0[0-9]|[1-5][0-9])(\.[0-9]{1,9})?Z?$/;
const ISO_TIMESTAMP_REGEX =
  /^[0-9]{4}-((0[13578]|1[02])-(0[1-9]|[12][0-9]|3[01])|(0[469]|11)-(0[1-9]|[12][0-9]|30)|(02)-(0[1-9]|[12][0-9]))T(0[0-9]|1[0-9]|2[0-3]):(0[0-9]|[1-5][0-9]):(0[0-9]|[1-5][0-9])(\.[0-9]{1,9})?Z?$/;
const ELAPSED_TIME_REGEX =
  /^(?=.)([0-9]+d)?([0-9]+h)?([0-9]+m)?([0-9]+s)?([0-9]+ms)?([0-9]+ns)?$/;
const NS_TIME_REGEX = /^\s*[0-9]+(\s?ns)?\s*$/;

/**
 * Represents a timestamp string provided by a user.
 *
 * Winscope accepts different timestamp formats such as real time and boot time,
 * with and without nanoseconds and with and without timezone information.
 */
export class UserTimestamp {
  /**
   * @param timestampHuman The human-readable timestamp string.
   */
  constructor(readonly timestampHuman: string) {}

  /**
   * Checks if a string is in nanosecond format.
   *
   * @return True if the string is in nanosecond format, false otherwise.
   */
  isNsFormat(): boolean {
    return NS_TIME_REGEX.test(this.timestampHuman);
  }

  /**
   * Checks if a string is in human-readable elapsed time format.
   *
   * @return True if the string is in elapsed time format, false otherwise.
   */
  isHumanElapsedTimeFormat(): boolean {
    return ELAPSED_TIME_REGEX.test(this.timestampHuman);
  }

  /**
   * Checks if a string is in real time format (HH:mm:ss.ns).
   *
   * @return True if the string is in real time format, false otherwise.
   */
  isRealTimeOnlyFormat(): boolean {
    return REAL_TIME_ONLY_REGEX.test(this.timestampHuman);
  }

  /**
   * Checks if a string is in real date and time format (YYYY-MM-DD, HH:mm:ss.ns).
   *
   * @return True if the string is in real date and time format, false otherwise.
   */
  isRealDateTimeFormat(): boolean {
    return REAL_DATE_TIME_REGEX.test(this.timestampHuman);
  }

  /**
   * Checks if a string is in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.nsZ).
   *
   * @return True if the string is in ISO 8601 format, false otherwise.
   */
  isISOFormat(): boolean {
    return ISO_TIMESTAMP_REGEX.test(this.timestampHuman);
  }

  /**
   * Checks if a string is in a human-readable real timestamp format.
   *
   * @return True if the string is in a human-readable real timestamp format, false otherwise.
   */
  isHumanRealTimestampFormat(): boolean {
    return (
      this.isISOFormat() ||
      this.isRealDateTimeFormat() ||
      this.isRealTimeOnlyFormat()
    );
  }

  /**
   * Extracts the date from a human-readable timestamp string.
   *
   * @return The date string, or undefined if the format is not supported.
   */
  extractDate(): string | undefined {
    if (!this.isRealDateTimeFormat() && !this.isISOFormat()) {
      return undefined;
    }
    return this.timestampHuman.slice(0, 10);
  }

  /**
   * Extracts the time from a human-readable timestamp string.
   *
   * @return The time string, or undefined if the format is not supported.
   */
  extractTime(): string | undefined {
    if (this.isRealDateTimeFormat()) {
      return this.timestampHuman.slice(12);
    }
    if (this.isISOFormat()) {
      return this.timestampHuman.slice(11);
    }
    if (this.isRealTimeOnlyFormat()) {
      return this.timestampHuman;
    }
    return undefined;
  }
}

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

import {divideAndRound} from 'common/bigint_math';
import {TimestampFormatter} from './time';
import {TIME_UNIT_TO_NANO, TIME_UNITS} from './time_units';
import {UTCOffset} from './utc_offset';

/**
 * Represents the type of a timestamp.
 * Pre-T traces do not provide real-to-boottime or real-to-monotonic offsets.
 * To handle this, we group their timestamps under the "ELAPSED" umbrella term.
 * This assumes that the CPU was not suspended before the tracing session,
 * which could cause timestamps to diverge.
 * - ELAPSED: Timestamps are relative to some arbitrary start time, often
 *            derived from a monotonic clock. Used when real-time offsets are
 *            unavailable.
 * - REAL: Timestamps are based on a real-world clock (e.g., UTC).
 */
export enum TimestampType {
  ELAPSED,
  REAL,
}

/**
 * Formats timestamps as real-world dates and times.
 * This class takes a `Timestamp` and converts it into a human-readable date and time string,
 * considering a provided UTC offset. It's useful for displaying timestamps that
 * represent specific moments in real time, such as when an event occurred.
 */
export class RealTimestampFormatter implements TimestampFormatter {
  constructor(private utcOffset: UTCOffset) {}

  setUTCOffset(value: UTCOffset) {
    this.utcOffset = value;
  }

  format(timestampNs: bigint): string {
    const timestampNanos = timestampNs + (this.utcOffset.getValueNs() ?? 0n);
    const ms = divideAndRound(timestampNanos, BigInt(TIME_UNIT_TO_NANO.ms));
    const formattedTimestamp = new Date(Number(ms))
      .toISOString()
      .replace('Z', '')
      .replace('T', ', ');
    return formattedTimestamp;
  }
}

/**
 * Formats timestamps representing elapsed time since an arbitrary point.
 * This formatter converts a `Timestamp` value (in nanoseconds) into a human-readable string
 * by breaking it down into units like days, hours, minutes, seconds, milliseconds, and nanoseconds.
 * It's useful for displaying durations or timestamps from sources that don't provide real-world time,
 * such as timestamps from traces that only provide monotonic time.
 */
export class ElapsedTimestampFormatter {
  format(timestampNs: bigint): string {
    let leftNanos = timestampNs;
    const parts: Array<{value: bigint; unit: string}> = TIME_UNITS.slice()
      .reverse()
      .map(({nanosInUnit, unit}) => {
        let amountOfUnit = BigInt(0);
        if (leftNanos >= nanosInUnit) {
          amountOfUnit = leftNanos / BigInt(nanosInUnit);
        }
        leftNanos = leftNanos % BigInt(nanosInUnit);
        return {value: amountOfUnit, unit};
      });

    // Remove all 0ed units at start
    while (parts.length > 1 && parts[0].value === 0n) {
      parts.shift();
    }

    return parts.map((part) => `${part.value}${part.unit}`).join('');
  }
}

/**
 * A singleton instance of `RealTimestampFormatter` configured to format timestamps in UTC.
 * This is useful for displaying timestamps as real-world dates and times without any
 * offset, representing the time in Coordinated Universal Time.
 */
export const REAL_TIMESTAMP_FORMATTER_UTC = new RealTimestampFormatter(
  new UTCOffset(),
);
/**
 * Formats timestamps representing elapsed time since an arbitrary point.
 * This formatter converts a `Timestamp` value (in nanoseconds) into a human-readable string
 * by breaking it down into units like days, hours, minutes, seconds, milliseconds, and nanoseconds.
 * It's useful for displaying durations or timestamps from sources that don't provide real-world time.
 */
export const ELAPSED_TIMESTAMP_FORMATTER = new ElapsedTimestampFormatter();

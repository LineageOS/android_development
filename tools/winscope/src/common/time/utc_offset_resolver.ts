/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {Timestamp, TimezoneInfo} from './time';
import {TIME_UNIT_TO_NANO} from './time_units';
import {UTCOffset} from './utc_offset';

/**
 * Resolves the UTC offset.
 *
 * This function first attempts to retrieve the timezone offset from Perfetto.
 * If successful, that value is used. Otherwise, the provided `fallbackTimestamp` is
 * used to calculate the UTC offset based on the system's `timezoneInfo`.
 *
 * @param timezoneInfo The timezone information to use for fallback.
 * @param fallbackTimestamp A fallback timestamp to use for initialization if the timezone cannot be obtained from Perfetto.
 * @param traceProcessor Optional TraceProcessor instance used to read from Perfetto.
 * @return A Promise that resolves with an initialized UTCOffset instance.
 */
export async function getResolvedUTCOffset(
  timezoneInfo: TimezoneInfo,
  fallbackTimestamp: Timestamp,
  perfettoTimezoneNs?: () => Promise<bigint | undefined>,
): Promise<UTCOffset> {
  let utcOffsetNs: bigint;

  const perfettoTimezoneNsValue =
    perfettoTimezoneNs !== undefined ? await perfettoTimezoneNs() : undefined;

  if (perfettoTimezoneNsValue !== undefined) {
    utcOffsetNs = perfettoTimezoneNsValue;
  } else {
    const utcValueNs = fallbackTimestamp.getValueNs();
    const localNs =
      timezoneInfo.timezone !== 'UTC'
        ? addTimezoneOffset(timezoneInfo.timezone, utcValueNs)
        : utcValueNs;
    utcOffsetNs = localNs - utcValueNs;
  }

  const utcOffset = new UTCOffset();
  utcOffset.initialize(utcOffsetNs);
  return utcOffset;
}

/**
 * Calculates a UTC nanosecond timestamp corresponding to the local time
 * in a specified timezone.
 *
 * Given an input timestamp in nanoseconds since the UTC epoch (`timestampNs`),
 * this function determines the equivalent local time in the provided `timezone`.
 * It then returns a new timestamp, also in nanoseconds since the UTC epoch,
 * which represents this calculated local time.
 *
 * Effectively, this function computes the offset between UTC and the target
 * `timezone` at the moment of `timestampNs` and applies that offset to the
 * original `timestampNs`, resulting in a new UTC timestamp.
 *
 * @param timezone The IANA timezone name (e.g., 'America/New_York', 'Europe/London').
 * @param timestampNs The input timestamp in nanoseconds since the UTC epoch.
 * @return A timestamp in nanoseconds since the UTC epoch, representing the local time
 *     in the given `timezone`.
 */
function addTimezoneOffset(timezone: string, timestampNs: bigint): bigint {
  const utcDate = new Date(Number(timestampNs / 1000000n));
  const timezoneDateFormatted = utcDate.toLocaleString('en-US', {
    timeZone: timezone,
  });
  const timezoneDate = new Date(timezoneDateFormatted);

  let daysDiff = timezoneDate.getDay() - utcDate.getDay(); // day of the week
  if (daysDiff > 1) {
    // Saturday in timezone, Sunday in UTC
    daysDiff = -1;
  } else if (daysDiff < -1) {
    // Sunday in timezone, Saturday in UTC
    daysDiff = 1;
  }

  const hoursDiff =
    timezoneDate.getHours() - utcDate.getHours() + daysDiff * 24;
  const minutesDiff = timezoneDate.getMinutes() - utcDate.getMinutes();
  const localTimezoneOffsetMinutes = utcDate.getTimezoneOffset();

  return (
    timestampNs +
    BigInt(hoursDiff) * TIME_UNIT_TO_NANO.h +
    BigInt(minutesDiff) * TIME_UNIT_TO_NANO.m -
    BigInt(localTimezoneOffsetMinutes) * TIME_UNIT_TO_NANO.m
  );
}

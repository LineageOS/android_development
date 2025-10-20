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

import {Timestamp, TimezoneInfo} from 'common/time/time';
import {
  TimestampConverter,
  UTC_TIMEZONE_INFO,
} from 'common/time/timestamp_converter';

/**
 * Timezone information for Asia/Kolkata.
 */
export const ASIA_TIMEZONE_INFO: TimezoneInfo = {
  timezone: 'Asia/Kolkata',
  locale: 'en-US',
};

/**
 * A TimestampConverter for UTC timezone.
 */
export const UTC_CONVERTER = new TimestampConverter(UTC_TIMEZONE_INFO, 0n, 0n);

const noRTEOffset = new TimestampConverter({
  timezone: 'UTC',
  locale: 'en-US',
});

/**
 * A TimestampConverter with a UTC offset for Asia/Kolkata timezone.
 */
export const TIMESTAMP_CONVERTER_WITH_UTC_OFFSET = new TimestampConverter(
  ASIA_TIMEZONE_INFO,
  0n,
  0n,
  new TimestampConverter({
    timezone: 'UTC',
    locale: 'en-US',
  }).makeTimestampFromRealNs(0n),
);

/**
 * Creates a real timestamp.
 *
 * @param valueNs The timestamp value in nanoseconds.
 * @return A real timestamp.
 */
export function makeRealTimestamp(valueNs: bigint): Timestamp {
  return UTC_CONVERTER.makeTimestampFromRealNs(valueNs);
}

/**
 * Creates a real timestamp with a UTC offset.
 *
 * @param valueNs The timestamp value in nanoseconds.
 * @return A real timestamp with a UTC offset.
 */
export function makeRealTimestampWithUTCOffset(valueNs: bigint): Timestamp {
  return TIMESTAMP_CONVERTER_WITH_UTC_OFFSET.makeTimestampFromRealNs(valueNs);
}

/**
 * Creates an elapsed timestamp.
 *
 * @param valueNs The timestamp value in nanoseconds.
 * @return An elapsed timestamp.
 */
export function makeElapsedTimestamp(valueNs: bigint): Timestamp {
  return noRTEOffset.makeTimestampFromMonotonicNs(valueNs);
}

/**
 * Creates a zero timestamp.
 *
 * @return A zero timestamp.
 */
export function makeZeroTimestamp(): Timestamp {
  return noRTEOffset.makeZeroTimestamp();
}

/**
 * A Jasmine custom equality tester for Timestamps.
 *
 * @param first The first object to compare.
 * @param second The second object to compare.
 * @return True if the objects are equal, false otherwise.
 */
export function timestampEqualityTester(
  first: unknown,
  second: unknown,
): boolean | undefined {
  if (first instanceof Timestamp && second instanceof Timestamp) {
    const firstTime = first as Timestamp;
    const secondTime = second as Timestamp;
    return (
      firstTime.format() === secondTime.format() &&
      firstTime.getValueNs() === secondTime.getValueNs()
    );
  }
  return undefined;
}

/**
 * Gets a TimestampConverter for tests.
 *
 * @param withUTCOffset Whether to create a converter with a UTC offset.
 * @return A TimestampConverter.
 */
export function getTimestampConverter(
  withUTCOffset = false,
): TimestampConverter {
  return withUTCOffset
    ? new TimestampConverter(ASIA_TIMEZONE_INFO)
    : new TimestampConverter(UTC_TIMEZONE_INFO);
}

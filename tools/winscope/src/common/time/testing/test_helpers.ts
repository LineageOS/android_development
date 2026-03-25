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

import {Timestamp, TimezoneInfo} from '@common/time/time';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {getResolvedUTCOffset} from '@common/time/utc_offset_resolver';

/**
 * Timezone information for Asia/Kolkata.
 */
export const ASIA_TIMEZONE_INFO: TimezoneInfo = {
  timezone: 'Asia/Kolkata',
  locale: 'en-US',
};

/**
 * A TimestampConverter with zero-set real-to-elapsed offsets. This converter
 * can make real timestamps.
 */
export function makeConverterZeroRteOffsets() {
  return new TimestampConverter(0n, 0n);
}

/**
 * A TimestampConverter with no real-to-elapsed offsets. This converter cannot
 * make real timestamps until a real-to-elapsed offset is set (either bootttime
 * or monotonic).
 */
export function makeConverterNoRteOffsets() {
  return new TimestampConverter();
}

/**
 * A TimestampConverter with a UTC offset for Asia/Kolkata timezone and zero-set
 * real-to-elapsed offsets, so the converter can make real timestamps that are
 * formatted to a non-UTC timezone.
 */
export async function makeConverterWithUtcOffset(): Promise<TimestampConverter> {
  const converter = new TimestampConverter();
  const utcOffset = await getResolvedUTCOffset(
    ASIA_TIMEZONE_INFO,
    makeRealTimestamp(0n),
  );
  converter.setUTCOffset(utcOffset);
  return converter;
}

const converterZeroOffsets = makeConverterZeroRteOffsets();
const converterNoOffsets = makeConverterNoRteOffsets();

/**
 * Creates a real timestamp.
 *
 * @param valueNs The timestamp value in nanoseconds.
 * @return A real timestamp.
 */
export function makeRealTimestamp(valueNs: bigint): Timestamp {
  return converterZeroOffsets.makeTimestampFromRealNs(valueNs);
}

/**
 * Creates an elapsed timestamp.
 *
 * @param valueNs The timestamp value in nanoseconds.
 * @return An elapsed timestamp.
 */
export function makeElapsedTimestamp(valueNs: bigint): Timestamp {
  return converterNoOffsets.makeTimestampFromMonotonicNs(valueNs);
}

/**
 * Creates a zero timestamp.
 *
 * @return A zero timestamp.
 */
export function makeZeroTimestamp(): Timestamp {
  return converterNoOffsets.makeZeroTimestamp();
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
    return (
      first.format() === second.format() &&
      first.getValueNs() === second.getValueNs()
    );
  }
  return undefined;
}

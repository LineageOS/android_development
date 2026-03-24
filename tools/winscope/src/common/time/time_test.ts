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

import {makeConverterWithUtcOffset, makeElapsedTimestamp, makeRealTimestamp,} from './testing/test_helpers';
import {TimeRange} from './time';
import {TIME_UNIT_TO_NANO} from './time_units';

describe('Timestamp', () => {
  describe('arithmetic', () => {
    const REAL_TIMESTAMP_10 = makeRealTimestamp(10n);
    const REAL_TIMESTAMP_20 = makeRealTimestamp(20n);
    const ELAPSED_TIMESTAMP_10 = makeElapsedTimestamp(10n);
    const ELAPSED_TIMESTAMP_20 = makeElapsedTimestamp(20n);

    it('can add', () => {
      let timestamp = REAL_TIMESTAMP_10.add(REAL_TIMESTAMP_20.getValueNs());
      expect(timestamp.getValueNs()).toBe(30n);

      timestamp = ELAPSED_TIMESTAMP_10.add(ELAPSED_TIMESTAMP_20.getValueNs());
      expect(timestamp.getValueNs()).toBe(30n);
    });

    it('can subtract', () => {
      let timestamp = REAL_TIMESTAMP_20.minus(REAL_TIMESTAMP_10.getValueNs());
      expect(timestamp.getValueNs()).toBe(10n);

      timestamp = ELAPSED_TIMESTAMP_20.minus(ELAPSED_TIMESTAMP_10.getValueNs());
      expect(timestamp.getValueNs()).toBe(10n);
    });

    it('can divide', () => {
      let timestamp = makeRealTimestamp(10n).div(2n);
      expect(timestamp.getValueNs()).toBe(5n);

      timestamp = ELAPSED_TIMESTAMP_10.div(2n);
      expect(timestamp.getValueNs()).toBe(5n);
    });
  });

  describe('formatting', () => {
    const MILLISECOND = TIME_UNIT_TO_NANO.ms;
    const SECOND = TIME_UNIT_TO_NANO.s;
    const MINUTE = TIME_UNIT_TO_NANO.m;
    const HOUR = TIME_UNIT_TO_NANO.h;
    const DAY = TIME_UNIT_TO_NANO.d;

    it('elapsed timestamps', () => {
      expect(makeElapsedTimestamp(0n).format()).toEqual('0ns');
      expect(makeElapsedTimestamp(1000n).format()).toBe('1000ns');
      expect(makeElapsedTimestamp(10n * MILLISECOND).format()).toBe('10ms0ns');

      expect(makeElapsedTimestamp(SECOND - 1n).format()).toBe('999ms999999ns');
      expect(makeElapsedTimestamp(SECOND).format()).toBe('1s0ms0ns');
      expect(makeElapsedTimestamp(SECOND + MILLISECOND).format()).toBe(
        '1s1ms0ns',
      );

      expect(makeElapsedTimestamp(MINUTE - 1n).format()).toBe(
        '59s999ms999999ns',
      );
      expect(makeElapsedTimestamp(MINUTE).format()).toBe('1m0s0ms0ns');
      expect(makeElapsedTimestamp(MINUTE + SECOND + MILLISECOND).format()).toBe(
        '1m1s1ms0ns',
      );
      expect(
        makeElapsedTimestamp(MINUTE + SECOND + MILLISECOND + 1n).format(),
      ).toBe('1m1s1ms1ns');

      expect(makeElapsedTimestamp(HOUR - 1n).format()).toBe(
        '59m59s999ms999999ns',
      );
      expect(makeElapsedTimestamp(HOUR).format()).toBe('1h0m0s0ms0ns');
      expect(
        makeElapsedTimestamp(HOUR + MINUTE + SECOND + MILLISECOND).format(),
      ).toBe('1h1m1s1ms0ns');

      expect(makeElapsedTimestamp(DAY - 1n).format()).toBe(
        '23h59m59s999ms999999ns',
      );
      expect(makeElapsedTimestamp(DAY).format()).toBe('1d0h0m0s0ms0ns');
      expect(
        makeElapsedTimestamp(
          DAY + HOUR + MINUTE + SECOND + MILLISECOND,
        ).format(),
      ).toBe('1d1h1m1s1ms0ns');
    });

    it('real timestamps without timezone info', () => {
      const NOV_10_2022 = 1668038400000n * MILLISECOND;
      expect(makeRealTimestamp(0n).format()).toEqual(
        '1970-01-01, 00:00:00.000',
      );
      expect(
        makeRealTimestamp(
          NOV_10_2022 +
            22n * HOUR +
            4n * MINUTE +
            54n * SECOND +
            186n * MILLISECOND +
            123212n,
        ).format(),
      ).toBe('2022-11-10, 22:04:54.186');
      expect(makeRealTimestamp(NOV_10_2022).format()).toBe(
        '2022-11-10, 00:00:00.000',
      );
      expect(makeRealTimestamp(NOV_10_2022 + 1n).format()).toBe(
        '2022-11-10, 00:00:00.000',
      );

      expect(makeRealTimestamp(0n).format()).toEqual(
        '1970-01-01, 00:00:00.000',
      );
      expect(
        makeRealTimestamp(
          NOV_10_2022 +
            22n * HOUR +
            4n * MINUTE +
            54n * SECOND +
            186n * MILLISECOND +
            123212n,
        ).format(),
      ).toBe('2022-11-10, 22:04:54.186');
      expect(makeRealTimestamp(NOV_10_2022).format()).toBe(
        '2022-11-10, 00:00:00.000',
      );
      expect(makeRealTimestamp(NOV_10_2022 + 1n).format()).toBe(
        '2022-11-10, 00:00:00.000',
      );
    });

    it('real timestamps with timezone info', async () => {
      const converter = await makeConverterWithUtcOffset();
      const NOV_10_2022 = 1668038400000n * MILLISECOND;
      expect(converter.makeTimestampFromRealNs(0n).format()).toBe(
        '1970-01-01, 05:30:00.000',
      );
      expect(
        converter
          .makeTimestampFromRealNs(
            NOV_10_2022 +
              22n * HOUR +
              4n * MINUTE +
              54n * SECOND +
              186n * MILLISECOND +
              123212n,
          )
          .format(),
      ).toBe('2022-11-11, 03:34:54.186');
      expect(converter.makeTimestampFromRealNs(NOV_10_2022).format()).toBe(
        '2022-11-10, 05:30:00.000',
      );
      expect(converter.makeTimestampFromRealNs(NOV_10_2022 + 1n).format()).toBe(
        '2022-11-10, 05:30:00.000',
      );

      expect(converter.makeTimestampFromRealNs(0n).format()).toBe(
        '1970-01-01, 05:30:00.000',
      );
      expect(
        converter
          .makeTimestampFromRealNs(
            NOV_10_2022 +
              22n * HOUR +
              4n * MINUTE +
              54n * SECOND +
              186n * MILLISECOND +
              123212n,
          )
          .format(),
      ).toBe('2022-11-11, 03:34:54.186');
      expect(converter.makeTimestampFromRealNs(NOV_10_2022).format()).toBe(
        '2022-11-10, 05:30:00.000',
      );
      expect(converter.makeTimestampFromRealNs(NOV_10_2022 + 1n).format()).toBe(
        '2022-11-10, 05:30:00.000',
      );
    });
  });
});

describe('TimeRange', () => {
  describe('containsTimestamp', () => {
    const range = new TimeRange(
      makeRealTimestamp(10n),
      makeRealTimestamp(600n),
    );

    it('returns true for range containing timestamp', () => {
      expect(range.containsTimestamp(makeRealTimestamp(10n))).toBeTrue();

      expect(range.containsTimestamp(makeRealTimestamp(600n))).toBeTrue();

      expect(range.containsTimestamp(makeRealTimestamp(300n))).toBeTrue();
    });

    it('returns false for range not containing timestamp', () => {
      expect(range.containsTimestamp(makeRealTimestamp(0n))).toBeFalse();

      expect(range.containsTimestamp(makeRealTimestamp(601n))).toBeFalse();
    });
  });
});

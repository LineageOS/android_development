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

describe('user_timestamp', () => {
  describe('isNsFormat', () => {
    it('accepts all expected inputs', () => {
      expect(new UserTimestamp('123').isNsFormat()).toBeTrue();
      expect(new UserTimestamp('123ns').isNsFormat()).toBeTrue();
      expect(new UserTimestamp('123 ns').isNsFormat()).toBeTrue();
      expect(new UserTimestamp(' 123 ns ').isNsFormat()).toBeTrue();
      expect(new UserTimestamp('   123  ').isNsFormat()).toBeTrue();
    });

    it('rejects all expected inputs', () => {
      expect(new UserTimestamp('1a23').isNsFormat()).toBeFalse();
      expect(new UserTimestamp('a123 ns').isNsFormat()).toBeFalse();
      expect(new UserTimestamp('').isNsFormat()).toBeFalse();
    });
  });

  describe('isHumanElapsedTimeFormat', () => {
    it('accepts all expected inputs', () => {
      expect(new UserTimestamp('1000ns').isHumanElapsedTimeFormat()).toBeTrue();
      expect(new UserTimestamp('1ms').isHumanElapsedTimeFormat()).toBeTrue();
      expect(new UserTimestamp('1s').isHumanElapsedTimeFormat()).toBeTrue();
      expect(new UserTimestamp('1s0ms').isHumanElapsedTimeFormat()).toBeTrue();
      expect(
        new UserTimestamp('1s0ms0ns').isHumanElapsedTimeFormat(),
      ).toBeTrue();
      expect(
        new UserTimestamp('0d1s1ms').isHumanElapsedTimeFormat(),
      ).toBeTrue();
      expect(new UserTimestamp('1h0m').isHumanElapsedTimeFormat()).toBeTrue();
      expect(
        new UserTimestamp('1h1m1s1ms').isHumanElapsedTimeFormat(),
      ).toBeTrue();
      expect(
        new UserTimestamp('1d0s1ms').isHumanElapsedTimeFormat(),
      ).toBeTrue();
      expect(
        new UserTimestamp('1d1h0m1s1ms').isHumanElapsedTimeFormat(),
      ).toBeTrue();
      expect(new UserTimestamp('1d').isHumanElapsedTimeFormat()).toBeTrue();
    });

    it('rejects all expected inputs', () => {
      expect(new UserTimestamp('1n').isHumanElapsedTimeFormat()).toBeFalse();
      expect(new UserTimestamp('1hr').isHumanElapsedTimeFormat()).toBeFalse();
      expect(new UserTimestamp('1min').isHumanElapsedTimeFormat()).toBeFalse();
      expect(new UserTimestamp('1sec').isHumanElapsedTimeFormat()).toBeFalse();
      expect(new UserTimestamp('1').isHumanElapsedTimeFormat()).toBeFalse();
      expect(new UserTimestamp('1m0').isHumanElapsedTimeFormat()).toBeFalse();
    });
  });

  describe('isRealTimeOnlyFormat', () => {
    it('accepts all expected inputs', () => {
      expect(
        new UserTimestamp('22:04:54.186').isRealTimeOnlyFormat(),
      ).toBeTrue();
      expect(
        new UserTimestamp('22:04:54.186777').isRealTimeOnlyFormat(),
      ).toBeTrue();
      expect(
        new UserTimestamp('22:04:54.186234769').isRealTimeOnlyFormat(),
      ).toBeTrue();
    });

    it('rejects all expected inputs', () => {
      expect(
        new UserTimestamp(
          '2022-11-10, 22:04:54.186123456',
        ).isRealTimeOnlyFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp(
          '2022-11-10T22:04:54.186123456',
        ).isRealTimeOnlyFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('2:04:54.186123456').isRealTimeOnlyFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('25:04:54.186123456').isRealTimeOnlyFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('22:4:54.186123456').isRealTimeOnlyFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('22:04:4.186123456').isRealTimeOnlyFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('22:60:54.186123456').isRealTimeOnlyFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('22:04:60.186123456').isRealTimeOnlyFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('22:04:54.1861234562').isRealTimeOnlyFormat(),
      ).toBeFalse();
      expect(new UserTimestamp('22:04:54.').isRealTimeOnlyFormat()).toBeFalse();
    });
  });

  describe('isRealDateTimeFormat', () => {
    it('accepts all expected inputs', () => {
      expect(
        new UserTimestamp('2022-11-10, 22:04:54.186').isRealDateTimeFormat(),
      ).toBeTrue();
      expect(
        new UserTimestamp('2022-11-10, 22:04:54.186777').isRealDateTimeFormat(),
      ).toBeTrue();
      expect(
        new UserTimestamp(
          '2022-11-10, 22:04:54.186234769',
        ).isRealDateTimeFormat(),
      ).toBeTrue();
    });

    it('rejects all expected inputs', () => {
      expect(
        new UserTimestamp(
          '2022-11-10T22:04:54.186234769',
        ).isRealDateTimeFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp(
          '2022-13-10, 22:04:54.186123456',
        ).isRealDateTimeFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp(
          '2022-11-32, 22:04:54.186123456',
        ).isRealDateTimeFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp(
          '2022-11-10, 25:04:54.186123456',
        ).isRealDateTimeFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp(
          '2022-11-10, 22:60:54.186123456',
        ).isRealDateTimeFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp(
          '2022-11-10, 22:04:60.186123456',
        ).isRealDateTimeFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp(
          '2022-11-10, 22:04:54.1861234568',
        ).isRealDateTimeFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('2022-11-10, 22:04:54.').isRealDateTimeFormat(),
      ).toBeFalse();
    });
  });

  describe('isISOFormat', () => {
    it('accepts all expected inputs', () => {
      expect(
        new UserTimestamp('2022-11-10T22:04:54.186').isISOFormat(),
      ).toBeTrue();
      expect(
        new UserTimestamp('2022-11-10T22:04:54.186777').isISOFormat(),
      ).toBeTrue();
      expect(
        new UserTimestamp('2022-11-10T22:04:54.186234769').isISOFormat(),
      ).toBeTrue();
    });

    it('rejects all expected inputs', () => {
      expect(
        new UserTimestamp('2022-11-10, 22:04:54.186234769').isISOFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('2022-13-10T22:04:54.186123456').isISOFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('2022-11-32T22:04:54.186123456').isISOFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('2022-11-10T25:04:54.186123456').isISOFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('2022-11-10T22:60:54.186123456').isISOFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('2022-11-10T22:04:60.186123456').isISOFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('2022-11-10T22:04:54.1861234568').isISOFormat(),
      ).toBeFalse();
      expect(
        new UserTimestamp('2022-11-10T22:04:54.').isISOFormat(),
      ).toBeFalse();
    });
  });
});

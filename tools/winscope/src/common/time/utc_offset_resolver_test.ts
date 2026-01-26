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

import {
  timestampEqualityTester,
  ASIA_TIMEZONE_INFO,
} from '@common/time/test_helpers';
import {TIME_UNIT_TO_NANO} from './time_units';
import {UTC_TIMEZONE_INFO, TimestampConverter} from './timestamp_converter';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {getResolvedUTCOffset} from './utc_offset_resolver';

describe('TimestampConverter', () => {
  const MILLISECOND = BigInt(TIME_UNIT_TO_NANO.ms);
  const SECOND = BigInt(TIME_UNIT_TO_NANO.s);
  const MINUTE = BigInt(TIME_UNIT_TO_NANO.m);
  const HOUR = BigInt(TIME_UNIT_TO_NANO.h);
  const DAY = BigInt(TIME_UNIT_TO_NANO.d);

  const testElapsedNs = 100n;
  const testRealNs = 1659243341051481088n; // Sun, 31 Jul 2022 04:55:41 GMT to test timestamp conversion between different days
  const testMonotonicTimeOffsetNs = 5n * MILLISECOND;
  const testRealToBootTimeOffsetNs = MILLISECOND;

  beforeAll(() => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
  });

  describe('initialize timezone offset from Perfetto', () => {
    const expectedQuery = `
    SELECT
      int_value
    FROM
      metadata
    WHERE
      name = 'timezone_off_mins'
    `;

    let mockTraceProcessor: jasmine.SpyObj<TraceProcessor>;
    let converter: TimestampConverter;
    beforeEach(() => {
      mockTraceProcessor = jasmine.createSpyObj<TraceProcessor>(['query']);

      converter = new TimestampConverter(UTC_TIMEZONE_INFO);
    });

    it('check query is correctly sent and received to and from Perfetto', async () => {
      const mockResult = {
        numRows: () => 1,
        columns: () => ['int_value'],
        iter: () => ({
          valid: () => false,
          next: () => {},
          get: () => null,
        }),
        firstRow: () => ({int_value: -60}),
      };
      mockTraceProcessor.query.and.returnValue(
        Promise.resolve(mockResult as any),
      );

      const utcOffset = await getResolvedUTCOffset(
        converter.getTimezoneInfo(),
        converter.makeTimestampFromRealNs(testRealNs),
        mockTraceProcessor,
      );

      expect(mockTraceProcessor.query).toHaveBeenCalledWith(expectedQuery);
      expect(mockTraceProcessor.query).toHaveBeenCalledTimes(1);
    });

    it('check utc-1 offset is correctly read and set from Perfetto', async () => {
      const mockResult = {
        numRows: () => 1,
        columns: () => ['int_value'],
        iter: () => ({
          valid: () => false,
          next: () => {},
          get: () => null,
        }),
        firstRow: () => ({int_value: -60}),
      };
      mockTraceProcessor.query.and.returnValue(
        Promise.resolve(mockResult as any),
      );

      const utcOffset = await getResolvedUTCOffset(
        converter.getTimezoneInfo(),
        converter.makeTimestampFromRealNs(testRealNs),
        mockTraceProcessor,
      );
      converter.setUTCOffset(utcOffset);

      expect(converter.getUTCOffset()).toBe('UTC-01:00');
    });

    it('check utc+7 offset is correctly read and set from Perfetto', async () => {
      const mockResult = {
        numRows: () => 1,
        columns: () => ['int_value'],
        iter: () => ({
          valid: () => false,
          next: () => {},
          get: () => null,
        }),
        firstRow: () => ({int_value: 420}),
      };
      mockTraceProcessor.query.and.returnValue(
        Promise.resolve(mockResult as any),
      );

      const utcOffset = await getResolvedUTCOffset(
        converter.getTimezoneInfo(),
        converter.makeTimestampFromRealNs(testRealNs),
        mockTraceProcessor,
      );
      converter.setUTCOffset(utcOffset);

      expect(converter.getUTCOffset()).toBe('UTC+07:00');
    });

    it('check if utc+15 offset is read from Perfetto, error is raised', async () => {
      const mockResult = {
        numRows: () => 1,
        columns: () => ['int_value'],
        iter: () => ({
          valid: () => false,
          next: () => {},
          get: () => null,
        }),
        firstRow: () => ({int_value: 900}),
      };
      mockTraceProcessor.query.and.returnValue(
        Promise.resolve(mockResult as any),
      );

      await expectAsync(
        getResolvedUTCOffset(
          converter.getTimezoneInfo(),
          converter.makeTimestampFromRealNs(testRealNs),
          mockTraceProcessor,
        ),
      ).toBeRejectedWithError(
        'Failed to set timezone offset greater than UTC+14:00',
      );
    });

    it('check if utc-13 offset is read from Perfetto, error is raised', async () => {
      const mockResult = {
        numRows: () => 1,
        columns: () => ['int_value'],
        iter: () => ({
          valid: () => false,
          next: () => {},
          get: () => null,
        }),
        firstRow: () => ({int_value: -780}),
      };
      mockTraceProcessor.query.and.returnValue(
        Promise.resolve(mockResult as any),
      );

      await expectAsync(
        getResolvedUTCOffset(
          converter.getTimezoneInfo(),
          converter.makeTimestampFromRealNs(testRealNs),
          mockTraceProcessor,
        ),
      ).toBeRejectedWithError(
        'Failed to set timezone offset greater than UTC-12:00',
      );
    });
  });
});

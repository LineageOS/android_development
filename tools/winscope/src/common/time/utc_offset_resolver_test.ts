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

import {
  ASIA_TIMEZONE_INFO,
  timestampEqualityTester,
} from '@common/time/test_helpers';
import {UTC_TIMEZONE_INFO} from './timestamp_converter';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {getResolvedUTCOffset} from './utc_offset_resolver';
import {makeSpyQueryResult} from '@trace_processor/test_utils';
import {Timestamp, TimestampFormatter} from './time';

class MockTimestampFormatter implements TimestampFormatter {
  format(timestamp: bigint): string {
    return `MockFormat(${timestamp})`;
  }
}

describe('utc_offset_resolver', () => {
  // Sun, 31 Jul 2022 04:55:41 GMT to test timestamp conversion between different days
  const testRealNs = 1659243341051481088n;
  const testFormatter = new MockTimestampFormatter();
  const testTimestamp = new Timestamp(testRealNs, testFormatter);

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
    beforeEach(() => {
      mockTraceProcessor = jasmine.createSpyObj<TraceProcessor>(['query']);
    });

    it('check query is correctly sent and received to and from Perfetto', async () => {
      setQueryResult(-60);

      await getResolvedUTCOffset(
        UTC_TIMEZONE_INFO,
        testTimestamp,
        mockTraceProcessor,
      );

      expect(mockTraceProcessor.query).toHaveBeenCalledWith(expectedQuery);
      expect(mockTraceProcessor.query).toHaveBeenCalledTimes(1);
    });

    it('check utc-1 offset is correctly read and set from Perfetto', async () => {
      setQueryResult(-60);

      const utcOffset = await getResolvedUTCOffset(
        UTC_TIMEZONE_INFO,
        testTimestamp,
        mockTraceProcessor,
      );

      expect(utcOffset.format()).toBe('UTC-01:00');
    });

    it('check utc+7 offset is correctly read and set from Perfetto', async () => {
      setQueryResult(420);

      const utcOffset = await getResolvedUTCOffset(
        UTC_TIMEZONE_INFO,
        testTimestamp,
        mockTraceProcessor,
      );

      expect(utcOffset.format()).toBe('UTC+07:00');
    });

    it('check if utc+15 offset is read from Perfetto, error is raised', async () => {
      setQueryResult(900);

      await expectAsync(
        getResolvedUTCOffset(
          UTC_TIMEZONE_INFO,
          testTimestamp,
          mockTraceProcessor,
        ),
      ).toBeRejectedWithError(
        'Failed to set timezone offset greater than UTC+14:00',
      );
    });

    it('check if utc-13 offset is read from Perfetto, error is raised', async () => {
      setQueryResult(-780);

      await expectAsync(
        getResolvedUTCOffset(
          UTC_TIMEZONE_INFO,
          testTimestamp,
          mockTraceProcessor,
        ),
      ).toBeRejectedWithError(
        'Failed to set timezone offset greater than UTC-12:00',
      );
    });

    function setQueryResult(intValue: number) {
      const spyQueryResult = makeSpyQueryResult();
      spyQueryResult.numRows.and.returnValue(1);
      spyQueryResult.firstRow.and.returnValue({int_value: intValue});
      mockTraceProcessor.query.and.returnValue(Promise.resolve(spyQueryResult));
    }
  });

  it('creates correct offset for different timezones', async () => {
    const utcOffsetLondon = await getResolvedUTCOffset(
      {
        timezone: 'Europe/London',
        locale: 'en-US',
      },
      testTimestamp,
    );

    expect(utcOffsetLondon.format()).toBe('UTC+01:00');

    const utcOffsetZurich = await getResolvedUTCOffset(
      {
        timezone: 'Europe/Zurich',
        locale: 'en-US',
      },
      testTimestamp,
    );
    expect(utcOffsetZurich.format()).toBe('UTC+02:00');

    const utcOffsetWestCoast = await getResolvedUTCOffset(
      {
        timezone: 'America/Los_Angeles',
        locale: 'en-US',
      },
      testTimestamp,
    );
    expect(utcOffsetWestCoast.format()).toBe('UTC-07:00');

    const utcOffsetIndia = await getResolvedUTCOffset(
      ASIA_TIMEZONE_INFO,
      testTimestamp,
    );
    expect(utcOffsetIndia.format()).toBe('UTC+05:30');
  });
});

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

import {timestampEqualityTester} from '@common/time/test_helpers';
import {UTC_TIMEZONE_INFO, TimestampConverter} from './timestamp_converter';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {getResolvedUTCOffset} from './utc_offset_resolver';
import {makeSpyQueryResult} from '@trace_processor/test_utils';

describe('TimestampConverter', () => {
  // Sun, 31 Jul 2022 04:55:41 GMT to test timestamp conversion between different days
  const testRealNs = 1659243341051481088n;

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
      setQueryResult(-60);

      await getResolvedUTCOffset(
        converter.getTimezoneInfo(),
        converter.makeTimestampFromRealNs(testRealNs),
        mockTraceProcessor,
      );

      expect(mockTraceProcessor.query).toHaveBeenCalledWith(expectedQuery);
      expect(mockTraceProcessor.query).toHaveBeenCalledTimes(1);
    });

    it('check utc-1 offset is correctly read and set from Perfetto', async () => {
      setQueryResult(-60);

      const utcOffset = await getResolvedUTCOffset(
        converter.getTimezoneInfo(),
        converter.makeTimestampFromRealNs(testRealNs),
        mockTraceProcessor,
      );
      converter.setUTCOffset(utcOffset);

      expect(converter.getUTCOffset()).toBe('UTC-01:00');
    });

    it('check utc+7 offset is correctly read and set from Perfetto', async () => {
      setQueryResult(420);

      const utcOffset = await getResolvedUTCOffset(
        converter.getTimezoneInfo(),
        converter.makeTimestampFromRealNs(testRealNs),
        mockTraceProcessor,
      );
      converter.setUTCOffset(utcOffset);

      expect(converter.getUTCOffset()).toBe('UTC+07:00');
    });

    it('check if utc+15 offset is read from Perfetto, error is raised', async () => {
      setQueryResult(900);

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
      setQueryResult(-780);

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

    function setQueryResult(intValue: number) {
      const spyQueryResult = makeSpyQueryResult();
      spyQueryResult.numRows.and.returnValue(1);
      spyQueryResult.firstRow.and.returnValue({int_value: intValue});
      mockTraceProcessor.query.and.returnValue(Promise.resolve(spyQueryResult));
    }
  });
});

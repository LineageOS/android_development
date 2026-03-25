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

import {assertDefined} from '@common/assert';
import {makeRealTimestamp, makeZeroTimestamp,} from '@common/time/testing/test_helpers';
import {Timestamp} from '@common/time/time';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {Trace} from '@trace_api/trace';
import {TracePositionUpdate} from '@trace_api/trace_events';
import {TraceType} from '@trace_api/trace_type';
import {QueryResult, RowIterator} from '@trace_processor/query_result';
import {makeSearchTraceSpies} from '@trace_processor/test_utils';
import {NotifyLogViewCallbackType} from '@ui/shared/log/abstract_log_viewer_presenter';
import {AbstractLogViewerPresenterTest} from '@ui/shared/log/abstract_log_viewer_presenter_test';
import {LogField, LogHeader} from '@ui/shared/log/ui_data_log';

import {SearchResultPresenter} from './search_result_presenter';
import {SearchResult} from './ui_data';

class SearchResultPresenterTest extends AbstractLogViewerPresenterTest<SearchResult> {
  override readonly expectedHeaders = [
    {
      header: new LogHeader({
        name: 'ts',
        cssClass: 'search-result',
      }),
    },
    {
      header: new LogHeader({
        name: 'ts_other',
        cssClass: 'search-result',
      }),
    },
    {
      header: new LogHeader({
        name: 'property',
        cssClass: 'search-result',
      }),
    },
    {
      header: new LogHeader({
        name: 'value',
        cssClass: 'search-result',
      }),
    },
    {
      header: new LogHeader({
        name: 'some_time_ns',
        cssClass: 'search-result',
      }),
    },
  ];
  private trace: Trace<QueryResult> | undefined;
  private positionUpdate: TracePositionUpdate | undefined;
  private spyIter: jasmine.SpyObj<RowIterator> | undefined;

  override async setUpTestEnvironment(): Promise<void> {
    const time100 = makeRealTimestamp(100n);
    const queryResult = this.setQuerySpiesAndGetQueryResult(time100);
    this.trace = new TraceBuilder<QueryResult>()
      .setEntries([queryResult])
      .setTimestamps([time100])
      .setType(TraceType.SEARCH)
      .build();
    this.positionUpdate = TracePositionUpdate.fromTraceEntry(
      this.trace.getEntry(0),
    );
  }

  override resetTestEnvironment() {
    assertDefined(this.spyIter).valid.and.returnValue(true);
  }

  override async createPresenterWithEmptyTrace(
    callback: NotifyLogViewCallbackType<SearchResult>,
  ): Promise<SearchResultPresenter> {
    const time100 = makeRealTimestamp(100n);
    const queryResult = this.setQuerySpiesAndGetQueryResult(time100);
    const trace = makeEmptyTrace<QueryResult>(TraceType.SEARCH);
    return new SearchResultPresenter(
      trace,
      callback,
      (valueNs: bigint) => makeRealTimestamp(valueNs),
      queryResult,
    );
  }

  override async createPresenter(
    callback: NotifyLogViewCallbackType<SearchResult>,
    trace = assertDefined(this.trace),
    positionUpdate?: TracePositionUpdate,
  ): Promise<SearchResultPresenter> {
    const presenter = new SearchResultPresenter(
      trace,
      callback,
      (valueNs: bigint) => makeRealTimestamp(valueNs),
      await trace.getEntry(0).getValue(),
    );
    if (positionUpdate) {
      await presenter.onAppEvent(positionUpdate); // trigger initialization
    }
    return presenter;
  }

  override getPositionUpdate(): TracePositionUpdate {
    return assertDefined(this.positionUpdate);
  }

  override executePropertiesChecksAfterPositionUpdate(result: SearchResult) {
    const firstEntry = assertDefined(this.trace).getEntry(0);
    expect(result.entries).toEqual([
      {
        traceEntry: firstEntry,
        fields: [
          new LogField(
            this.expectedHeaders[0].header.spec,
            firstEntry.getTimestamp(),
          ),
          new LogField(
            this.expectedHeaders[1].header.spec,
            makeRealTimestamp(200n), // converts column that starts with 'ts' to Timestamp
          ),
          new LogField(this.expectedHeaders[2].header.spec, 'test_property'),
          new LogField(this.expectedHeaders[3].header.spec, 123),
          new LogField(
            this.expectedHeaders[4].header.spec,
            makeRealTimestamp(321n), // converts column that ends with 'time_ns' to Timestamp
          ),
        ],
        getPropertiesTree: undefined,
      },
    ]);
  }

  override executeSpecializedTests() {
    describe('Specialized tests', () => {
      let result: SearchResult;

      it("does not convert 'ts' column value to timestamp if entry timestamp is not valid", async () => {
        const time0 = makeZeroTimestamp();
        const [spyQueryResult, _] = makeSearchTraceSpies(time0);
        const trace = new TraceBuilder<QueryResult>()
          .setEntries([spyQueryResult])
          .setTimestamps([time0])
          .setType(TraceType.SEARCH)
          .build();
        await this.createPresenter(
          (newResult) => {
            result = newResult;
          },
          trace,
          TracePositionUpdate.fromTraceEntry(trace.getEntry(0)),
        );
        expect(result.entries[0].fields[0].value).toBe(0);
      });

      describe('value conversions', () => {
        let presenter: SearchResultPresenter;

        beforeAll(async () => {
          await this.setUpTestEnvironment();
        });

        beforeEach(async () => {
          presenter = await this.createPresenter((newResult) => {
            result = newResult;
          }, undefined);
          this.resetTestEnvironment();
        });

        it("converts 'value' column string value to timestamp if 'property' value ends in 'time_ns'", async () => {
          this.spyIter?.get
            .withArgs('property')
            .and.returnValue('test_time_ns');
          this.spyIter?.get.withArgs('value').and.returnValue('123');
          await presenter.onAppEvent(assertDefined(this.getPositionUpdate()));
          expect(result.entries[0].fields[2].value).toBe('test_time_ns');
          expect(result.entries[0].fields[3].value).toEqual(
            makeRealTimestamp(123n),
          );
        });

        it("converts value to 'NULL' if null", async () => {
          this.spyIter?.get.withArgs('value').and.returnValue(null);
          await presenter.onAppEvent(assertDefined(this.getPositionUpdate()));
          expect(result.entries[0].fields[3].value).toBe('NULL');
        });

        it('converts value to number if bigint', async () => {
          this.spyIter?.get
            .withArgs('property')
            .and.returnValue('test_property');
          this.spyIter?.get.withArgs('value').and.returnValue(321n);
          await presenter.onAppEvent(assertDefined(this.getPositionUpdate()));
          expect(result.entries[0].fields[3].value).toBe(321);
        });

        it("converts value to '[]' if Uint8Array", async () => {
          this.spyIter?.get.withArgs('value').and.returnValue(new Uint8Array());
          await presenter.onAppEvent(assertDefined(this.getPositionUpdate()));
          expect(result.entries[0].fields[3].value).toBe('[]');
        });
      });
    });
  }

  private setQuerySpiesAndGetQueryResult(ts: Timestamp) {
    const [spyQueryResult, spyIter] = makeSearchTraceSpies(ts, {
      value: 123,
      some_time_ns: 321n,
    });
    this.spyIter = spyIter;
    return spyQueryResult;
  }
}

describe('SearchResultPresenterTest', () => {
  new SearchResultPresenterTest().execute();
});

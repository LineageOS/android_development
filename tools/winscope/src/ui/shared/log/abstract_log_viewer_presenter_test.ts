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
import {makeRealTimestamp} from '@common/time/testing/test_helpers';
import {Timer} from '@common/time/timer';
import {TracePositionUpdate} from '@trace_api/trace_events';
import {setNumRowsSpyQueryResult} from '@trace_processor/test_utils';
import {TraceProcessorProxy} from '@trace_processor/trace_processor';

import {AbstractLogViewerPresenter, NotifyLogViewCallbackType,} from './abstract_log_viewer_presenter';
import {LogSelectFilter, LogTextFilter} from './log_filters';
import {LogHeader, UiDataLog} from './ui_data_log';

export abstract class AbstractLogViewerPresenterTest<UiData extends UiDataLog> {
  execute() {
    describe('Common tests', () => {
      let uiData: UiData;
      let presenter: AbstractLogViewerPresenter<UiData, object>;

      beforeAll(async () => {
        await this.setUpTestEnvironment();
      });

      beforeEach(async () => {
        jasmine.addCustomEqualityTester(filterEqualityTester);
        presenter = await this.createPresenter((newData) => {
          uiData = newData;
        });
        await new Timer().wait(() => !uiData.isFetchingData);
        if (this.resetTestEnvironment) {
          this.resetTestEnvironment();
        }
      });

      it('is robust to empty trace', async () => {
        const presenter = await this.createPresenterWithEmptyTrace(
          (newData: UiData) => (uiData = newData),
        );
        spyOn(TraceProcessorProxy.prototype, 'query').and.returnValue(
          Promise.resolve(setNumRowsSpyQueryResult(0)),
        );
        await presenter.onAppEvent(
          TracePositionUpdate.fromTimestamp(makeRealTimestamp(0n)),
        );
        await new Timer().wait(() => !uiData.isFetchingData);
        for (const [index, expectedHeader] of this.expectedHeaders.entries()) {
          const header = uiData.headers[index];
          expect(header.spec).toEqual(expectedHeader.header.spec);
          if (expectedHeader.options) {
            expect((header.filter as LogSelectFilter)?.options).toEqual([]);
          }
        }
        if (this.executePropertiesChecksForEmptyTrace) {
          this.executePropertiesChecksForEmptyTrace(uiData);
        }
      });

      it('processes trace position updates', async () => {
        await assertDefined(presenter).onAppEvent(
          assertDefined(this.getPositionUpdate()),
        );
        await new Timer().wait(() => !uiData.isFetchingData);
        for (const [index, expectedHeader] of this.expectedHeaders.entries()) {
          const header = uiData.headers[index];
          expect(header).toEqual(expectedHeader.header);
          if (expectedHeader.options) {
            const options = (header.filter as LogSelectFilter).options;
            const expectedOptions = expectedHeader.options;
            expect(options.length).toEqual(
              expectedHeader.totalOptions ?? expectedOptions.length,
            );
            expect(options.slice(0, expectedOptions.length)).toEqual(
              expectedOptions,
            );
          }
        }
        if (this.executePropertiesChecksAfterPositionUpdate) {
          this.executePropertiesChecksAfterPositionUpdate(uiData);
        }
      });

      it('sorts filter options according to sorter', async () => {
        if (!this.getExpectedSortedOptions) {
          return;
        }

        await assertDefined(presenter).onAppEvent(
          assertDefined(this.getPositionUpdate()),
        );
        await new Timer().wait(() => !uiData.isFetchingData);

        const expected = this.getExpectedSortedOptions();
        const header = uiData.headers.find(
          (h) => h.spec.name === expected.column,
        );
        const filter = header?.filter as LogSelectFilter | undefined;
        expect(filter?.options).toEqual(expected.options);
      });
    });

    function filterEqualityTester(
      first: unknown,
      second: unknown,
    ): boolean | undefined {
      if (first instanceof LogTextFilter && second instanceof LogTextFilter) {
        return (
          first.textFilter.filterString === second.textFilter.filterString &&
          first.textFilter.flags.length === second.textFilter.flags.length &&
          first.textFilter.flags.every(
            (flag, index) => flag === second.textFilter.flags[index],
          )
        );
      }
      if (
        first instanceof LogSelectFilter &&
        second instanceof LogSelectFilter
      ) {
        return (
          first.options.length === second.options.length &&
          first.shouldFilterBySubstring === second.shouldFilterBySubstring
        );
      }
      return undefined;
    }

    if (this.executeSpecializedTests) {
      this.executeSpecializedTests();
    }
  }

  abstract readonly expectedHeaders: Array<{
    header: LogHeader;
    options?: string[];
    totalOptions?: number;
  }>;

  abstract setUpTestEnvironment(): Promise<void>;
  abstract createPresenter(
    callback: NotifyLogViewCallbackType<UiData>,
  ): Promise<AbstractLogViewerPresenter<UiData, object>>;
  abstract createPresenterWithEmptyTrace(
    callback: NotifyLogViewCallbackType<UiData>,
  ): Promise<AbstractLogViewerPresenter<UiData, object>>;
  abstract getPositionUpdate(): TracePositionUpdate;

  getExpectedSortedOptions?(): {column: string; options: string[]};

  resetTestEnvironment?(): void;
  executePropertiesChecksForEmptyTrace?(uiData: UiDataLog): void;
  executePropertiesChecksAfterPositionUpdate?(uiData: UiDataLog): void;
  executeSpecializedTests?(): void;
}

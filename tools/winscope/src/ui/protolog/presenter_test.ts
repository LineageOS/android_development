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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANYf KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertDefined} from '@common/assert';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {makeElapsedTimestamp, makeRealTimestamp,} from '@common/time/testing/test_helpers';
import {Timer} from '@common/time/timer';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {CustomQueryType} from '@trace_api/custom_query';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {Trace} from '@trace_api/trace';
import {TracePositionUpdate} from '@trace_api/trace_events';
import {TraceType} from '@trace_api/trace_type';
import {ProtologColumnType} from '@trace/protolog/protolog_column_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {NotifyLogViewCallbackType} from '@ui/shared/log/abstract_log_viewer_presenter';
import {AbstractLogViewerPresenterTest} from '@ui/shared/log/abstract_log_viewer_presenter_test';
import {LogSelectFilter, LogTextFilter} from '@ui/shared/log/log_filters';
import {LogHeader} from '@ui/shared/log/ui_data_log';
import {TextFilter} from '@ui/shared/user_input/text_filter';

import {Presenter} from './presenter';
import {UiData} from './ui_data';

class PresenterProtologTest extends AbstractLogViewerPresenterTest<UiData> {
  override executeSpecializedTests() {
    describe('Specialized tests', () => {
      let uiData: UiData;

      beforeEach(async () => {
        await this.setUpTestEnvironment();
        await this.createPresenter((newData) => {
          uiData = newData;
        });
        await new Timer().wait(() => !uiData.isFetchingData);
      });

      it('tooltip message correctly set', async () => {
        for (let i = 0; i < 4; i++) {
          const field = uiData.entries[i].fields[2];
          if (i === 1) {
            expect(field.tooltip).toBe(
              'Location information (file and line) is unavailable. This is because ProtoLog entries are only preprocessed to include source locations when logged from Java files with a configured protologtool genrule. Kotlin files are not currently supported for this preprocessing.',
            );
          } else {
            expect(field.tooltip).toBeUndefined();
          }
        }
      });

      it('LocationField used for source file log field', async () => {
        const filterValueMatches = uiData.entries.map((entry) => {
          return entry.fields[2].getFilterValueMatch();
        });
        const exp = ['sourcefile0', '<NO_LOC>', 'sourcefile2', 'sourcefile2'];
        expect(filterValueMatches).toEqual(exp);
      });
    });
  }

  override readonly expectedHeaders = [
    {
      header: new LogHeader(
        {
          name: 'Log Level',
          cssClass: 'log-level',
          columnType: ProtologColumnType.LEVEL,
          canFilterBySingleOption: true,
        },
        new LogSelectFilter(Array.from({length: 3}, () => '')),
      ),
      options: ['VERBOSE', 'DEBUG', 'INFO'],
    },
    {
      header: new LogHeader(
        {
          name: 'Tag',
          cssClass: 'tag',
          columnType: ProtologColumnType.TAG,
          canFilterBySingleOption: true,
        },
        new LogSelectFilter(Array.from({length: 3}, () => '')),
      ),
      options: ['tag0', 'tag1', 'tag2'],
    },
    {
      header: new LogHeader(
        {
          name: 'Source files',
          cssClass: 'source-file',
          canCopy: true,
          columnType: ProtologColumnType.LOCATION,
          canFilterBySingleOption: true,
        },
        new LogSelectFilter(
          Array.from({length: 3}, () => ''),
          true,
        ),
      ),
      options: ['sourcefile0', '<NO_LOC>', 'sourcefile2'],
    },
    {
      header: new LogHeader(
        {
          name: 'Search text',
          cssClass: 'text',
          columnType: ProtologColumnType.MESSAGE,
        },
        new LogTextFilter(new TextFilter()),
      ),
    },
  ];
  private trace: Trace<HierarchyTreeNode> | undefined;
  private positionUpdate: TracePositionUpdate | undefined;

  override async setUpTestEnvironment(): Promise<void> {
    const time10 = makeRealTimestamp(10n);
    const time11 = makeRealTimestamp(11n);
    const time12 = makeRealTimestamp(12n);
    const elapsedTime10 = makeElapsedTimestamp(10n);
    const elapsedTime20 = makeElapsedTimestamp(20n);
    const elapsedTime30 = makeElapsedTimestamp(30n);

    const entries = [
      new HierarchyTreeBuilder()
        .setId('ProtologTrace')
        .setName('message')
        .setProperties({
          message: 'text0',
          ts: elapsedTime10,
          tag: 'tag0',
          level: 'INFO',
          location: 'sourcefile0',
        })
        .setRootNodeFormatter(new SetFormatters())
        .build(),

      new HierarchyTreeBuilder()
        .setId('ProtologTrace')
        .setName('message')
        .setProperties({
          message: 'text1',
          ts: elapsedTime20,
          tag: 'tag1',
          level: 'DEBUG',
        })
        .setRootNodeFormatter(new SetFormatters())
        .build(),

      new HierarchyTreeBuilder()
        .setId('ProtologTrace')
        .setName('message')
        .setProperties({
          message: 'text2',
          ts: elapsedTime30,
          tag: 'tag2',
          level: 'VERBOSE',
          location: 'sourcefile2:321',
        })
        .setRootNodeFormatter(new SetFormatters())
        .build(),

      new HierarchyTreeBuilder()
        .setId('ProtologTrace')
        .setName('message')
        .setProperties({
          message: 'text2',
          ts: elapsedTime30,
          tag: 'tag2',
          level: 'VERBOSE',
          location: 'sourcefile2:123',
        })
        .setRootNodeFormatter(new SetFormatters())
        .build(),
    ];

    this.trace = new TraceBuilder<HierarchyTreeNode>()
      .setEntries(entries)
      .setTimestamps([time10, time11, time12, time12])
      .setParserCustomQueryResult(
        CustomQueryType.LOG_TABLE_FILTER_VALUES,
        ['INFO', 'DEBUG', 'VERBOSE'],
        ProtologColumnType.LEVEL,
      )
      .setParserCustomQueryResult(
        CustomQueryType.LOG_TABLE_FILTER_VALUES,
        ['tag0', 'tag1', 'tag2'],
        ProtologColumnType.TAG,
      )
      .setParserCustomQueryResult(
        CustomQueryType.LOG_TABLE_FILTER_VALUES,
        ['sourcefile0', '<NO_LOC>', 'sourcefile2'],
        ProtologColumnType.LOCATION,
      )
      .build();

    this.positionUpdate = TracePositionUpdate.fromTraceEntry(
      this.trace.getEntry(0),
    );
  }

  override async createPresenterWithEmptyTrace(
    callback: NotifyLogViewCallbackType<UiData>,
  ): Promise<Presenter> {
    const trace = makeEmptyTrace<HierarchyTreeNode>(
      TraceType.PROTO_LOG,
      undefined,
      [
        {
          queryType: CustomQueryType.LOG_TABLE_FILTER_VALUES,
          result: [],
        },
      ],
    );
    return new Presenter(trace, callback, new InMemoryStorage());
  }

  override async createPresenter(
    callback: NotifyLogViewCallbackType<UiData>,
  ): Promise<Presenter> {
    const presenter = new Presenter(
      assertDefined(this.trace),
      callback,
      new InMemoryStorage(),
    );
    await presenter.onAppEvent(this.getPositionUpdate()); // trigger initialization
    return presenter;
  }

  override getPositionUpdate(): TracePositionUpdate {
    return assertDefined(this.positionUpdate);
  }

  override getExpectedSortedOptions() {
    return {
      column: 'Log Level',
      options: ['VERBOSE', 'DEBUG', 'INFO'],
    };
  }
}

describe('PresenterProtolog', () => {
  new PresenterProtologTest().execute();
});

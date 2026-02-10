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
import {TracePositionUpdate} from '@trace/trace_events';
import {HierarchyTreeBuilder} from '@test/unit/tree_node/hierarchy_tree_builder';
import {
  makeRealTimestamp,
  makeElapsedTimestamp,
} from '@common/time/test_helpers';
import {TraceBuilder} from '@test/unit/trace_api/trace_builder';
import {makeEmptyTrace} from '@test/unit/trace_api/trace_test_helpers';
import {ProtologColumnType} from '@trace/protolog/protolog_column_type';
import {CustomQueryType} from '@trace_api/custom_query';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {NotifyLogViewCallbackType} from '@viewers/common/abstract_log_viewer_presenter';
import {AbstractLogViewerPresenterTest} from '@viewers/common/abstract_log_viewer_presenter_test';
import {LogSelectFilter, LogTextFilter} from '@viewers/common/log_filters';
import {TextFilter} from '@viewers/common/text_filter';
import {LogHeader} from '@viewers/common/ui_data_log';
import {Presenter} from './presenter';
import {UiData} from './ui_data';
import {Timer} from '@common/time/timer';

class PresenterProtologTest extends AbstractLogViewerPresenterTest<UiData> {
  override executeSpecializedTests() {
    describe('Specialized tests', () => {
      let uiData: UiData;

      it('tooltip message correctly set', async () => {
        await this.setUpTestEnvironment();
        await this.createPresenter((newData) => {
          uiData = newData;
        });

        await new Timer().wait(() => !uiData.isFetchingData);

        expect(uiData.entries[0].fields[2].tooltip).toBeUndefined();
        expect(uiData.entries[1].fields[2].tooltip).toBe(
          'Location information (file and line) is unavailable. This is because ProtoLog entries are only preprocessed to include source locations when logged from Java files with a configured protologtool genrule. Kotlin files are not currently supported for this preprocessing.',
        );
        expect(uiData.entries[2].fields[2].tooltip).toBeUndefined();
        expect(uiData.entries[3].fields[2].tooltip).toBeUndefined();
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
        },
        new LogSelectFilter(Array.from({length: 3}, () => '')),
      ),
      options: ['VERBOSE', 'DEBUG', 'INFO'],
    },
    {
      header: new LogHeader(
        {name: 'Tag', cssClass: 'tag', columnType: ProtologColumnType.TAG},
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

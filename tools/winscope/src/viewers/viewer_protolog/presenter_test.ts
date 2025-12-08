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

import {assertDefined} from 'common/assert';
import {InMemoryStorage} from 'common/store/in_memory_storage';
import {TracePositionUpdate} from 'messaging/winscope_event';
import {HierarchyTreeBuilder} from 'test/unit/hierarchy_tree_builder';
import {
  makeRealTimestamp,
  makeElapsedTimestamp,
} from 'test/unit/time_test_helpers';
import {TraceBuilder} from 'test/unit/trace_builder';
import {makeEmptyTrace} from 'test/unit/trace_utils';
import {ProtologColumnType} from 'trace/protolog/protolog_column_type';
import {CustomQueryType} from 'trace_api/custom_query';
import {Trace} from 'trace_api/trace';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {NotifyLogViewCallbackType} from 'viewers/common/abstract_log_viewer_presenter';
import {AbstractLogViewerPresenterTest} from 'viewers/common/abstract_log_viewer_presenter_test';
import {LogSelectFilter, LogTextFilter} from 'viewers/common/log_filters';
import {TextFilter} from 'viewers/common/text_filter';
import {LogHeader} from 'viewers/common/ui_data_log';
import {Presenter} from './presenter';
import {UiData} from './ui_data';

class PresenterProtologTest extends AbstractLogViewerPresenterTest<UiData> {
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
      options: ['level0', 'level1', 'level2'],
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
          level: 'level0',
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
          level: 'level1',
        })
        .build(),

      new HierarchyTreeBuilder()
        .setId('ProtologTrace')
        .setName('message')
        .setProperties({
          message: 'text2',
          ts: elapsedTime30,
          tag: 'tag2',
          level: 'level2',
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
          level: 'level2',
          location: 'sourcefile2:123',
        })
        .build(),
    ];

    this.trace = new TraceBuilder<HierarchyTreeNode>()
      .setEntries(entries)
      .setTimestamps([time10, time11, time12, time12])
      .setParserCustomQueryResult(
        CustomQueryType.LOG_TABLE_FILTER_VALUES,
        ['level0', 'level1', 'level2'],
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
    const trace = makeEmptyTrace(TraceType.PROTO_LOG, undefined, [
      {
        queryType: CustomQueryType.LOG_TABLE_FILTER_VALUES,
        result: [],
      },
    ]);
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
}

describe('PresenterProtolog', () => {
  new PresenterProtologTest().execute();
});

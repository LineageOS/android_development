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
 * WITHOUT WARRANTIES OR CONDITIONS OF ANYf KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertDefined} from '@common/assert';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {NonPerfettoParserProvider} from '@parsers/fixture_utils';
import {Parser} from '@trace_api/parser';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {Trace} from '@trace_api/trace';
import {TracePositionUpdate} from '@trace_api/trace_events';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {NotifyLogViewCallbackType} from '@ui/shared/log/abstract_log_viewer_presenter';
import {AbstractLogViewerPresenterTest} from '@ui/shared/log/abstract_log_viewer_presenter_test';
import {LogHeader} from '@ui/shared/log/ui_data_log';

import {Presenter} from './presenter';
import {UiData} from './ui_data';

class PresenterJankCujsTest extends AbstractLogViewerPresenterTest<UiData> {
  override readonly expectedHeaders = [
    {
      header: new LogHeader({
        name: 'Type',
        cssClass: 'jank-cuj-type',
      }),
    },
    {
      header: new LogHeader({
        name: 'Start Time',
        cssClass: 'start-time time',
      }),
    },
    {
      header: new LogHeader({
        name: 'End Time',
        cssClass: 'end-time time',
      }),
    },
    {
      header: new LogHeader({
        name: 'Duration',
        cssClass: 'duration right-align',
      }),
    },
    {
      header: new LogHeader({
        name: 'Status',
        cssClass: 'status right-align',
      }),
    },
  ];
  private trace: Trace<HierarchyTreeNode> | undefined;
  private positionUpdate: TracePositionUpdate | undefined;

  override async setUpTestEnvironment(): Promise<void> {
    const parser = (await new NonPerfettoParserProvider()
      .addFile('traces/elapsed_and_real_timestamp/eventlog.winscope')
      .get()) as Parser<HierarchyTreeNode>;

    this.trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.CUJS)
      .setParser(parser)
      .build();

    this.positionUpdate = TracePositionUpdate.fromTraceEntry(
      this.trace.getEntry(0),
    );
  }

  override async createPresenterWithEmptyTrace(
    callback: NotifyLogViewCallbackType<UiData>,
  ): Promise<Presenter> {
    const trace = makeEmptyTrace<HierarchyTreeNode>(TraceType.CUJS);
    return new Presenter(trace, new InMemoryStorage(), callback);
  }

  override async createPresenter(
    callback: NotifyLogViewCallbackType<UiData>,
  ): Promise<Presenter> {
    const trace = assertDefined(this.trace);
    const traces = new Traces();
    traces.addTrace(trace);

    const presenter = new Presenter(trace, new InMemoryStorage(), callback);
    await presenter.onAppEvent(this.getPositionUpdate()); // trigger initialization
    return presenter;
  }

  override getPositionUpdate(): TracePositionUpdate {
    return assertDefined(this.positionUpdate);
  }

  override executePropertiesChecksAfterPositionUpdate(uiData: UiData) {
    const cujTypeValues = uiData.entries.map((entry) => {
      return entry.fields[0].value;
    });
    expect(cujTypeValues).toEqual([
      'CUJ_LAUNCHER_QUICK_SWITCH (11)',
      'CUJ_LAUNCHER_APP_CLOSE_TO_HOME (9)',
      'CUJ_LAUNCHER_APP_SWIPE_TO_RECENTS (66)',
      'CUJ_LAUNCHER_OPEN_ALL_APPS (25)',
      'CUJ_LAUNCHER_CLOSE_ALL_APPS_SWIPE (67)',
      'CUJ_LAUNCHER_APP_LAUNCH_FROM_ICON (8)',
      'CUJ_SPLASHSCREEN_EXIT_ANIM (39)',
      'CUJ_LAUNCHER_QUICK_SWITCH (11)',
      'CUJ_LAUNCHER_APP_CLOSE_TO_HOME (9)',
      'CUJ_LAUNCHER_APP_SWIPE_TO_RECENTS (66)',
      'CUJ_NOTIFICATION_SHADE_EXPAND_COLLAPSE (0)',
      'CUJ_NOTIFICATION_SHADE_EXPAND_COLLAPSE (0)',
      'CUJ_NOTIFICATION_SHADE_QS_EXPAND_COLLAPSE (5)',
      'CUJ_NOTIFICATION_SHADE_QS_EXPAND_COLLAPSE (5)',
      'CUJ_NOTIFICATION_SHADE_EXPAND_COLLAPSE (0)',
      'CUJ_NOTIFICATION_SHADE_EXPAND_COLLAPSE (0)',
    ]);
  }
}

describe('PresenterJankCujsTest', () => {
  new PresenterJankCujsTest().execute();
});

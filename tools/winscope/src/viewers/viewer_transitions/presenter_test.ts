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

import {assertDefined} from 'common/assert';
import {InMemoryStorage} from 'common/store/in_memory_storage';
import {Timer} from 'common/time/timer';
import {TracePositionUpdate} from 'messaging/winscope_event';
import {getPerfettoParser} from 'test/unit/fixture_utils';
import {ParserBuilder} from 'test/unit/parser_builder';
import {makeRealTimestamp} from 'test/unit/time_test_helpers';
import {TraceBuilder} from 'test/unit/trace_builder';
import {TracesBuilder} from 'test/unit/traces_builder';
import {Trace} from 'trace_api/trace';
import {TraceType} from 'trace_api/trace_type';
import {Traces} from 'trace_api/traces';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {NotifyLogViewCallbackType} from 'viewers/common/abstract_log_viewer_presenter';
import {AbstractLogViewerPresenterTest} from 'viewers/common/abstract_log_viewer_presenter_test';
import {LogSelectFilter} from 'viewers/common/log_filters';
import {LogHeader, UiDataLog} from 'viewers/common/ui_data_log';
import {Presenter} from './presenter';
import {UiData} from './ui_data';

class PresenterTransitionsTest extends AbstractLogViewerPresenterTest<UiData> {
  override readonly expectedHeaders = [
    {
      header: new LogHeader({
        name: 'Id',
        cssClass: 'transition-id right-align',
      }),
    },
    {
      header: new LogHeader(
        {name: 'Type', cssClass: 'transition-type'},
        new LogSelectFilter(Array.from({length: 2}, () => '')),
      ),
      options: ['OPEN', 'TO_FRONT'],
    },
    {header: new LogHeader({name: 'Send Time', cssClass: 'send-time time'})},
    {
      header: new LogHeader({
        name: 'Dispatch Time',
        cssClass: 'dispatch-time time',
      }),
    },
    {
      header: new LogHeader({
        name: 'Duration',
        cssClass: 'duration right-align',
      }),
    },
    {
      header: new LogHeader(
        {name: 'Handler', cssClass: 'handler'},
        new LogSelectFilter(Array.from({length: 3}, () => '')),
      ),
      options: [
        'N/A',
        'com.android.wm.shell.recents.RecentsTransitionHandler',
        'com.android.wm.shell.transition.DefaultMixedHandler',
      ],
    },
    {
      header: new LogHeader(
        {name: 'Participants', cssClass: 'participants'},
        new LogSelectFilter(
          Array.from({length: 12}, () => ''),
          true,
          '250',
          '100%',
        ),
      ),
      options: [
        '47',
        '67',
        '398',
        '471',
        '472',
        '489',
        '0xc3df4d',
        '0x5ba3da0',
        '0x97b5518',
        '0xa884527',
        '0xb887160',
        '0xc5f6ee4',
      ],
    },
    {
      header: new LogHeader(
        {name: 'Flags', cssClass: 'flags'},
        new LogSelectFilter(
          Array.from({length: 2}, () => ''),
          true,
          '250',
          '100%',
        ),
      ),
      options: ['TRANSIT_FLAG_IS_RECENTS', '0x0'],
    },
    {
      header: new LogHeader(
        {name: 'Status', cssClass: 'status right-align'},
        new LogSelectFilter(Array.from({length: 3}, () => '')),
      ),
      options: ['MERGED', 'N/A', 'PLAYED'],
    },
  ];
  private trace: Trace<HierarchyTreeNode> | undefined;
  private positionUpdate: TracePositionUpdate | undefined;

  override async setUpTestEnvironment(): Promise<void> {
    const parser = await getPerfettoParser(
      TraceType.TRANSITION,
      'traces/perfetto/shell_transitions_trace.perfetto-trace',
    );

    this.trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.TRANSITION)
      .setParser(parser)
      .build();

    this.positionUpdate = TracePositionUpdate.fromTraceEntry(
      this.trace.getEntry(0),
    );
  }

  override async createPresenterWithEmptyTrace(
    callback: NotifyLogViewCallbackType<UiData>,
  ): Promise<Presenter> {
    const traces = new TracesBuilder()
      .setEntries(TraceType.TRANSITION, [])
      .build();
    const trace = assertDefined(traces.getTrace(TraceType.TRANSITION));
    return new Presenter(trace, traces, new InMemoryStorage(), callback);
  }

  override async createPresenter(
    callback: NotifyLogViewCallbackType<UiData>,
    trace = this.trace,
    positionUpdate = assertDefined(this.getPositionUpdate()),
  ): Promise<Presenter> {
    const transitionTrace = assertDefined(trace);
    const traces = new Traces();
    traces.addTrace(transitionTrace);

    const presenter = new Presenter(
      transitionTrace,
      traces,
      new InMemoryStorage(),
      callback,
    );
    await presenter.onAppEvent(positionUpdate); // trigger initialization
    return presenter;
  }

  override getPositionUpdate(): TracePositionUpdate {
    return assertDefined(this.positionUpdate);
  }

  override executePropertiesChecksAfterPositionUpdate(uiData: UiDataLog) {
    expect(uiData.entries.length).toBe(4);

    const selectedTransition = assertDefined(uiData.propertiesTree);
    expect(selectedTransition.getChildByName('id')?.formattedValue()).toBe(
      '32',
    );
    expect(selectedTransition.getChildByName('type')?.formattedValue()).toBe(
      'OPEN',
    );
    expect(
      selectedTransition.getChildByName('createTimeNs')?.formattedValue(),
    ).toBe('2023-11-21, 13:30:25.429');

    const dispatchTimeEntryTs = uiData.entries[0].fields[3];
    expect(dispatchTimeEntryTs?.propagateEntryTimestamp).toBeTrue();
    const sendTimeNotEntryTs = uiData.entries[0].fields[2];
    expect(sendTimeNotEntryTs?.propagateEntryTimestamp).toBeFalse();

    const dispatchTimeNotEntryTs = uiData.entries[3].fields[3];
    expect(dispatchTimeNotEntryTs?.propagateEntryTimestamp).toBeFalse();
    const sendTimeEntryTs = uiData.entries[3].fields[2];
    expect(sendTimeEntryTs?.propagateEntryTimestamp).toBeTrue();
  }

  override executeSpecializedTests() {
    describe('Specialized tests', () => {
      it('robust to corrupted transitions trace', async () => {
        const timestamp10 = makeRealTimestamp(10n);
        const trace = new TraceBuilder<HierarchyTreeNode | undefined>()
          .setType(TraceType.TRANSITION)
          .setParser(
            new ParserBuilder<HierarchyTreeNode | undefined>()
              .setEntries([undefined])
              .setTimestamps([timestamp10])
              .build(),
          )
          .build();
        const positionUpdate = TracePositionUpdate.fromTimestamp(timestamp10);
        let uiData: UiData | undefined;
        const presenter = await this.createPresenter(
          (newData) => {
            uiData = newData;
          },
          trace as Trace<HierarchyTreeNode>,
          positionUpdate,
        );
        await presenter.onAppEvent(positionUpdate);
        await new Timer().wait(
          () => uiData !== undefined && !uiData.isFetchingData,
        );
        expect(uiData?.entries).toEqual([]);
      });
    });
  }
}

describe('PresenterTransitions', () => {
  new PresenterTransitionsTest().execute();
});

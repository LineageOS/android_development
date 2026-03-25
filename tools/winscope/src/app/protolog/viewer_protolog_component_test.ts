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

import {VirtualScrollViewportComponent} from '@app/shared/scroll/virtual_scroll_viewport_component';
import {AbstractLogViewerComponentTest} from '@app/shared/testing/abstract_log_viewer_component_test';
import {assertDefined} from '@common/assert';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeElapsedTimestamp} from '@common/time/testing/test_helpers';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {ProtologColumnType} from '@trace/protolog/protolog_column_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {ProtologEntry, UiData} from '@ui/protolog/ui_data';
import {LogSelectFilter} from '@ui/shared/log/log_filters';
import {LogField, LogHeader} from '@ui/shared/log/ui_data_log';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {LogTextFilterChangeDetail} from '@ui/shared/viewers/viewer_event_details';

import {ViewerProtologComponent} from './viewer_protolog_component';

class ViewerProtologComponentTest extends AbstractLogViewerComponentTest<ViewerProtologComponent> {
  protected override readonly testProperties = false;
  protected override readonly hasTimeControls = true;
  protected override readonly testScroll = true;
  protected override readonly initialEntries = 7;

  protected override executeSpecializedTests(): void {
    describe('Specialized tests', () => {
      let component: ViewerProtologComponent;

      beforeEach(async () => {
        component = (await this.setUpTestEnvironment())[2];
      });

      it('binds log text filter change to output signal', () => {
        const logComponent = assertDefined(component.logComponent());
        const spy = spyOn(component.onLogTextFilterChange, 'emit');
        const detail = new LogTextFilterChangeDetail(
          new LogHeader(this.testSpec),
          new TextFilter(),
        );
        logComponent.logTextFilterChange.emit(detail);
        expect(spy).toHaveBeenCalledOnceWith(detail);
      });
    });
  }

  protected override checkTimestampInTable(
    dom: DOMTestHelper<ViewerProtologComponent>,
  ): void {
    const entryTimestamp = dom.get('.scroll .entry .time');
    entryTimestamp.checkTextExact('10ns');
  }

  protected override async setUpTestEnvironment(): Promise<
    [
      DOMTestHelper<ViewerProtologComponent>,
      VirtualScrollViewportComponent,
      ViewerProtologComponent,
    ]
  > {
    const tree = new HierarchyTreeBuilder()
      .setId('Protolog')
      .setName('tree')
      .build();
    const ts = makeElapsedTimestamp(10n);
    const trace = new TraceBuilder<HierarchyTreeNode>()
      .setEntries([tree, tree])
      .setTimestamps([ts, ts])
      .build();

    const messages: ProtologEntry[] = [];
    const shortMessage = 'test information about message';
    const longMessage = shortMessage.repeat(10) + 'keep';
    const traceEntry = trace.getEntry(0);
    for (let i = 0; i < 200; i++) {
      messages.push(
        new ProtologEntry(traceEntry, [
          this.testField,
          this.testField,
          this.testField,
          new LogField(
            {
              name: 'Test Column Text',
              cssClass: 'text',
              columnType: ProtologColumnType.MESSAGE,
            },
            i % 2 === 0 ? shortMessage : longMessage,
          ),
          new LogField(
            {
              name: 'Test Column Location',
              cssClass: 'source-file',
              columnType: ProtologColumnType.LOCATION,
            },
            'file1',
          ),
        ]),
      );
    }
    const uiData = new UiData(
      [new LogHeader(this.testSpec, new LogSelectFilter([]))],
      messages,
      150,
      undefined,
      undefined,
    );
    return await this.initializeTestEnvironment(
      uiData,
      ViewerProtologComponent,
    );
  }
}

describe('ViewerProtologComponent', () => {
  new ViewerProtologComponentTest().execute();
});

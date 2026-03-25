/*
 * Copyright (C) 2023 The Android Open Source Project
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
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeElapsedTimestamp} from '@common/time/testing/test_helpers';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {TraceEntry} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';
import {LogSelectFilter} from '@ui/shared/log/log_filters';
import {LogField, LogHeader} from '@ui/shared/log/ui_data_log';
import {TransitionsEntry, UiData} from '@ui/transitions/ui_data';

import {ViewerTransitionsComponent} from './viewer_transitions_component';

class ViewerTransitionsComponentTest extends AbstractLogViewerComponentTest<ViewerTransitionsComponent> {
  protected override readonly testProperties = true;
  protected override readonly hasTimeControls = true;
  protected override readonly testScroll = true;
  protected override readonly initialEntries = 8;
  protected override readonly propertiesSectionTitle = 'SELECTED TRANSITION';
  protected override readonly propertiesPlaceholder =
    'No current or selected transition.';

  private readonly transitionTree = new HierarchyTreeBuilder()
    .setId('TransitionTraceEntry')
    .setName('transition')
    .build();

  private readonly transitionProperties = new PropertyTreeBuilder()
    .setIsRoot(true)
    .setRootId('TransitionTraceEntry')
    .setName('transition')
    .build();

  protected override checkTimestampInTable(
    dom: DOMTestHelper<ViewerTransitionsComponent>,
  ): void {
    expect(dom.find('.scroll .entry .time')).toBeUndefined();
  }

  protected async setUpTestEnvironment(): Promise<
    [
      DOMTestHelper<ViewerTransitionsComponent>,
      VirtualScrollViewportComponent,
      ViewerTransitionsComponent,
    ]
  > {
    const trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.TRANSITION)
      .setEntries([this.transitionTree])
      .setTimestamps([makeElapsedTimestamp(20n)])
      .build();
    const entry = trace.getEntry(0);

    const transitions = [];
    for (let i = 0; i < 200; i++) {
      transitions.push(this.createMockTransition(entry, i));
    }
    const uiData = UiData.createEmpty();
    uiData.headers = [
      new LogHeader(this.testSpec),
      new LogHeader(this.testSpec, new LogSelectFilter([])),
    ];
    uiData.entries = transitions;
    uiData.selectedIndex = 0;

    return await this.initializeTestEnvironment(
      uiData,
      ViewerTransitionsComponent,
    );
  }

  private createMockTransition(
    entry: TraceEntry<HierarchyTreeNode>,
    i: number,
  ): TransitionsEntry {
    return new TransitionsEntry(
      entry,
      [
        this.testField,
        this.testField,
        this.testField,
        this.testField,
        this.testField,
        this.testField,
        new LogField(this.testSpec, i % 2 === 0 ? 'VALUE' : 'VALUE'.repeat(40)),
      ],
      async () => this.transitionProperties,
    );
  }
}

describe('ViewerTransitionsComponent', () => {
  new ViewerTransitionsComponentTest().execute();
});

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
import {NonPerfettoParserProvider} from '@parsers/fixture_utils';
import {Parser} from '@trace_api/parser';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {TraceEntry} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {CujEntry, UiData} from '@ui/jank_cujs/ui_data';
import {LogEntry, LogHeader} from '@ui/shared/log/ui_data_log';

import {ViewerJankCujsComponent} from './viewer_jank_cujs_component';

class ViewerJankCujsComponentTest extends AbstractLogViewerComponentTest<ViewerJankCujsComponent> {
  protected override readonly testProperties = false;
  protected override readonly testScroll = false;
  protected override readonly hasTimeControls = false;
  protected override readonly hasFilters = false;

  protected override checkTimestampInTable(
    dom: DOMTestHelper<ViewerJankCujsComponent>,
  ): void {
    expect(dom.find('.scroll .entry .time')).toBeUndefined();
  }

  protected async setUpTestEnvironment(): Promise<
    [
      DOMTestHelper<ViewerJankCujsComponent>,
      VirtualScrollViewportComponent,
      ViewerJankCujsComponent,
    ]
  > {
    const parser = (await new NonPerfettoParserProvider()
      .addFile('traces/elapsed_and_real_timestamp/eventlog.winscope')
      .get()) as Parser<HierarchyTreeNode>;

    const trace = new TraceBuilder<HierarchyTreeNode>()
      .setParser(parser)
      .setType(TraceType.CUJS)
      .build();

    const entry = trace.getEntry(0);
    const cujEntries = [
      this.createMockCujEntry(entry),
      this.createMockCujEntry(entry),
      this.createMockCujEntry(entry),
      this.createMockCujEntry(entry),
    ];

    const uiData = UiData.createEmpty();
    uiData.headers = [new LogHeader(this.testSpec)];
    uiData.entries = cujEntries;
    uiData.selectedIndex = 0;

    return this.initializeTestEnvironment(uiData, ViewerJankCujsComponent);
  }

  private createMockCujEntry(entry: TraceEntry<HierarchyTreeNode>): LogEntry {
    return new CujEntry(entry, [
      this.testField,
      this.testField,
      this.testField,
      this.testField,
      this.testField,
    ]);
  }
}

describe('ViewerJankCujsComponent', () => {
  new ViewerJankCujsComponentTest().execute();
});

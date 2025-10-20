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

import {CdkVirtualScrollViewport} from '@angular/cdk/scrolling';
import {assertDefined} from 'common/assert';
import {DOMTestHelper} from 'test/unit/dom_test_helpers';
import {HierarchyTreeBuilder} from 'test/unit/hierarchy_tree_builder';
import {PropertyTreeBuilder} from 'test/unit/property_tree_builder';
import {makeElapsedTimestamp} from 'test/unit/time_test_helpers';
import {TraceBuilder} from 'test/unit/trace_builder';
import {InputColumnType} from 'trace/input/input_column_type';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {AbstractLogViewerComponentTest} from 'viewers/common/abstract_log_viewer_component_test';
import {LogSelectFilter} from 'viewers/common/log_filters';
import {LogHeader} from 'viewers/common/ui_data_log';
import {RectsComponent} from 'viewers/components/rects/rects_component';
import {UserOptionsComponent} from 'viewers/components/user_options_component';
import {InputEntry, UiData} from './ui_data';
import {ViewerInputComponent} from './viewer_input_component';

class ViewerInputComponentTest extends AbstractLogViewerComponentTest<ViewerInputComponent> {
  protected override readonly testProperties = true;
  protected override readonly testScroll = true;
  protected override readonly initialEntries = 30;
  protected override readonly hasCurrentTimeButton = false;
  protected override readonly propertiesSectionTitle = 'EVENT DETAILS';
  protected override readonly propertiesPlaceholder = 'No selected entry.';

  private hTree = new HierarchyTreeBuilder()
    .setId('AndroidMotionEvent')
    .setName('entry')
    .build();
  private pTree = new PropertyTreeBuilder()
    .setIsRoot(true)
    .setRootId('AndroidMotionEvent')
    .setName('entry')
    .build();
  private trace = new TraceBuilder<HierarchyTreeNode>()
    .setType(TraceType.INPUT_EVENT_MERGED)
    .setEntries([this.hTree])
    .setTimestamps([makeElapsedTimestamp(20n)])
    .build();
  private entry = this.trace.getEntry(0);

  protected override checkTimestampInTable(
    dom: DOMTestHelper<ViewerInputComponent>,
  ): void {
    expect(dom.find('.scroll .entry .time')).toBeUndefined();
  }

  protected override executeSpecializedTests(): void {
    describe('Specialized tests', () => {
      let dom: DOMTestHelper<ViewerInputComponent>;
      let viewport: CdkVirtualScrollViewport;
      let component: ViewerInputComponent;

      beforeEach(async () => {
        [dom, viewport, component] = await this.setUpTestEnvironment();
      });

      it('handles collapse/expand', () => {
        dom.checkSectionCollapseAndExpand('.rects-view', 'INPUT WINDOWS');
        dom.checkSectionCollapseAndExpand('.event-properties', 'EVENT DETAILS');
        dom.checkSectionCollapseAndExpand(
          '.dispatch-properties',
          'DISPATCH DETAILS',
        );
        dom.checkSectionCollapseAndExpand('.log-view', 'EVENT LOG');
      });

      it('shows rects view when rects are defined', () => {
        assertDefined(component.inputData).rectsToDraw = [];
        dom.detectChanges();
        expect(dom.find('.rects-view')).toBeDefined();
      });

      it('hides rects view when rects are not defined', () => {
        assertDefined(component.inputData).rectsToDraw = undefined;
        dom.detectChanges();
        expect(dom.find('.rects-view')).toBeUndefined();
      });

      it('shows message when no event is selected', () => {
        assertDefined(component.inputData).propertiesTree = undefined;
        assertDefined(component.inputData).dispatchPropertiesTree = undefined;
        dom.detectChanges();
        dom
          .get('.event-properties .placeholder-text')
          .checkTextExact('No selected entry.');
        dom
          .get('.dispatch-properties .placeholder-text')
          .checkTextExact('No selected entry.');
      });
    });
  }

  protected async setUpTestEnvironment(): Promise<
    [
      DOMTestHelper<ViewerInputComponent>,
      CdkVirtualScrollViewport,
      ViewerInputComponent,
    ]
  > {
    const entries = [
      this.createInputEntry(),
      this.createInputEntry(),
      this.createInputEntry(),
    ];

    const uiData = UiData.createEmpty();
    uiData.headers = [new LogHeader(this.testSpec, new LogSelectFilter([]))];
    uiData.entries = entries;
    uiData.selectedIndex = 0;

    uiData.rectsToDraw = [];
    return this.initializeTestEnvironment(uiData, ViewerInputComponent, [
      RectsComponent,
      UserOptionsComponent,
    ]);
  }

  protected override async setUpTestEnvironmentForScroll(): Promise<
    [DOMTestHelper<ViewerInputComponent>, CdkVirtualScrollViewport]
  > {
    const uiData = UiData.createEmpty();
    uiData.headers = [new LogHeader(this.testSpec, new LogSelectFilter([]))];
    uiData.selectedIndex = 0;
    uiData.rectsToDraw = [];
    uiData.entries = Array.from({length: 200}, () => this.createInputEntry());

    const [dom, viewport] = await this.initializeTestEnvironment(
      uiData,
      ViewerInputComponent,
      [RectsComponent, UserOptionsComponent],
    );
    return [dom, viewport];
  }

  private createInputEntry(): InputEntry {
    return new InputEntry(
      this.entry,
      [
        {
          spec: this.testSpec,
          value: 'VALUE',
          propagateEntryTimestamp: true,
        },
        this.testField,
        this.testField,
        {
          spec: {
            name: 'Test Column Action',
            cssClass: 'test-class-action',
            columnType: InputColumnType.ACTION,
          },
          value: 'VALUE',
        },
        this.testField,
        this.testField,
        this.testField,
      ],
      async () => this.pTree,
      async () => this.pTree,
      undefined,
    );
  }
}

describe('ViewerInputComponent', () => {
  new ViewerInputComponentTest().execute();
});

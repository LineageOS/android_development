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

import {PropertiesComponent} from '@app/shared/properties/properties_component';
import {RectsComponent} from '@app/shared/rects/rects_component';
import {VirtualScrollViewportComponent} from '@app/shared/scroll/virtual_scroll_viewport_component';
import {AbstractLogViewerComponentTest} from '@app/shared/testing/abstract_log_viewer_component_test';
import {UserOptionsComponent} from '@app/shared/user_options/user_options_component';
import {assertDefined} from '@common/assert';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeElapsedTimestamp} from '@common/time/testing/test_helpers';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {TraceType} from '@trace_api/trace_type';
import {InputColumnType} from '@trace/input/input_column_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';
import {InputEntry, UiData} from '@ui/input/ui_data';
import {LogSelectFilter} from '@ui/shared/log/log_filters';
import {LogField, LogHeader} from '@ui/shared/log/ui_data_log';
import {TextFilter} from '@ui/shared/user_input/text_filter';

import {ViewerInputComponent} from './viewer_input_component';

class ViewerInputComponentTest extends AbstractLogViewerComponentTest<ViewerInputComponent> {
  protected override readonly testProperties = true;
  protected override readonly testScroll = true;
  protected override readonly initialEntries = 10;
  protected override readonly hasTimeControls = false;
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
      let component: ViewerInputComponent;

      beforeEach(async () => {
        [dom, , component] = await this.setUpTestEnvironment();
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
        const inputData = assertDefined(component.inputData());
        inputData.rectsToDraw = [];
        dom.detectChanges();
        expect(dom.find('.rects-view')).toBeDefined();
      });

      it('hides rects view when rects are not defined', () => {
        const inputData = assertDefined(component.inputData());
        inputData.rectsToDraw = undefined;
        dom.detectChanges();
        expect(dom.find('.rects-view')).toBeUndefined();
      });

      it('shows message when no event is selected', () => {
        const inputData = assertDefined(component.inputData());
        inputData.propertyNodes = undefined;
        inputData.dispatchPropertyNodes = undefined;
        dom.detectChanges();
        dom
          .get('.event-properties .placeholder-text')
          .checkTextExact('No selected entry.');
        dom
          .get('.dispatch-properties .placeholder-text')
          .checkTextExact('No selected entry.');
      });

      it('binds rect view events to output signals', () => {
        const rects = assertDefined(dom.findByDirective(RectsComponent));

        const highlightedSpy = spyOn(component.onHighlightedIdChange, 'emit');
        const id = 'test';
        rects.highlightedIdChange.emit(id);
        expect(highlightedSpy).toHaveBeenCalledOnceWith(id);

        const optionsSpy = spyOn(component.onRectsUserOptionsChange, 'emit');
        const options = {opt: {name: 'opt', enabled: true}};
        rects.optionsChange.emit(options);
        expect(optionsSpy).toHaveBeenCalledOnceWith(options);

        const dblClickSpy = spyOn(component.onRectsDblClick, 'emit');
        rects.rectsDblClick.emit(id);
        expect(dblClickSpy).toHaveBeenCalledTimes(1);
      });

      it('binds input event properties highlighted property event to output signal', () => {
        const properties = dom.findAllByDirective(PropertiesComponent)[0];
        const spy = spyOn(component.onHighlightedPropertyChange, 'emit');
        const id = 'test';
        properties.highlightedPropertyChange.emit(id);
        expect(spy).toHaveBeenCalledOnceWith(id);
      });

      it('binds dispatched properties events to output signals', () => {
        const dispatchProperties =
          dom.findAllByDirective(PropertiesComponent)[1];

        const filterSpy = spyOn(
          component.onDispatchPropertiesFilterChange,
          'emit',
        );
        const filter = new TextFilter();
        dispatchProperties.filterChange.emit(filter);
        expect(filterSpy).toHaveBeenCalledOnceWith(filter);

        const spy = spyOn(component.onHighlightedPropertyChange, 'emit');
        const id = 'test';
        dispatchProperties.highlightedPropertyChange.emit(id);
        expect(spy).toHaveBeenCalledOnceWith(id);
      });
    });
  }

  protected async setUpTestEnvironment(): Promise<
    [
      DOMTestHelper<ViewerInputComponent>,
      VirtualScrollViewportComponent,
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
    [
      DOMTestHelper<ViewerInputComponent>,
      VirtualScrollViewportComponent,
      ViewerInputComponent,
    ]
  > {
    const uiData = UiData.createEmpty();
    uiData.headers = [new LogHeader(this.testSpec, new LogSelectFilter([]))];
    uiData.selectedIndex = 0;
    uiData.rectsToDraw = [];
    uiData.entries = Array.from({length: 200}, () => this.createInputEntry());

    return await this.initializeTestEnvironment(uiData, ViewerInputComponent, [
      RectsComponent,
      UserOptionsComponent,
    ]);
  }

  private createInputEntry(): InputEntry {
    return new InputEntry(
      this.entry,
      [
        new LogField(this.testSpec, 'VALUE', undefined, undefined, true),
        this.testField,
        this.testField,
        new LogField(
          {
            name: 'Test Column Action',
            cssClass: 'test-class-action',
            columnType: InputColumnType.ACTION,
          },
          'VALUE',
        ),
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

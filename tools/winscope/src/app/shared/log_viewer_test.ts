/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {ComponentRef} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {LogViewerComponentStub} from '@app/shared/log_view/testing/log_viewer_component_stub';
import {MockViewer} from '@app/shared/testing/mock_log_viewer';
import {MockPresenter} from '@app/shared/testing/mock_log_viewer_presenter';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeZeroTimestamp} from '@common/time/testing/test_helpers';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {LogSelectFilter} from '@ui/shared/log/log_filters';
import {LogHeader} from '@ui/shared/log/ui_data_log';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {LogFilterChangeDetail, LogTextFilterChangeDetail, TimestampClickDetail,} from '@ui/shared/viewers/viewer_event_details';

describe('AbstractLogViewer', () => {
  const testHeader = new LogHeader(
    {name: 'Test Column', cssClass: 'test-class'},
    new LogSelectFilter([]),
  );

  let viewer: MockViewer;
  let trace: Trace<HierarchyTreeNode>;
  let componentRef: ComponentRef<LogViewerComponentStub>;
  let dom: DOMTestHelper<LogViewerComponentStub>;
  let presenter: MockPresenter;

  beforeAll(async () => {
    trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.TRANSACTIONS)
      .setEntries([
        new HierarchyTreeBuilder()
          .setId('Test Trace')
          .setName('entry 1')
          .build(),
        new HierarchyTreeBuilder()
          .setId('Test Trace')
          .setName('entry 2')
          .build(),
        new HierarchyTreeBuilder()
          .setId('Test Trace')
          .setName('entry 3')
          .build(),
        new HierarchyTreeBuilder()
          .setId('Test Trace')
          .setName('entry 4')
          .build(),
      ])
      .build();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogViewerComponentStub],
    }).compileComponents();
    const fixture = TestBed.createComponent(LogViewerComponentStub);
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    componentRef = fixture.componentRef;
    viewer = new MockViewer(trace, new Traces(), new InMemoryStorage());
    viewer.setComponentRef(componentRef);
    presenter = viewer.getPresenter();
  });

  it('adds viewer specific listeners', () => {
    viewer = new MockViewer(trace, new Traces(), new InMemoryStorage());
    const spy = spyOn(viewer, 'addViewerSpecificListeners');
    viewer.setComponentRef(componentRef);
    expect(spy).toHaveBeenCalledOnceWith(componentRef.instance);
  });

  it('adds component output listener for onSelectFilterChange', async () => {
    const spy: jasmine.Spy = spyOn(presenter, 'onSelectFilterChange');
    const filterDetail = new LogFilterChangeDetail(testHeader, ['']);
    componentRef.instance.onLogFilterChange.emit(filterDetail);
    expect(spy).toHaveBeenCalledOnceWith(testHeader, filterDetail.value);
  });

  it('adds component output listener for onTextFilterChange', async () => {
    const spy = spyOn(presenter, 'onTextFilterChange');
    const textFilterDetail = new LogTextFilterChangeDetail(
      testHeader,
      new TextFilter(),
    );
    componentRef.instance.onLogTextFilterChange.emit(textFilterDetail);
    expect(spy).toHaveBeenCalledOnceWith(testHeader, textFilterDetail.filter);
  });

  it('adds component output listener for onLogEntryClick', async () => {
    const spy = spyOn(presenter, 'onLogEntryClick');
    componentRef.instance.onLogEntryClick.emit(0);
    expect(spy).toHaveBeenCalledOnceWith(0);
  });

  it('adds component output listener for onArrowDownPress', async () => {
    const spy = spyOn(presenter, 'onArrowDownPress');
    componentRef.instance.onArrowDownPress.emit();
    expect(spy).toHaveBeenCalled();
  });

  it('adds component output listener for onArrowUpPress', async () => {
    const spy = spyOn(presenter, 'onArrowUpPress');
    componentRef.instance.onArrowUpPress.emit();
    expect(spy).toHaveBeenCalled();
  });

  it('adds component output listener for onTimestampClick', async () => {
    const ts = makeZeroTimestamp();
    const detail = new TimestampClickDetail(undefined, ts);
    const spy = spyOn(presenter, 'onTimestampClick');
    componentRef.instance.onTimestampClick.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail);
  });

  it('adds component output listener for onPropertiesUserOptionsChange', async () => {
    const spy = spyOn(presenter, 'onPropertiesUserOptionsChange');
    const options = {opt1: {name: 'opt1', enabled: true}};
    componentRef.instance.onPropertiesUserOptionsChange.emit(options);
    expect(spy).toHaveBeenCalledOnceWith(options);
  });

  it('adds component output listener for onPropertiesFilterChange', async () => {
    const spy = spyOn(presenter, 'onPropertiesFilterChange');
    const filter = new TextFilter();
    componentRef.instance.onPropertiesFilterChange.emit(filter);
    expect(spy).toHaveBeenCalledOnceWith(filter);
  });

  it('adds component output listener for onPositionChangeByKeyPress', async () => {
    const htmlElement = dom.getHTMLElement();
    htmlElement.style.display = 'none';
    dom.detectChanges();

    // element not visible, no spy called
    const spy = spyOn(presenter, 'onPositionChangeByKeyPress');
    dom.keydownArrowLeft(true);
    dom.keydownArrowRight(true);
    dom.keydownArrowUp(true);
    expect(spy).not.toHaveBeenCalled();

    // element is visible, spy called
    htmlElement.style.display = '';
    dom.detectChanges();
    dom.keydownArrowLeft(true);
    expect(spy).toHaveBeenCalledTimes(1);
    dom.keydownArrowRight(true);
    expect(spy).toHaveBeenCalledTimes(2);

    // arrow up does not signify position change, spy not called
    dom.keydownArrowUp(true);
    expect(spy).toHaveBeenCalledTimes(2);

    // keydown on input field, spy not called
    const inputElement = document.createElement('input');
    inputElement.type = 'text';
    dom.keydownArrowLeft(true, inputElement);
    dom.keydownArrowRight(true, inputElement);
    dom.keydownArrowUp(true, inputElement);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

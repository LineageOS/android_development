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
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {Presenter} from '@ui/input/presenter';
import {TextFilter} from '@ui/shared/user_input/text_filter';

import {ViewerInput} from './viewer_input';
import {ViewerInputComponent} from './viewer_input_component';

describe('ViewerInput', () => {
  const node = new HierarchyTreeBuilder()
    .setId('Test Trace')
    .setName('entry 1')
    .build();
  const trace: Trace<HierarchyTreeNode> = new TraceBuilder<HierarchyTreeNode>()
    .setType(TraceType.INPUT_EVENT_MERGED)
    .setEntries([node])
    .build();

  let viewer: ViewerInput;
  let componentRef: ComponentRef<ViewerInputComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewerInputComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ViewerInputComponent);
    componentRef = fixture.componentRef;
    const traces = new Traces();
    traces.addTrace(trace);
    viewer = new ViewerInput(traces, new InMemoryStorage());
    viewer.setComponentRef(componentRef);
  });

  it('adds component output listener for onHighlightedIdChange', async () => {
    const spy = spyOn(Presenter.prototype, 'onHighlightedIdChange');
    const detail = 'test';
    componentRef.instance.onHighlightedIdChange.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail);
  });

  it('adds component output listener for onRectsUserOptionsChange', async () => {
    const spy = spyOn(Presenter.prototype, 'onRectsUserOptionsChange');
    const detail = {opt1: {name: 'test', enabled: true}};
    componentRef.instance.onRectsUserOptionsChange.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail);
  });

  it('adds component output listener for onRectDoubleClick', () => {
    const spy = spyOn(Presenter.prototype, 'onRectDoubleClick');
    componentRef.instance.onRectsDblClick.emit();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('adds component output listener for onDispatchPropertiesFilterChange', async () => {
    const spy = spyOn(Presenter.prototype, 'onDispatchPropertiesFilterChange');
    const detail = new TextFilter();
    componentRef.instance.onDispatchPropertiesFilterChange.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail);
  });

  it('adds component output listener for onHighlightedPropertyChange', async () => {
    const spy = spyOn(Presenter.prototype, 'onHighlightedPropertyChange');
    const detail = 'test';
    componentRef.instance.onHighlightedPropertyChange.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail, false);
  });
});

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
import {HierarchyViewerComponentStub} from '@app/shared/hierarchy/testing/hierarchy_viewer_component_stub';
import {MockViewer} from '@app/shared/testing/mock_hierarchy_viewer';
import {MockPresenter} from '@app/shared/testing/mock_hierarchy_viewer_presenter';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {makeUiHierarchyNode} from '@ui/shared/hierarchy/testing/ui_hierarchy_tree_node_test_helpers';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {RectShowStateChangeDetail} from '@ui/shared/viewers/viewer_event_details';

describe('AbstractHierarchyViewer', () => {
  let viewer: MockViewer;
  let trace: Trace<HierarchyTreeNode>;
  let componentRef: ComponentRef<HierarchyViewerComponentStub>;
  let presenter: MockPresenter;

  beforeAll(async () => {
    trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.SURFACE_FLINGER)
      .setEntries([
        new HierarchyTreeBuilder()
          .setId('Test Trace')
          .setName('entry 1')
          .build(),
      ])
      .build();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HierarchyViewerComponentStub],
    }).compileComponents();
    const fixture = TestBed.createComponent(HierarchyViewerComponentStub);
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

  it('adds component output listener for onPinnedItemChange', async () => {
    const spy: jasmine.Spy = spyOn(presenter, 'onPinnedItemChange');
    const node = makeUiHierarchyNode({name: 'test'});
    componentRef.instance.onHierarchyPinnedChange.emit(node);
    expect(spy).toHaveBeenCalledOnceWith(node);
  });

  it('adds component output listener for onHighlightedIdChange', async () => {
    const spy = spyOn(presenter, 'onHighlightedIdChange');
    componentRef.instance.onHighlightedIdChange.emit('test');
    expect(spy).toHaveBeenCalledOnceWith('test');
  });

  it('adds component output listener for onHighlightedPropertyChange', async () => {
    const spy = spyOn(presenter, 'onHighlightedPropertyChange');
    componentRef.instance.onHighlightedPropertyChange.emit('test');
    expect(spy).toHaveBeenCalledOnceWith('test');
  });

  it('adds component output listener for onHierarchyUserOptionsChange', async () => {
    const spy = spyOn(presenter, 'onHierarchyUserOptionsChange');
    const options = {opt1: {name: 'opt1', enabled: true}};
    componentRef.instance.onHierarchyUserOptionsChange.emit(options);
    expect(spy).toHaveBeenCalledOnceWith(options);
  });

  it('adds component output listener for onHierarchyFilterChange', async () => {
    const spy = spyOn(presenter, 'onHierarchyFilterChange');
    const filter = new TextFilter();
    componentRef.instance.onHierarchyFilterChange.emit(filter);
    expect(spy).toHaveBeenCalledOnceWith(filter);
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

  it('adds component output listener for onHighlightedNodeChange', async () => {
    const spy = spyOn(presenter, 'onHighlightedNodeChange');
    const node = makeUiHierarchyNode({name: 'test'});
    componentRef.instance.onHighlightedNodeChange.emit(node);
    expect(spy).toHaveBeenCalledOnceWith(node);
  });

  it('adds component output listener for onRectsUserOptionsChange', async () => {
    const spy = spyOn(presenter, 'onRectsUserOptionsChange');
    const options = {opt1: {name: 'opt1', enabled: true}};
    componentRef.instance.onRectsUserOptionsChange.emit(options);
    expect(spy).toHaveBeenCalledOnceWith(options);
  });

  it('adds component output listener for onRectShowStateChange', async () => {
    const spy = spyOn(presenter, 'onRectShowStateChange');
    const detail = new RectShowStateChangeDetail('test', RectShowState.HIDE);
    componentRef.instance.onRectShowStateChange.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail.rectId, detail.state);
  });
});

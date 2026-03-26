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
import {makeUiPropertyNode} from '@ui/shared/properties/testing/ui_property_tree_node_test_helpers';
import {Presenter} from '@ui/window_manager/presenter';

import {ViewerWindowManager} from './viewer_window_manager';
import {ViewerWindowManagerComponent} from './viewer_window_manager_component';

describe('ViewerWindowManager', () => {
  const node = new HierarchyTreeBuilder()
    .setId('Test Trace')
    .setName('entry 1')
    .setProperties({prop1: 1})
    .build();
  const trace: Trace<HierarchyTreeNode> = new TraceBuilder<HierarchyTreeNode>()
    .setType(TraceType.WINDOW_MANAGER)
    .setEntries([node])
    .build();

  let viewer: ViewerWindowManager;
  let componentRef: ComponentRef<ViewerWindowManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewerWindowManagerComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ViewerWindowManagerComponent);
    componentRef = fixture.componentRef;
    const traces = new Traces();
    traces.addTrace(trace);
    viewer = new ViewerWindowManager(trace, traces, new InMemoryStorage());
    viewer.setComponentRef(componentRef);
  });

  it('adds component output listener for onPropagatePropertyClick ', async () => {
    const spy = spyOn(Presenter.prototype, 'onPropagatePropertyClick');
    const property = makeUiPropertyNode('', '', false);
    componentRef.instance.onPropagatePropertyClick.emit(property);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

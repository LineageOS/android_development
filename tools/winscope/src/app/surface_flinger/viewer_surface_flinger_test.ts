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
import {TraceRectType} from '@ui/shared/rects/rect_spec';
import {Presenter} from '@ui/surface_flinger/presenter';

import {ViewerSurfaceFlinger} from './viewer_surface_flinger';
import {ViewerSurfaceFlingerComponent} from './viewer_surface_flinger_component';

describe('ViewerSurfaceFlinger', () => {
  const node = new HierarchyTreeBuilder()
    .setId('Test Trace')
    .setName('entry 1')
    .build();
  const trace: Trace<HierarchyTreeNode> = new TraceBuilder<HierarchyTreeNode>()
    .setType(TraceType.SURFACE_FLINGER)
    .setEntries([node])
    .build();

  let viewer: ViewerSurfaceFlinger;
  let componentRef: ComponentRef<ViewerSurfaceFlingerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewerSurfaceFlingerComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ViewerSurfaceFlingerComponent);
    componentRef = fixture.componentRef;
    const traces = new Traces();
    traces.addTrace(trace);
    viewer = new ViewerSurfaceFlinger(trace, traces, new InMemoryStorage());
    viewer.setComponentRef(componentRef);
  });

  it('adds component output listener for onRectDoubleClick', async () => {
    const spy = spyOn(Presenter.prototype, 'onRectDoubleClick');
    const detail = 'test';
    componentRef.instance.onRectsDblClick.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail);
  });

  it('adds component output listener for onRectTypeButtonClicked', async () => {
    const spy = spyOn(Presenter.prototype, 'onRectTypeButtonClicked');
    const detail = TraceRectType.INPUT_WINDOWS;
    componentRef.instance.onRectTypeButtonClick.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail);
  });
});

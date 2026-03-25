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
import {Presenter} from '@ui/view_capture/presenter';

import {ViewerViewCapture} from './viewer_view_capture';
import {ViewerViewCaptureComponent} from './viewer_view_capture_component';

describe('ViewerViewCapture', () => {
  const node = new HierarchyTreeBuilder()
    .setId('Test Trace')
    .setName('entry 1')
    .build();
  const trace: Trace<HierarchyTreeNode> = new TraceBuilder<HierarchyTreeNode>()
    .setType(TraceType.VIEW_CAPTURE)
    .setEntries([node])
    .build();

  let viewer: ViewerViewCapture;
  let componentRef: ComponentRef<ViewerViewCaptureComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewerViewCaptureComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ViewerViewCaptureComponent);
    componentRef = fixture.componentRef;
    const traces = new Traces();
    traces.addTrace(trace);
    viewer = new ViewerViewCapture(traces, new InMemoryStorage());
    viewer.setComponentRef(componentRef);
  });

  it('adds component output listener for onMiniRectsDoubleClick', async () => {
    const spy = spyOn(Presenter.prototype, 'onMiniRectsDoubleClick');
    componentRef.instance.onMiniRectsDblClick.emit();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

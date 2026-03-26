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
import {ViewerInputMethodComponent} from '@app/input_method/shared/viewer_input_method_component';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {PresenterInputMethodManagerService} from '@ui/input_method/imms/presenter_input_method_manager_service';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {AdditionalPropertySelectedDetail, RectShowStateChangeDetail,} from '@ui/shared/viewers/viewer_event_details';

import {ViewerInputMethodManagerService} from './viewer_input_method_manager_service';

describe('ViewerInputMethodManagerService', () => {
  const node = new HierarchyTreeBuilder()
    .setId('Test Trace')
    .setName('entry 1')
    .build();
  const trace: Trace<HierarchyTreeNode> = new TraceBuilder<HierarchyTreeNode>()
    .setType(TraceType.INPUT_METHOD_MANAGER_SERVICE)
    .setEntries([node])
    .build();

  let viewer: ViewerInputMethodManagerService;
  let componentRef: ComponentRef<ViewerInputMethodComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewerInputMethodComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ViewerInputMethodComponent);
    componentRef = fixture.componentRef;
    viewer = new ViewerInputMethodManagerService(
      trace,
      new Traces(),
      new InMemoryStorage(),
    );
    viewer.setComponentRef(componentRef);
  });

  it('adds component output listener for onAdditionalPropertySelected', async () => {
    const spy = spyOn(
      PresenterInputMethodManagerService.prototype,
      'onAdditionalPropertySelected',
    );
    const detail = new AdditionalPropertySelectedDetail('test', node);
    componentRef.instance.onAdditionalPropertySelected.emit(detail);
    expect(spy).toHaveBeenCalledOnceWith(detail);
  });

  it('does not add rect event listeners', () => {
    const showStateSpy = spyOn(
      PresenterInputMethodManagerService.prototype,
      'onRectShowStateChange',
    );
    const detail = new RectShowStateChangeDetail('test', RectShowState.SHOW);
    componentRef.instance.onRectShowStateChange.emit(detail);
    expect(showStateSpy).not.toHaveBeenCalled();

    const optionsSpy = spyOn(
      PresenterInputMethodManagerService.prototype,
      'onRectsUserOptionsChange',
    );
    componentRef.instance.onRectsUserOptionsChange.emit({});
    expect(optionsSpy).not.toHaveBeenCalled();
  });
});

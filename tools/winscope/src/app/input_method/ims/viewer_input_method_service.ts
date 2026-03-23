/*
 * Copyright (C) 2022 The Android Open Source Project
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

import {ViewerInputMethodComponent} from '@app/input_method/shared/viewer_input_method_component';
import {AbstractHierarchyViewer} from '@app/shared/abstract_hierarchy_viewer';
import {Store} from '@common/store/store';
import {Trace} from '@trace_api/trace';
import {ImeTraceType, TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {ImeUiData} from '@ui/input_method/ime_ui_data';
import {PresenterInputMethodService} from '@ui/input_method/ims/presenter_input_method_service';
import {NotifyHierarchyViewCallbackType} from '@ui/shared/hierarchy/abstract_hierarchy_viewer_presenter';

export class ViewerInputMethodService extends AbstractHierarchyViewer<
  HierarchyTreeNode,
  ImeUiData,
  PresenterInputMethodService
> {
  static readonly DEPENDENCIES: ImeTraceType[] = [
    TraceType.INPUT_METHOD_SERVICE,
  ];

  protected override readonly hasRects = false;

  constructor(trace: Trace<HierarchyTreeNode>, traces: Traces, storage: Store) {
    super(trace, traces, ViewerInputMethodComponent, storage);
  }

  override createPresenter(
    trace: Trace<HierarchyTreeNode>,
    traces: Traces,
    storage: Store,
    imeUiCallback: NotifyHierarchyViewCallbackType<ImeUiData>,
  ) {
    return new PresenterInputMethodService(
      trace,
      traces,
      storage,
      imeUiCallback,
    );
  }

  protected override addViewerSpecificListeners(
    component: ViewerInputMethodComponent,
  ) {
    component.onAdditionalPropertySelected.subscribe(async (detail) => {
      await this.presenter.onAdditionalPropertySelected(detail);
    });
  }
}

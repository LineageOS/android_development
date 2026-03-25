/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {AbstractHierarchyViewer} from '@app/shared/abstract_hierarchy_viewer';
import {Store} from '@common/store/store';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {Presenter} from '@ui/view_capture/presenter';
import {UiData} from '@ui/view_capture/ui_data';

import {ViewerViewCaptureComponent} from './viewer_view_capture_component';

export class ViewerViewCapture extends AbstractHierarchyViewer<
  HierarchyTreeNode,
  UiData,
  Presenter
> {
  static readonly DEPENDENCIES: TraceType[] = [TraceType.VIEW_CAPTURE];

  constructor(traces: Traces, store: Store) {
    super(undefined, traces, ViewerViewCaptureComponent, store);
  }

  override getTraces(): Array<Trace<HierarchyTreeNode>> {
    return (this.presenter as Presenter).getTraces();
  }

  protected override createPresenter(
    trace: undefined,
    traces: Traces,
    store: Store,
    notifyViewCallback: (uiData: UiData) => void,
  ): Presenter {
    return new Presenter(traces, store, notifyViewCallback);
  }

  protected override getTraceTypeForViewTitle(): TraceType {
    return TraceType.VIEW_CAPTURE;
  }

  protected override addViewerSpecificListeners(
    component: ViewerViewCaptureComponent,
  ) {
    component.onMiniRectsDblClick.subscribe(async () => {
      await this.presenter.onMiniRectsDoubleClick();
    });
  }
}

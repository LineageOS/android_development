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

import {AbstractLogViewer} from '@app/shared/abstract_log_viewer';
import {assertDefined} from '@common/assert';
import {Store} from '@common/store/store';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {Presenter} from '@ui/input/presenter';
import {UiData} from '@ui/input/ui_data';

import {ViewerInputComponent} from './viewer_input_component';

export class ViewerInput extends AbstractLogViewer<
  HierarchyTreeNode,
  UiData,
  Presenter
> {
  static readonly DEPENDENCIES: TraceType[] = [TraceType.INPUT_EVENT_MERGED];

  constructor(traces: Traces, store: Store) {
    const trace = assertDefined(
      traces.getTrace<HierarchyTreeNode>(TraceType.INPUT_EVENT_MERGED),
    );
    super(trace, traces, ViewerInputComponent, store);
  }

  protected override createPresenter(
    trace: Trace<HierarchyTreeNode>,
    traces: Traces,
    store: Store,
    notifyViewCallback: (uiData: UiData) => void,
  ): Presenter {
    return new Presenter(traces, trace, store, notifyViewCallback);
  }

  protected override addViewerSpecificListeners(
    component: ViewerInputComponent,
  ) {
    component.onHighlightedIdChange.subscribe(async (detail) => {
      await this.presenter.onHighlightedIdChange(detail);
    });
    component.onRectsUserOptionsChange.subscribe(async (detail) => {
      await this.presenter.onRectsUserOptionsChange(detail);
    });
    component.onRectsDblClick.subscribe(async () => {
      await this.presenter.onRectDoubleClick();
    });

    component.onHighlightedPropertyChange.subscribe((detail) => {
      this.presenter.onHighlightedPropertyChange(detail, false);
    });
    component.onDispatchPropertiesFilterChange.subscribe(async (detail) => {
      await this.presenter.onDispatchPropertiesFilterChange(detail);
    });
  }
}

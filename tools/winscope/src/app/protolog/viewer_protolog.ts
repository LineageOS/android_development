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

import {AbstractLogViewer} from '@app/shared/abstract_log_viewer';
import {Store} from '@common/store/store';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {Presenter} from '@ui/protolog/presenter';
import {UiData} from '@ui/protolog/ui_data';

import {ViewerProtologComponent} from './viewer_protolog_component';

export class ViewerProtoLog extends AbstractLogViewer<
  HierarchyTreeNode,
  UiData,
  Presenter
> {
  static readonly DEPENDENCIES: TraceType[] = [TraceType.PROTO_LOG];

  constructor(trace: Trace<HierarchyTreeNode>, traces: Traces, store: Store) {
    super(trace, traces, ViewerProtologComponent, store);
  }

  protected override createPresenter(
    trace: Trace<HierarchyTreeNode>,
    traces: Traces,
    store: Store,
    notifyViewCallback: (uiData: UiData) => void,
  ): Presenter {
    return new Presenter(trace, notifyViewCallback, store);
  }
}

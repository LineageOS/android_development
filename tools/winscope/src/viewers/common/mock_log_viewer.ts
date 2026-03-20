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

import {Store} from '@common/store/store';
import {Trace} from '@trace_api/trace';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {AbstractLogViewer} from '@viewers/abstract_log_viewer';
import {NotifyLogViewCallbackType} from '@viewers/common/abstract_log_viewer_presenter';
import {UiDataLog} from '@viewers/common/ui_data_log';
import {LogViewerComponentStub} from '@viewers/components/log_viewer_component_stub';

import {MockPresenter} from './mock_log_viewer_presenter';

export class MockViewer extends AbstractLogViewer<
  HierarchyTreeNode,
  UiDataLog,
  MockPresenter
> {
  constructor(trace: Trace<HierarchyTreeNode>, traces: Traces, storage: Store) {
    super(trace, traces, LogViewerComponentStub, storage);
  }

  protected override createPresenter(
    trace: Trace<HierarchyTreeNode>,
    traces: Traces,
    storage: Store,
    notifyViewCallback: NotifyLogViewCallbackType<UiDataLog>,
  ): MockPresenter {
    return new MockPresenter(trace, storage, notifyViewCallback);
  }

  getPresenter(): MockPresenter {
    return this.presenter;
  }

  override addViewerSpecificListeners(_: LogViewerComponentStub): void {
    // do nothing
  }
}

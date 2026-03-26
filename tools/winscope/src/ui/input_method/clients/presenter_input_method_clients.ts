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
import {createPersistentStoreProxy} from '@common/store/persistent_store_proxy';
import {Store} from '@common/store/store';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {AbstractPresenterInputMethod} from '@ui/input_method/abstract_presenter_input_method';
import {UpdateDisplayNames} from '@ui/input_method/clients/operations/update_display_names';
import {ImeUiData} from '@ui/input_method/ime_ui_data';
import {NotifyHierarchyViewCallbackType} from '@ui/shared/hierarchy/abstract_hierarchy_viewer_presenter';
import {HierarchyPresenter} from '@ui/shared/hierarchy/hierarchy_presenter';
import {TableProperties} from '@ui/shared/hierarchy/table_properties';
import {UpdateSfSubtreeDisplayNames} from '@ui/shared/hierarchy/update_sf_subtree_display_names';
import {VISIBLE_CHIP} from '@ui/shared/user_input/chip';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';

export class PresenterInputMethodClients extends AbstractPresenterInputMethod {
  protected override hierarchyPresenter = new HierarchyPresenter(
    createPersistentStoreProxy<UserOptions>(
      'ImeHierarchyOptions',
      {
        simplifyNames: {
          name: 'Simplify names',
          enabled: true,
        },
        showOnlyVisible: {
          name: 'Show only',
          chip: VISIBLE_CHIP,
          enabled: false,
        },
        flat: {
          name: 'Flat',
          enabled: false,
        },
      },
      this.storage,
    ),
    new TextFilter(),
    [],
    true,
    false,
    this.getHierarchyTreeNameStrategy,
    [
      [TraceType.SURFACE_FLINGER, [new UpdateSfSubtreeDisplayNames()]],
      [TraceType.INPUT_METHOD_CLIENTS, [new UpdateDisplayNames()]],
    ],
  );
  constructor(
    trace: Trace<HierarchyTreeNode>,
    traces: Traces,
    storage: Store,
    notifyViewCallback: NotifyHierarchyViewCallbackType<ImeUiData>,
  ) {
    super(trace, traces, storage, notifyViewCallback);
  }

  protected override getHierarchyTableProperties(): TableProperties {
    const client = this.hierarchyPresenter
      .getCurrentHierarchyTreesForTrace(this.imeTrace)
      ?.at(0)
      ?.getChildByName('client');
    const curId = client
      ?.getEagerPropertyByName('inputMethodManager')
      ?.getChildByName('curId')
      ?.formattedValue();
    const packageName = client
      ?.getEagerPropertyByName('editorInfo')
      ?.getChildByName('packageName')
      ?.formattedValue();
    return {
      ...new ImClientsTableProperties(curId, packageName),
    };
  }
}

class ImClientsTableProperties {
  constructor(
    public inputMethodId: string | undefined,
    public packageName: string | undefined,
  ) {}
}

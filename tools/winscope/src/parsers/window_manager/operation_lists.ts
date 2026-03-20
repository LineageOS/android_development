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

import {AddDefaults} from '@parsers/operations/add_defaults';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {TranslateIntDef} from '@parsers/operations/translate_intdef';
import {AddWindowType} from '@parsers/window_manager/operations/add_window_type';
import {HEX_FORMATTER, HEX_NO_PREFIX_FORMATTER, RECT_FORMATTER,} from '@trace/formatters';
import {Operation} from '@tree_node/operation';
import {PropertyTreeNode} from '@tree_node/property_tree_node';

import {ContainerType} from './container_type';
import {DENYLIST_PROPERTIES} from './denylist_properties';
import {TAMPERED_PROTOS_LATEST} from './tampered_protos_latest';

interface OperationLists {
  common: Array<Operation<PropertyTreeNode>>;
  eager: Array<Operation<PropertyTreeNode>>;
  lazy: Array<Operation<PropertyTreeNode>>;
}

const commonFormatters = new Map([
  ['hashCode', HEX_FORMATTER],
  ['token', HEX_NO_PREFIX_FORMATTER],
  ['containingFrame', RECT_FORMATTER],
  ['parentFrame', RECT_FORMATTER],
]);

export class WmOperationLists {
  private static commonContainerOperationsCache:
    | Array<Operation<PropertyTreeNode>>
    | undefined;
  private static wmOperationListsCache:
    | Map<ContainerType, OperationLists>
    | undefined;

  static get(key: ContainerType): OperationLists | undefined {
    return WmOperationLists.getMap().get(key);
  }

  private static getMap(): Map<ContainerType, OperationLists> {
    if (!WmOperationLists.wmOperationListsCache) {
      WmOperationLists.wmOperationListsCache = new Map<
        ContainerType,
        OperationLists
      >([
        [
          ContainerType.WindowManagerService,
          WmOperationLists.getWindowManagerService(),
        ],
        [
          ContainerType.RootWindowContainer,
          WmOperationLists.getRootWindowContainer(),
        ],
        [ContainerType.WindowContainer, WmOperationLists.getWindowContainer()],
        [ContainerType.DisplayContent, WmOperationLists.getDisplayContent()],
        [ContainerType.DisplayArea, WmOperationLists.getDisplayArea()],
        [ContainerType.Task, WmOperationLists.getTask()],
        [ContainerType.Activity, WmOperationLists.getActivity()],
        [ContainerType.WindowToken, WmOperationLists.getWindowToken()],
        [ContainerType.WindowState, WmOperationLists.getWindowState()],
        [ContainerType.TaskFragment, WmOperationLists.getTaskFragment()],
      ]);
    }
    return WmOperationLists.wmOperationListsCache;
  }

  private static getCommonContainerOperations(): Array<
    Operation<PropertyTreeNode>
  > {
    if (!WmOperationLists.commonContainerOperationsCache) {
      WmOperationLists.commonContainerOperationsCache = [
        new SetFormatters(
          TAMPERED_PROTOS_LATEST.windowContainerChildField,
          commonFormatters,
        ),
        new TranslateIntDef(TAMPERED_PROTOS_LATEST.windowContainerChildField, [
          'requestedVisibleTypes',
        ]),
      ];
    }
    return WmOperationLists.commonContainerOperationsCache;
  }

  private static getWindowManagerService(): OperationLists {
    return {
      common: [],
      eager: [],
      lazy: [
        new AddDefaults(
          TAMPERED_PROTOS_LATEST.entryField,
          undefined,
          DENYLIST_PROPERTIES,
        ),
        new SetFormatters(TAMPERED_PROTOS_LATEST.entryField, commonFormatters),
        new TranslateIntDef(TAMPERED_PROTOS_LATEST.entryField),
      ],
    };
  }

  private static getRootWindowContainer(): OperationLists {
    return {
      common: [
        new SetFormatters(
          TAMPERED_PROTOS_LATEST.rootWindowContainerField,
          commonFormatters,
        ),
        new TranslateIntDef(TAMPERED_PROTOS_LATEST.rootWindowContainerField),
      ],
      eager: [],
      lazy: [
        new AddDefaults(
          TAMPERED_PROTOS_LATEST.rootWindowContainerField,
          undefined,
          DENYLIST_PROPERTIES,
        ),
      ],
    };
  }

  private static getContainerWithDenyList(
    extraDenyList: string[],
    extraLazy: Array<Operation<PropertyTreeNode>> = [],
  ): OperationLists {
    return {
      common: WmOperationLists.getCommonContainerOperations(),
      eager: [],
      lazy: [
        new AddDefaults(
          TAMPERED_PROTOS_LATEST.windowContainerChildField,
          undefined,
          DENYLIST_PROPERTIES.concat(extraDenyList),
        ),
        ...extraLazy,
      ],
    };
  }

  private static getWindowContainer(): OperationLists {
    return WmOperationLists.getContainerWithDenyList([
      'displayContent',
      'displayArea',
      'task',
      'activity',
      'windowToken',
      'window',
      'taskFragment',
    ]);
  }

  private static getDisplayContent(): OperationLists {
    return WmOperationLists.getContainerWithDenyList([
      'windowContainer',
      'displayArea',
      'task',
      'activity',
      'windowToken',
      'window',
      'taskFragment',
    ]);
  }

  private static getDisplayArea(): OperationLists {
    return WmOperationLists.getContainerWithDenyList([
      'windowContainer',
      'displayContent',
      'task',
      'activity',
      'windowToken',
      'window',
      'taskFragment',
    ]);
  }

  private static getTask(): OperationLists {
    return WmOperationLists.getContainerWithDenyList([
      'windowContainer',
      'displayContent',
      'displayArea',
      'activity',
      'windowToken',
      'window',
      'taskFragment',
    ]);
  }

  private static getActivity(): OperationLists {
    return WmOperationLists.getContainerWithDenyList([
      'windowContainer',
      'displayContent',
      'task',
      'displayArea',
      'windowToken',
      'window',
      'taskFragment',
    ]);
  }

  private static getWindowToken(): OperationLists {
    return WmOperationLists.getContainerWithDenyList([
      'windowContainer',
      'displayContent',
      'task',
      'displayArea',
      'activity',
      'window',
      'taskFragment',
    ]);
  }

  private static getWindowState(): OperationLists {
    return WmOperationLists.getContainerWithDenyList(
      [
        'windowContainer',
        'displayContent',
        'task',
        'displayArea',
        'activity',
        'windowToken',
        'taskFragment',
      ],
      [new AddWindowType()],
    );
  }

  private static getTaskFragment(): OperationLists {
    return WmOperationLists.getContainerWithDenyList([
      'windowContainer',
      'displayContent',
      'task',
      'displayArea',
      'activity',
      'windowToken',
      'window',
    ]);
  }
}

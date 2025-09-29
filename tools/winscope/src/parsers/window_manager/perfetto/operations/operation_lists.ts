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

import {AddDefaults} from 'parsers/operations/add_defaults';
import {TranslateIntDef} from 'parsers/operations/translate_intdef';
import {DENYLIST_PROPERTIES} from 'parsers/window_manager/perfetto/denylist_properties';
import {ContainerType} from 'parsers/window_manager/perfetto/container_type';
import {
  HEX_FORMATTER,
  HEX_NO_PREFIX_FORMATTER,
  RECT_FORMATTER,
} from 'trace/formatters';
import {Operation} from 'tree_node/operation';
import {PropertyTreeNode} from 'tree_node/property_tree_node';
import {SetFormatters} from 'viewers/operations/set_formatters';
import {AddWindowType} from './add_window_type';
import {TAMPERED_PROTOS_LATEST} from 'parsers/window_manager/perfetto/tampered_protos_latest';

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

const commonContainerOperations = [
  new SetFormatters(
    TAMPERED_PROTOS_LATEST.windowContainerChildField,
    commonFormatters,
  ),
  new TranslateIntDef(TAMPERED_PROTOS_LATEST.windowContainerChildField, [
    'requestedVisibleTypes',
  ]),
];

/**
 * Creates operation lists for all proto types found in a WM trace.
 */
export const WM_OPERATION_LISTS: Map<ContainerType, OperationLists> = new Map<
  ContainerType,
  OperationLists
>([
  [
    ContainerType.WindowManagerService,
    {
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
    },
  ],

  [
    ContainerType.RootWindowContainer,
    {
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
    },
  ],

  [
    ContainerType.WindowContainer,
    {
      common: commonContainerOperations,
      eager: [],
      lazy: [
        new AddDefaults(
          TAMPERED_PROTOS_LATEST.windowContainerChildField,
          undefined,
          DENYLIST_PROPERTIES.concat([
            'displayContent',
            'displayArea',
            'task',
            'activity',
            'windowToken',
            'window',
            'taskFragment',
          ]),
        ),
      ],
    },
  ],

  [
    ContainerType.DisplayContent,
    {
      common: commonContainerOperations,
      eager: [],
      lazy: [
        new AddDefaults(
          TAMPERED_PROTOS_LATEST.windowContainerChildField,
          undefined,
          DENYLIST_PROPERTIES.concat([
            'windowContainer',
            'displayArea',
            'task',
            'activity',
            'windowToken',
            'window',
            'taskFragment',
          ]),
        ),
      ],
    },
  ],

  [
    ContainerType.DisplayArea,
    {
      common: commonContainerOperations,
      eager: [],
      lazy: [
        new AddDefaults(
          TAMPERED_PROTOS_LATEST.windowContainerChildField,
          undefined,
          DENYLIST_PROPERTIES.concat([
            'windowContainer',
            'displayContent',
            'task',
            'activity',
            'windowToken',
            'window',
            'taskFragment',
          ]),
        ),
      ],
    },
  ],

  [
    ContainerType.Task,
    {
      common: commonContainerOperations,
      eager: [],
      lazy: [
        new AddDefaults(
          TAMPERED_PROTOS_LATEST.windowContainerChildField,
          undefined,
          DENYLIST_PROPERTIES.concat([
            'windowContainer',
            'displayContent',
            'displayArea',
            'activity',
            'windowToken',
            'window',
            'taskFragment',
          ]),
        ),
      ],
    },
  ],

  [
    ContainerType.Activity,
    {
      common: commonContainerOperations,
      eager: [],
      lazy: [
        new AddDefaults(
          TAMPERED_PROTOS_LATEST.windowContainerChildField,
          undefined,
          DENYLIST_PROPERTIES.concat([
            'windowContainer',
            'displayContent',
            'task',
            'displayArea',
            'windowToken',
            'window',
            'taskFragment',
          ]),
        ),
      ],
    },
  ],

  [
    ContainerType.WindowToken,
    {
      common: commonContainerOperations,
      eager: [],
      lazy: [
        new AddDefaults(
          TAMPERED_PROTOS_LATEST.windowContainerChildField,
          undefined,
          DENYLIST_PROPERTIES.concat([
            'windowContainer',
            'displayContent',
            'task',
            'displayArea',
            'activity',
            'window',
            'taskFragment',
          ]),
        ),
      ],
    },
  ],

  [
    ContainerType.WindowState,
    {
      common: commonContainerOperations,
      eager: [],
      lazy: [
        new AddDefaults(
          TAMPERED_PROTOS_LATEST.windowContainerChildField,
          undefined,
          DENYLIST_PROPERTIES.concat([
            'windowContainer',
            'displayContent',
            'task',
            'displayArea',
            'activity',
            'windowToken',
            'taskFragment',
          ]),
        ),
        new AddWindowType(),
      ],
    },
  ],

  [
    ContainerType.TaskFragment,
    {
      common: commonContainerOperations,
      eager: [],
      lazy: [
        new AddDefaults(
          TAMPERED_PROTOS_LATEST.windowContainerChildField,
          undefined,
          DENYLIST_PROPERTIES.concat([
            'windowContainer',
            'displayContent',
            'task',
            'displayArea',
            'activity',
            'windowToken',
            'window',
          ]),
        ),
      ],
    },
  ],
]);

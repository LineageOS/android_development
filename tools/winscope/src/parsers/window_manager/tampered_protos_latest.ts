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

import {assertDefined} from '@common/assert';
import {Registry} from '@trace/proto_utils/tampered_message_type';

function getEntryField() {
  return assertDefined(
    Registry.getInstance().getWinscopeExtensionsType().fields[
      '.perfetto.protos.WinscopeExtensionsImpl.windowmanager'
    ],
  );
}

function getWindowManagerServiceField() {
  return assertDefined(getEntryField().resolve()).fields[
    'windowManagerService'
  ];
}

function getRootWindowContainerField() {
  return assertDefined(getWindowManagerServiceField().resolve()).fields[
    'rootWindowContainer'
  ];
}

function getWindowContainerField() {
  return assertDefined(getRootWindowContainerField().resolve()).fields[
    'windowContainer'
  ];
}

function getWindowContainerChildField() {
  return assertDefined(getWindowContainerField().resolve()).fields['children'];
}

export const TAMPERED_PROTOS_LATEST = {
  get entryField() {
    return getEntryField();
  },
  get rootWindowContainerField() {
    return getRootWindowContainerField();
  },
  get windowContainerChildField() {
    return getWindowContainerChildField();
  },
};

/*
 * Copyright (C) 2025 The Android Open Source Project
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
import {TamperedProtoField} from '@trace/proto_utils/tampered_message_type';

import {CHILD_DENYLIST_PROPERTIES} from './child_denylist_properties';
import {OperationLists} from './operation_lists';

export function makeOperations(
  entryField: TamperedProtoField,
  childField: TamperedProtoField,
  childEagerProperties: string[],
): OperationLists {
  return {
    entryEager: [new AddDefaults(entryField, CHILD_DENYLIST_PROPERTIES)],
    entryCommon: [new SetFormatters(entryField)],
    entryLazy: [
      new AddDefaults(
        entryField,
        undefined,
        CHILD_DENYLIST_PROPERTIES.concat([childField.name]),
      ),
    ],

    childEager: [new AddDefaults(childField, childEagerProperties)],
    childCommon: [
      new SetFormatters(childField),
      new TranslateIntDef(childField),
    ],
    childLazy: [new AddDefaults(childField, undefined, childEagerProperties)],
  };
}

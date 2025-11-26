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

import {TamperedProtoField} from './tampered_message_type';

/**
 * Determines the default value for a proto message field based on available
 * defaults and field type. Used to build property trees from TP args table
 * results, and to add default values in a post-processing step.
 * @param field proto message field.
 * @return default value for this property field.
 */
export function getDefaultValue(
  field: TamperedProtoField,
): LeafValue | undefined {
  let defaultValue = field.repeated ? [] : field.defaultValue;
  if (!field.repeated && defaultValue === null) {
    switch (field.type) {
      case 'double':
      case 'float':
      case 'int32':
      case 'uint32':
      case 'sint32':
      case 'fixed32':
      case 'sfixed32':
        defaultValue = 0;
        break;
      case 'int64':
      case 'uint64':
      case 'sint64':
      case 'fixed64':
      case 'sfixed64':
        defaultValue = 0n;
        break;
      case 'bool':
        defaultValue = false;
        break;
      default: {
        if (field.tamperedEnumType) {
          defaultValue = 0;
        }
      }
    }
  }
  return defaultValue ?? undefined;
}

export type LeafValue = string | bigint | number | boolean | unknown[];

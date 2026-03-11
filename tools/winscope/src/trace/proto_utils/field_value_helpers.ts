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
  if (
    !field.repeated &&
    (defaultValue === null || defaultValue === undefined)
  ) {
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
        const enumType = field.parent?.lookupEnum(field.type);
        if (enumType) {
          const rawValue = enumType.valuesById[0];
          defaultValue = rawValue ? stripEnumPrefix(enumType, rawValue) : 0;
        }
      }
    }
  }
  return defaultValue ?? undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stripEnumPrefix(enumType: any, value: string): string {
  const values = Object.keys(enumType.values);
  if (values.length < 2) return value;

  // Find common prefix
  let prefix = values[0];
  for (let i = 1; i < values.length; i++) {
    const s = values[i];
    while (s.indexOf(prefix) !== 0) {
      prefix = prefix.substring(0, prefix.length - 1);
      if (prefix === '') return value;
    }
  }

  // Only strip if prefix ends with _ and is not the whole value
  if (
    prefix.length > 0 &&
    prefix.endsWith('_') &&
    value.startsWith(prefix) &&
    value !== prefix
  ) {
    return value.substring(prefix.length);
  }
  return value;
}

export type LeafValue = string | bigint | number | boolean | unknown[];

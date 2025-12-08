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

import Long from 'long';
import {perfetto} from 'protos/perfetto/trace/static';

export type PerfettoTransition = perfetto.protos.IShellTransition;
type TransitionProperty = number | Long | TransitionTarget[] | null | undefined;
type TransitionTarget = perfetto.protos.ShellTransition.ITarget;

export function nullifyIfDefaultValue<T extends TransitionProperty>(
  value: T,
): T | undefined {
  if (isDefaultValue(value)) {
    return undefined;
  }
  return value;
}

function isDefaultValue(value: TransitionProperty): boolean {
  if (value instanceof Long && value.isZero()) {
    return true;
  } else if (typeof value === 'number' && value === 0) {
    return true;
  } else if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
}

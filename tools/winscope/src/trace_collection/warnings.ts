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

import {UserWarning} from '@messaging/user_warning';

/**
 * A warning for proxy tracing errors.
 */
export function makeWarningProxyTracingErrors(errorMessages: string[]) {
  return new UserWarning(
    'proxy tracing errors',
    `Trace collection errors: ${errorMessages.join(', ')}`,
  );
}

/**
 * A warning for proxy tracing warnings.
 */
export function makeWarningProxyTracingWarnings(warnings: string[]) {
  return new UserWarning(
    'proxy tracing warnings',
    `Trace collection warning: ${warnings.join(', ')}`,
  );
}

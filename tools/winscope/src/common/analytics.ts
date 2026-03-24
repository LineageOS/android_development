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

import {globalConfig} from '@compat/global_config';

/**
 * Logs an analytics event.
 *
 * A no-op unless in PROD mode.
 *
 * @param eventName The name of the event.
 * @param eventParams The event parameters.
 */
export function analyticsLogEvent(
  eventName: Gtag.EventNames | (string & {}),
  eventParams?: Gtag.ControlParams | Gtag.EventParams | Gtag.CustomParams,
) {
  if (globalConfig.isProdMode()) {
    gtag('event', eventName, eventParams);
  }
}

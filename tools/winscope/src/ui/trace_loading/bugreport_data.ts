/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {TimezoneInfo} from '@common/time/time';

/**
 * The build type of the Android device that generated the bugreport.
 */
export enum BuildType {
  /**
   * A user build of the Android device.
   */
  USER = 'user',

  /**
   * A userdebug build of the Android device.
   */
  USERDEBUG = 'userdebug',

  /**
   * An eng build of the Android device.
   */
  ENG = 'eng',
}

/**
 * Metadata extracted from a bugreport.
 */
export interface BugreportData {
  timezoneInfo?: TimezoneInfo;
  buildType?: BuildType;
  isPersistentTracingEnabled: boolean;
}

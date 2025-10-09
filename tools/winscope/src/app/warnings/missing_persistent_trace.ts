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

import {BugreportData, BuildType} from 'app/trace_file_filter';
import {UserWarning} from 'messaging/user_warning';

/**
 * A warning for a missing persistent trace.
 */
export class MissingPersistentTrace extends UserWarning {
  constructor(private bugreportData: BugreportData) {
    super();
  }

  override getDescriptor(): string {
    return 'missing persistent trace';
  }

  override getMessage(): string {
    const baseMessage = 'No Winscope Perfetto trace found in bug report.';

    if (this.bugreportData.buildType === BuildType.USER) {
      return `${baseMessage} This is expected on 'user' builds. Persistent tracing usually requires a 'userdebug' or 'eng' build, or root access.`;
    }

    if (!this.bugreportData.isPersistentTracingEnabled) {
      return `${baseMessage} The persistent tracing property ('persist.debug.perfetto.persistent') seems to be disabled. You can try enabling it via:\n'adb shell setprop persist.debug.perfetto.persistent 1 && adb reboot'\nThen, reproduce the issue and capture a new bug report.`;
    }

    // Unknown issue
    return `${baseMessage} Ensure the bugreport comes from a device where persistent tracing is enabled (e.g., dogfood devices or using 'adb shell setprop persist.debug.perfetto.persistent 1').`;
  }
}

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

import {TimeRange} from 'common/time/time';
import {TimeDuration} from 'common/time/time_duration';
import {UserWarning} from 'messaging/user_warning';

/**
 * A warning for a trace with old data.
 */
export class TraceHasOldData extends UserWarning {
  constructor(
    private readonly descriptor: string,
    private readonly timeGap?: TimeRange,
  ) {
    super();
  }

  getDescriptor(): string {
    return 'old trace';
  }

  getMessage(): string {
    const elapsedTime = this.timeGap
      ? new TimeDuration(this.timeGap.endNs - this.timeGap.startNs)
      : undefined;
    return (
      `${this.descriptor}: discarded because data is old` +
      (this.timeGap ? `er than ${elapsedTime?.format()}` : '')
    );
  }
}

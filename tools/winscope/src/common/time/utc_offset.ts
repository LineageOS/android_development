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

import {TIME_UNIT_TO_NANO} from './time_units';

/**
 * A class representing a UTC offset used to convert system timestamps to
 * local time when this information is available on traces and bugreports.
 *
 * Due to backwards compatibility, not all bugreports and traces will have
 * this information available.
 */
export class UTCOffset {
  private valueNs: bigint | undefined;

  getValueNs(): bigint | undefined {
    return this.valueNs;
  }

  format(): string {
    if (this.valueNs === undefined) {
      return 'UTC+00:00';
    }
    const valueHours = Number(this.valueNs / TIME_UNIT_TO_NANO.m) / 60;
    const valueHoursAbs = Math.abs(valueHours);
    const hh = Math.floor(valueHoursAbs);
    const mm = (valueHoursAbs - hh) * 60;
    const timeDiff = `${hh}`.padStart(2, '0') + ':' + `${mm}`.padStart(2, '0');
    return `UTC${this.valueNs < 0 ? '-' : '+'}${timeDiff}`;
  }

  initialize(valueNs: bigint) {
    if (valueNs > 14n * TIME_UNIT_TO_NANO.h) {
      throw new Error('Failed to set timezone offset greater than UTC+14:00');
    }
    if (valueNs < -12n * TIME_UNIT_TO_NANO.h) {
      throw new Error('Failed to set timezone offset greater than UTC-12:00');
    }
    this.valueNs = valueNs;
  }
}

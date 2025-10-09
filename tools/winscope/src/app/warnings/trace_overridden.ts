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

import {TraceType} from 'trace_api/trace_type';
import {UserWarning} from 'messaging/user_warning';

/**
 * A warning for a trace that has been overridden.
 */
export class TraceOverridden extends UserWarning {
  constructor(
    private readonly descriptor: string,
    private readonly overridingType?: TraceType,
  ) {
    super();
  }

  getDescriptor(): string {
    return 'trace overridden';
  }

  getMessage(): string {
    if (this.overridingType !== undefined) {
      return `${this.descriptor}: overridden by another trace of type ${
        TraceType[this.overridingType]
      }`;
    }
    return `${this.descriptor}: overridden by another trace of same type`;
  }
}

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

import {CommonModule} from '@angular/common';
import {Component, input, output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {UserOption, UserOptions} from '@ui/shared/user_input/user_options';

type LogCallback = (key: string, state: boolean, name: string) => void;

@Component({
  selector: 'user-options',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './user_options_component.ng.html',
  styleUrls: ['user_options_component.scss'],
})
export class UserOptionsComponent {
  objectKeys = Object.keys;

  userOptions = input.required<UserOptions>();
  traceType = input<TraceType>();
  logCallback = input<LogCallback>(() => {});

  readonly optionsChange = output<UserOptions>();

  getUserOptionButtonColor(option: UserOption) {
    return option.enabled ? 'primary' : undefined;
  }

  onUserOptionChange(option: UserOption) {
    option.enabled = !option.enabled;
    const traceType = this.traceType();
    const callback = this.logCallback();
    callback(
      option.name,
      option.enabled,
      traceType ? TRACE_INFO[traceType].name : 'unknown',
    );
    this.optionsChange.emit(this.userOptions());
  }
}

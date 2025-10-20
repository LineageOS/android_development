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
import {Component, ElementRef, Inject, Input} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {TRACE_INFO} from 'trace_api/trace_info';
import {TraceType} from 'trace_api/trace_type';
import {UserOption, UserOptions} from 'viewers/common/user_options';
import {userOptionStyle} from './styles/user_option.styles';

type LogCallback = (key: string, state: boolean, name: string) => void;

@Component({
  selector: 'user-options',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
      @for (option of objectKeys(userOptions); track option) {
        <button
          mat-flat-button
          [color]="getUserOptionButtonColor(userOptions[option])"
          [disabled]="userOptions[option].isUnavailable"
          [class.not-enabled]="!userOptions[option].enabled"
          class="user-option"
          [style.cursor]="'pointer'"
          (click)="onUserOptionChange(userOptions[option])">
          <span class="user-option-label" [class.with-chip]="!!userOptions[option].chip">
            <span> {{userOptions[option].name}} </span>
            @if (userOptions[option].chip) {
              <div class="user-option-chip"> {{userOptions[option].chip.short}} </div>
            }
            @if (userOptions[option].icon) {
              <mat-icon class="material-symbols-outlined"> {{userOptions[option].icon}} </mat-icon>
            }
          </span>
        </button>
      }
    `,
  styles: [userOptionStyle],
})
export class UserOptionsComponent {
  objectKeys = Object.keys;

  @Input() userOptions: UserOptions = {};
  @Input() eventType = '';
  @Input() traceType: TraceType | undefined;
  @Input() logCallback: LogCallback = () => {};

  constructor(@Inject(ElementRef) private elementRef: ElementRef) {}

  getUserOptionButtonColor(option: UserOption) {
    return option.enabled ? 'primary' : undefined;
  }

  onUserOptionChange(option: UserOption) {
    option.enabled = !option.enabled;
    this.logCallback(
      option.name,
      option.enabled,
      this.traceType ? TRACE_INFO[this.traceType].name : 'unknown',
    );
    const event = new CustomEvent(this.eventType, {
      bubbles: true,
      detail: {userOptions: this.userOptions},
    });
    this.elementRef.nativeElement.dispatchEvent(event);
  }
}

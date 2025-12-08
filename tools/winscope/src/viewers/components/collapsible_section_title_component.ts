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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';

@Component({
  selector: 'collapsible-section-title',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
      <button
        mat-icon-button
        matTooltip="Collapse"
        (click)="onCollapseButtonClick()">
        <mat-icon class="material-symbols-outlined"> left_panel_close </mat-icon>
      </button>
      <span class="mat-headline-6 section-title">{{title.toUpperCase()}}</span>
    `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: row;
      }
      :host button {
        padding-top: 12px;
      }
      .section-title {
        padding-top: 14px;
        margin-bottom: 14px;
      }
    `,
  ],
})
export class CollapsibleSectionTitleComponent {
  @Input() title: string | undefined;

  @Output() collapseButtonClicked = new EventEmitter();

  onCollapseButtonClick() {
    this.collapseButtonClicked.emit();
  }
}

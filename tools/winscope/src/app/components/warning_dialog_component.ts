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
import {Component, Inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MAT_DIALOG_DATA, MatDialogModule} from '@angular/material/dialog';

/**
 * A component for displaying a warning dialog.
 */
@Component({
  selector: 'warning-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatCheckboxModule, MatButtonModule],
  template: `
    <h2 class="warning-dialog-title" mat-dialog-title>
      <span> Warning </span>
    </h2>
    <mat-dialog-content class="warning-content">
      <p class="warning-message"> {{data.message}} </p>

      <div class="warning-actions">
        <div class="warning-action-boxes">
          @for (option of data.options; track option; let i = $index) {
            <mat-checkbox
              color="primary"
              [checked]="selectedOptions.includes(option)"
              (change)="updateSelectedOptions(option)">{{ option }}</mat-checkbox>
          }
        </div>
        <div class="warning-action-buttons">
          @for (action of data.actions; track action) {
            <button
              [mat-dialog-close]="getDialogResult(action)"
              class="not-last"
              color="primary"
              mat-stroked-button> {{ action }} </button>
          }
          <button
            [mat-dialog-close]="getDialogResult(data.closeText)"
            color="primary"
            mat-raised-button> {{ data.closeText }} </button>
        </div>
      </div>
    </mat-dialog-content>
  `,
  styles: [
    `
      .warning-dialog-title {
        display: flex;
      }
      .warning-content {
        overflow: visible;
      }
      .warning-message {
        white-space: pre-line;
        font-size: 16px;
        line-height: 16px;
      }
      .warning-actions {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: end;
        margin-top: 8px;
      }
      .warning-action-boxes {
        display: flex;
        flex-direction: column;
      }
      .warning-actions .not-last {
        margin-right: 8px;
      }
    `,
  ],
})
export class WarningDialogComponent {
  selectedOptions: string[] = [];

  constructor(@Inject(MAT_DIALOG_DATA) public data: WarningDialogData) {}

  updateSelectedOptions(clickedOption: string) {
    if (!this.selectedOptions.includes(clickedOption)) {
      if (this.data.singleSelection) {
        this.selectedOptions = [clickedOption];
      } else {
        this.selectedOptions.push(clickedOption);
      }
    } else {
      this.selectedOptions = this.selectedOptions.filter(
        (opt) => opt !== clickedOption,
      );
    }
  }

  getDialogResult(closeActionText?: string): WarningDialogResult {
    return {closeActionText, selectedOptions: this.selectedOptions};
  }
}

/**
 * Data for the warning dialog.
 */
export interface WarningDialogData {
  message: string | undefined;
  actions: string[] | undefined;
  options: string[] | undefined;
  closeText: string;
  singleSelection?: boolean;
}

/**
 * Result of the warning dialog.
 */
export interface WarningDialogResult {
  closeActionText: string | undefined;
  selectedOptions: string[];
}

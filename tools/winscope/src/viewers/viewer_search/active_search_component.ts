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

import {CommonModule, NgTemplateOutlet} from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {assertDefined} from 'common/assert';
import {KeyboardEventKey} from 'common/dom';
import {Analytics} from 'logging/analytics';

@Component({
  selector: 'active-search',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <span class="header">
      <span class="mat-body-2"> {{label}} </span>
      @if (canClear) {
        <button
          mat-button
          class="query-button end-align-button clear-button"
          color="primary"
          (click)="clearQueryClick.emit()">
          <mat-icon> delete </mat-icon>
          <span> Clear </span>
        </button>
      }
    </span>
    <mat-form-field appearance="outline" class="query-field padded-field">
      <textarea matInput [formControl]="searchQueryControl" (keydown)="onTextAreaKeydown($event)" [readonly]="runningQuery"></textarea>
      @if (searchQueryControl.invalid && searchQueryControl.value) {
        <mat-error>Enter valid SQL query.</mat-error>
      }
    </mat-form-field>

    <div class="query-actions">
      @if (runningQuery) {
        <div class="running-query-message text-no-overflow">
          <mat-icon class="material-symbols-outlined"> timer </mat-icon>
          <span class="mat-body-2 message-with-spinner">
            <span>Calculating results </span>
            <mat-spinner [diameter]="20"></mat-spinner>
          </span>
        </div>
      }
      @if (lastQueryExecutionTime) {
        <span class="query-execution-time text-no-overflow mat-body-1">
         Executed in {{lastQueryExecutionTime}}
        </span>
      }
      <button
        mat-flat-button
        class="query-button search-button"
        color="primary"
        (click)="onSearchQueryClick()"
        [disabled]="searchQueryDisabled()"> Run Search Query </button>
    </div>
    @if (executedQuery) {
      <div class="current-search">
        <span class="query">
          <span class="mat-body-2"> Last executed: </span>
          <span class="mat-body-1"> {{executedQuery}} </span>
        </span>
        @if (!lastTraceFailed) {
          <ng-container
            [ngTemplateOutlet]="saveQueryField"
            [ngTemplateOutletContext]="{query: executedQuery, control: saveQueryNameControl}"></ng-container>
        }
      </div>
    }
    @if (canAdd) {
      <button
        [disabled]="!executedQuery || lastTraceFailed"
        mat-stroked-button
        class="query-button add-button"
        color="primary"
        (click)="addQueryClick.emit()"> + Add Query </button>
    }
  `,
  styles: [
    `
      .header {
        justify-content: space-between;
        display: flex;
        align-items: center;
      }
      .query-field {
        height: fit-content;
      }
      .query-field .mat-mdc-form-field-input-control.mdc-text-field__input {
        height: 300px;
      }
      .query-button {
        min-width: fit-content;
        width: fit-content;
        line-height: 24px;
        padding: 0 10px;
        height: fit-content;
      }
      .end-align-button {
        align-self: end;
      }
      .query-actions {
        display: flex;
        flex-direction: row;
        justify-content: end;
        column-gap: 10px;
        align-items: center;
        padding-bottom: 16px;
      }
      .running-query-message {
        display: flex;
        flex-direction: row;
        align-items: center;
        color: #FF8A00;
      }
      .current-search {
        padding-bottom: 10px;
      }
      .current-search .query {
        display: flex;
        flex-direction: column;
      }
      .message-with-spinner {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    `,
  ],
})
export class ActiveSearchComponent {
  @Input() canClear = false;
  @Input() canAdd = false;
  @Input() isSearchInitialized = false;
  @Input() lastTraceFailed = false;
  @Input() executedQuery: string | undefined;
  @Input() saveQueryField: NgTemplateOutlet | undefined;
  @Input() label: string | undefined;
  @Input() lastQueryExecutionTime: string | undefined;
  @Input() saveQueryNameControl: FormControl | undefined;
  @Input() runningQuery = false;

  @Output() clearQueryClick = new EventEmitter();
  @Output() searchQueryClick = new EventEmitter<string>();
  @Output() addQueryClick = new EventEmitter();

  @ViewChild(HTMLTextAreaElement) textArea: HTMLTextAreaElement | undefined;

  searchQueryControl = new FormControl('', Validators.required);

  constructor(
    @Inject(ElementRef) readonly elementRef: ElementRef<HTMLElement>,
  ) {}

  updateText(text: string) {
    this.searchQueryControl.setValue(text);
    this.textArea?.focus();
  }

  searchQueryDisabled(): boolean {
    return (
      this.searchQueryControl.invalid ||
      this.runningQuery ||
      !this.isSearchInitialized
    );
  }

  onTextAreaKeydown(event: KeyboardEvent) {
    event.stopPropagation();
    if (
      event.key === KeyboardEventKey.ENTER &&
      event.ctrlKey &&
      !this.searchQueryDisabled()
    ) {
      event.preventDefault();
      this.onSearchQueryClick();
    }
  }

  onSearchQueryClick() {
    Analytics.TraceSearch.logQueryRequested('new');
    this.searchQueryClick.emit(assertDefined(this.searchQueryControl.value));
  }
}

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
import {assertDefined} from '@common/assert';
import {KeyboardEventKey} from '@common/dom';
import {Analytics} from '@logging/analytics';

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
  templateUrl: './active_search_component.ng.html',
  styleUrls: ['active_search_component.css'],
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

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
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatTooltipModule} from '@angular/material/tooltip';
import {assertDefined} from 'common/assert';
import {FilterFlag} from 'common/filter_flag';
import {TextFilter} from 'viewers/common/text_filter';
import {AbstractFormFieldComponent} from './abstract_form_field_component';

@Component({
  selector: 'search-box',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    @if (textFilter) {
      <mat-form-field
        [class]="getFormFieldClasses()"
        [appearance]="appearance"
        (keydown.esc)="$event.target.blur()"
        (keydown.enter)="$event.target.blur()"
        [matTooltip]="label"
        matTooltipPosition="above"
        subscriptSizing="dynamic"
        [matTooltipDisabled]="disableFormFieldTooltip(formField)" #formField>
        <mat-label>{{ label }}</mat-label>
        <input
          matInput
          [(ngModel)]="textFilter.filterString"
          (ngModelChange)="onFilterChange()"
          [name]="filterName" />
        <div class="field-suffix" matTextSuffix>
          <button
            mat-icon-button
            matTooltip="Match case"
            [color]="hasFlag(FilterFlag.MATCH_CASE) ? 'primary' : undefined"
            (click)="onFilterFlagClick($event, FilterFlag.MATCH_CASE)">
            <mat-icon class="material-symbols-outlined">match_case</mat-icon>
          </button>
          <button
            mat-icon-button
            matTooltip="Match whole word"
            [color]="hasFlag(FilterFlag.MATCH_WORD) ? 'primary' : undefined"
            (click)="onFilterFlagClick($event, FilterFlag.MATCH_WORD)">
            <mat-icon class="material-symbols-outlined">match_word</mat-icon>
          </button>
          <button
            mat-icon-button
            matTooltip="Use regex"
            [color]="hasFlag(FilterFlag.USE_REGEX) ? 'primary' : undefined"
            (click)="onFilterFlagClick($event, FilterFlag.USE_REGEX)">
            <mat-icon class="material-symbols-outlined">regular_expression</mat-icon>
          </button>
        </div>
      </mat-form-field>
    }
  `,
  styles: [
    `
    :host {
      height: 40px;
      margin-left: 8px;
      max-width: 100%;
    }
    .search-box {
      font-size: 14px;
      max-width: 100%;
    }
    .search-box .field-suffix {
      display: flex;
      flex-wrap: nowrap;
    }
    .search-box.applied-field .field-suffix {
      top: 4px;
      position: relative;
    }
    .wide-field {
      width: 100%;
    }
  `,
  ],
})
export class SearchBoxComponent extends AbstractFormFieldComponent {
  FilterFlag = FilterFlag;

  @Input() textFilter: TextFilter | undefined = new TextFilter();
  @Input() filterName = 'filter';

  @Output() readonly filterChange = new EventEmitter<TextFilter>();

  hasFlag(flag: FilterFlag): boolean {
    return assertDefined(this.textFilter).flags.includes(flag) ?? false;
  }

  onFilterFlagClick(event: MouseEvent, flag: FilterFlag) {
    event.stopPropagation();
    const filter = assertDefined(this.textFilter);
    if (this.hasFlag(flag)) {
      filter.flags = filter.flags.filter((f) => f !== flag);
    } else {
      filter.flags = filter.flags.concat(flag);
    }
    this.onFilterChange();
  }

  onFilterChange() {
    this.filterChange.emit(this.textFilter);
  }

  getFormFieldClasses(): string {
    return (
      'search-box small-icon-container ' +
      ((this.textFilter?.filterString.length ?? 0) > 0 ? 'highlighted ' : '') +
      this.formFieldClass
    );
  }
}

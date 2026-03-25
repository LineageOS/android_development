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
import {Component, computed, input, output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatTooltipModule} from '@angular/material/tooltip';
import {AbstractFormFieldComponent} from '@app/shared/user_input/abstract_form_field_component';
import {FilterFlag} from '@common/filter_flag';
import {TextFilter} from '@ui/shared/user_input/text_filter';

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
  templateUrl: './search_box_component.ng.html',
  styleUrls: ['search_box_component.scss'],
})
export class SearchBoxComponent extends AbstractFormFieldComponent {
  FilterFlag = FilterFlag;

  textFilter = input<TextFilter | undefined>();
  filterName = input<string>('filter');

  readonly currentTextFilter = computed<TextFilter>(() => {
    return this.textFilter() ?? new TextFilter();
  });

  readonly filterChange = output<TextFilter>();

  formFieldClasses() {
    return (
      'search-box small-icon-container ' +
      ((this.currentTextFilter().filterString.length ?? 0) > 0
        ? 'highlighted '
        : '') +
      this.formFieldClass()
    );
  }

  hasFlag(flag: FilterFlag): boolean {
    return this.currentTextFilter().flags.includes(flag);
  }

  onFilterFlagClick(event: MouseEvent, flag: FilterFlag) {
    event.stopPropagation();
    const filter = this.currentTextFilter();
    if (this.hasFlag(flag)) {
      filter.flags = filter.flags.filter((f) => f !== flag);
    } else {
      filter.flags = filter.flags.concat(flag);
    }
    this.onFilterChange();
  }

  onFilterChange() {
    this.filterChange.emit(this.currentTextFilter());
  }
}

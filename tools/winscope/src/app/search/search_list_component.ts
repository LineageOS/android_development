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

import {CdkMenuModule} from '@angular/cdk/menu';
import {CommonModule} from '@angular/common';
import {Component, input, TemplateRef} from '@angular/core';
import {FormControl} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {isElementOverflowing} from '@common/dom';
import {ListedSearch} from '@ui/search/ui_data';

@Component({
  selector: 'search-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    CdkMenuModule,
  ],
  templateUrl: './search_list_component.ng.html',
  styleUrls: ['search_list_component.scss'],
})
export class SearchListComponent {
  searches = input.required<ListedSearch[]>();
  listItemOptions = input.required<ListItemOption[]>();
  placeholderText = input('');
  control = input(new FormControl(''));

  searchOptionsTarget: ListedSearch | undefined;

  showTooltip(search: ListedSearch, el: HTMLElement) {
    return search.name !== search.query || isElementOverflowing(el);
  }

  getTooltip(search: ListedSearch) {
    if (search.name === search.query) return search.query;
    return search.name + ': ' + search.query;
  }

  formatTimeMs(timeMs: number) {
    const time = new Date(timeMs);
    return time.toTimeString().slice(0, 5) + '\n' + time.toLocaleDateString();
  }
}

export interface ListItemOption {
  name: string;
  icon: string;
  onClickCallback?: (search: ListedSearch) => void;
  menu?: TemplateRef<unknown>;
}

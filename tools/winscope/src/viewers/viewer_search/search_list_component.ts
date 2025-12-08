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
import {CommonModule, NgTemplateOutlet} from '@angular/common';
import {Component, Input} from '@angular/core';
import {FormControl} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {isElementOverflowing} from 'common/dom';
import {ListedSearch} from './ui_data';

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
  template: `
    @if (searches.length === 0) {
      <span class="mat-body-1">
        {{placeholderText}}
      </span>
    }
    @for (search of searches; track $index) {
      <div class="listed-search">
        <span
          #searchName
          class="mat-body-2 listed-search-name text-no-overflow"
          [matTooltipDisabled]="!showTooltip(search, searchName)"
          matTooltipPosition="right"
          [matTooltip]="getTooltip(search)"> {{search.name}} </span>
        <div class="listed-search-date-options">
          @for (opt of listItemOptions; track opt.name) {
            @if (opt.onClickCallback) {
              <button
                mat-icon-button
                class="listed-search-option icon-button-small"
                [matTooltip]="opt.name"
                [matTooltipShowDelay]="500"
                (click)="opt.onClickCallback(search)">
                <mat-icon class="material-symbols-outlined">{{opt.icon}}</mat-icon>
              </button>
            }
            @if (opt.menu) {
              <button
                mat-icon-button
                class="listed-search-option icon-button-small"
                [matTooltip]="opt.name"
                [matTooltipShowDelay]="500"
                (click)="searchOptionsTarget = search"
                [class.force-show]="searchOptionsTarget === search"
                [cdkMenuTriggerFor]="optionsMenu">
                <mat-icon class="material-symbols-outlined">{{opt.icon}}</mat-icon>
              </button>
            }

            <ng-template #optionsMenu>
              <div class="context-menu" (closed)="searchOptionsTarget = undefined" cdkMenu>
                <div class="context-menu-item-container">
                  <span class="menu-item" [cdkMenuItemDisabled]="true" cdkMenuItem>
                    <ng-container
                      [ngTemplateOutlet]="opt.menu"
                      [ngTemplateOutletContext]="{query: search.query, control}"></ng-container>
                  </span>
                </div>
              </div>
            </ng-template>
          }

          <span class="mat-body-1"> {{formatTimeMs(search.timeMs)}} </span>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .listed-search {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
      .listed-search {
        width: 100%;
        column-gap: 10px;
      }
      .listed-search:hover {
        background-color: var(--hover-element-color);
      }
      .listed-search:not(:hover) .listed-search-option:not(.force-show) {
        visibility: hidden;
      }
      .listed-search-name {
        white-space: nowrap;
      }
      .listed-search-date-options {
        display: flex;
        flex-direction: row;
        align-items: center;
        white-space: pre-line;
        text-align: right;
      }
      .listed-search-option {
        cursor: pointer;
      }
    `,
  ],
})
export class SearchListComponent {
  @Input() searches: ListedSearch[] = [];
  @Input() placeholderText = '';
  @Input() listItemOptions: ListItemOption[] = [];
  @Input() control = new FormControl('');

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
  menu?: NgTemplateOutlet;
}

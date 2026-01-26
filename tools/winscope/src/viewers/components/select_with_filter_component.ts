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
import {ScrollingModule} from '@angular/cdk/scrolling';
import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {
  MatOption,
  MatOptionModule,
  MatPseudoCheckboxModule,
} from '@angular/material/core';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {
  MatSelect,
  MatSelectChange,
  MatSelectModule,
} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {AbstractSelectComponent} from './abstract_select_component';

@Component({
  selector: 'select-with-filter',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDividerModule,
    MatTooltipModule,
    MatOptionModule,
    ScrollingModule,
    MatPseudoCheckboxModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select_with_filter_component.ng.html',
  styleUrls: ['select_with_filter_component.css'],
})
export class SelectWithFilterComponent extends AbstractSelectComponent<HTMLInputElement> {
  @Input() override label = 'Search';
  @Input() options: string[] = [];
  @Input() outerFilterWidth = '100px';
  @Input() innerFilterWidth = '100';
  @Input() flex = 'none';

  @Output() readonly selectChange = new EventEmitter<MatSelectChange>();

  filterString: string = '';
  nonHiddenOptionToIndex: number[] = [];

  private lastClickedIndex: number | undefined;

  private static readonly CHECKBOX_WIDTH = 34;
  private static readonly OPTION_PADDING_WIDTH = 32;
  private static readonly SCROLLBAR_WIDTH = 8;
  private static readonly CHAR_WIDTH = 8.5;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['options']) {
      this.updateNonHiddenOptionToIndex();
    }
  }

  onSelectChange(event: MatSelectChange) {
    this.selectChange.emit(event);
  }

  getOuterFormFieldStyle() {
    return {
      flex: this.flex,
      width: this.outerFilterWidth,
    };
  }

  getInnerFormFieldStyle() {
    return {
      flex: 'none',
      paddingTop: '2px',
      paddingLeft: '10px',
      paddingRight: '20px',
      paddingBottom: '10px',
      width: this.innerFilterWidth + 'px',
    };
  }

  onSelectOpened(select: MatSelect, filter: HTMLInputElement) {
    this.handleSelectOpened(select, filter);
    this.onFilterStringChange();
    filter.focus();
  }

  onSelectClosed() {
    this.filterString = '';
  }

  onOptClick(e: MouseEvent, i: number, select: MatSelect, option: MatOption) {
    const selectValueChanged = this.handleOptionClick({
      event: e,
      i,
      select,
      option,
      lastClickedIndex: this.lastClickedIndex,
      options: this.options,
      filterString: this.filterString,
    });
    if (selectValueChanged) {
      this.selectChange.emit(new MatSelectChange(select, select.value));
    }
    this.lastClickedIndex = i;
  }

  selectedOptions(select: MatSelect) {
    return this.options.filter((o) => select.value.includes(o));
  }

  nonHiddenOptions() {
    return this.options.filter((value: string) => {
      return !this.hideOption(value, this.filterString);
    });
  }

  hiddenOptions() {
    return this.options.filter((value) =>
      this.hideOption(value, this.filterString),
    );
  }

  getScrollMaxHeight(): string {
    return this.nonHiddenOptions().length * 48 + 24 + 'px';
  }

  getScrollWidth(): string {
    let maxOptionLength = 0;
    this.options.forEach((opt) => {
      maxOptionLength = Math.max(opt.length, maxOptionLength);
    });
    return (
      maxOptionLength * SelectWithFilterComponent.CHAR_WIDTH +
      SelectWithFilterComponent.CHECKBOX_WIDTH +
      SelectWithFilterComponent.OPTION_PADDING_WIDTH +
      SelectWithFilterComponent.SCROLLBAR_WIDTH +
      'px'
    );
  }

  onSelectedOptionClick(option: string, select: MatSelect) {
    select.value = select.value.filter((val: string) => val !== option);
    this.selectChange.emit(new MatSelectChange(select, select.value));
  }

  onFilterStringChange() {
    this.updateNonHiddenOptionToIndex();
  }

  private updateNonHiddenOptionToIndex() {
    const nonHiddenOptionToIndex: number[] = [];
    this.options.forEach((value, i) => {
      if (!this.hideOption(value, this.filterString)) {
        nonHiddenOptionToIndex.push(i);
      }
    });
    this.nonHiddenOptionToIndex = nonHiddenOptionToIndex;
  }

  protected override onKeydownCtrlA(select: MatSelect) {
    this.handleKeydownCtrlA(select, this.options, this.filterString);
    this.selectChange.emit(new MatSelectChange(select, select.value));
  }
}

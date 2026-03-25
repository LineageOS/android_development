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
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, effect, Inject, input, model, output, signal, viewChild,} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatOption, MatOptionModule, MatPseudoCheckboxModule,} from '@angular/material/core';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelect, MatSelectChange, MatSelectModule,} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {AbstractSelectComponent} from '@app/shared/user_input/abstract_select_component';

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
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select_with_filter_component.ng.html',
  styleUrls: ['select_with_filter_component.scss'],
})
export class SelectWithFilterComponent extends AbstractSelectComponent {
  options = input<string[]>([]);
  override label = input<string>('Search');
  outerFilterWidth = input<string>('100px');
  innerFilterWidth = input<string>('100');
  flex = input<string>('none');
  value = model<string[]>();

  readonly selectChange = output<MatSelectChange>();

  filterString = signal<string>('');

  readonly disabled = computed(() => {
    return this.options().length <= 1;
  });

  readonly select = viewChild.required(MatSelect);

  nonHiddenOptions = computed<string[]>(() => {
    return this.options().filter((value: string) => {
      return !this.hideOption(value, this.filterString());
    });
  });

  hiddenOptions = computed<string[]>(() => {
    return this.options().filter((value) =>
      this.hideOption(value, this.filterString()),
    );
  });

  scrollMaxHeight = computed<string>(() => {
    return this.nonHiddenOptions().length * 48 + 24 + 'px';
  });

  scrollWidth = computed<string>(() => {
    let maxOptionLength = 0;
    this.options().forEach((opt) => {
      maxOptionLength = Math.max(opt.length, maxOptionLength);
    });
    return (
      maxOptionLength * SelectWithFilterComponent.CHAR_WIDTH +
      SelectWithFilterComponent.CHECKBOX_WIDTH +
      SelectWithFilterComponent.OPTION_PADDING_WIDTH +
      SelectWithFilterComponent.SCROLLBAR_WIDTH +
      'px'
    );
  });

  outerFormFieldStyle = computed(() => {
    return {
      flex: this.flex(),
      width: this.outerFilterWidth(),
    };
  });

  innerFormFieldStyle = computed(() => {
    return {
      flex: 'none',
      paddingTop: '2px',
      paddingLeft: '10px',
      paddingRight: '20px',
      paddingBottom: '10px',
      width: this.innerFilterWidth() + 'px',
    };
  });

  nonHiddenOptionToIndex: number[] = [];

  private lastClickedIndex: number | undefined;

  private static readonly CHECKBOX_WIDTH = 34;
  private static readonly OPTION_PADDING_WIDTH = 32;
  private static readonly SCROLLBAR_WIDTH = 8;
  private static readonly CHAR_WIDTH = 8.5;

  constructor(
    @Inject(ChangeDetectorRef)
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {
    super();

    effect(() => {
      this.updateNonHiddenOptionToIndex(this.options());
    });

    effect(() => {
      const newValue = this.value();
      if (newValue !== undefined) {
        this.onSelectChange(new MatSelectChange(this.select(), newValue));
      }
    });
  }

  onSelectChange(event: MatSelectChange) {
    this.selectChange.emit(event);
  }

  onSelectOpened(filter: HTMLInputElement) {
    this.handleSelectOpened(this.select());
    this.onFilterStringChange();
    filter.focus();
  }

  onSelectClosed() {
    this.filterString.set('');
    this.changeDetectorRef.detectChanges();
  }

  onOptClick(e: MouseEvent, i: number, option: MatOption) {
    const select = this.select();
    const selectValueChanged = this.handleOptionClick({
      event: e,
      i,
      select,
      option,
      lastClickedIndex: this.lastClickedIndex,
      options: this.options(),
      filterString: this.filterString(),
    });
    if (selectValueChanged) {
      this.onSelectChange(new MatSelectChange(select, select.value));
    }
    this.lastClickedIndex = i;
  }

  selectedOptions(): string[] {
    const select = this.select();
    return this.options().filter((o) => select.value.includes(o));
  }

  onSelectedOptionClick(option: string) {
    const select = this.select();
    select.value = select.value.filter((val: string) => val !== option);
    this.onSelectChange(new MatSelectChange(select, select.value));
  }

  onFilterStringChange() {
    this.updateNonHiddenOptionToIndex(this.options());
  }

  onAllButtonClick() {
    this.onToggleAll();
  }

  private updateNonHiddenOptionToIndex(options: string[]) {
    const nonHiddenOptionToIndex: number[] = [];
    const filterString = this.filterString();
    options.forEach((value, i) => {
      if (!this.hideOption(value, filterString)) {
        nonHiddenOptionToIndex.push(i);
      }
    });
    this.nonHiddenOptionToIndex = nonHiddenOptionToIndex;
  }

  protected override onToggleAll() {
    const select = this.select();
    this.handleToggleAll(select, this.options(), this.filterString());
    this.onSelectChange(new MatSelectChange(select, select.value));
  }
}

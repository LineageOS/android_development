/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {Directive} from '@angular/core';
import {MatOption} from '@angular/material/core';
import {MatSelect} from '@angular/material/select';
import {KeyboardEventCode} from '@common/dom';

import {AbstractFormFieldComponent} from './abstract_form_field_component';

@Directive()
export abstract class AbstractSelectComponent<
  T = unknown,
> extends AbstractFormFieldComponent {
  readonly allButtonTooltip = 'You can also use CTRL+A to toggle all options';

  hideOption(option: string, filterString: string) {
    if (!filterString) {
      return false;
    }
    return !option.toLowerCase().includes(filterString.toLowerCase());
  }

  protected handleSelectOpened(select: MatSelect, context?: T) {
    const defaultHandleKeydown = select._handleKeydown.bind(select);
    select._handleKeydown = (event) => {
      if (event.code === KeyboardEventCode.A && event.ctrlKey) {
        event.preventDefault();
        event.stopPropagation();
        this.onToggleAll(select, context);
        return;
      }
      defaultHandleKeydown(event);
    };
  }

  protected handleToggleAll(
    select: MatSelect,
    options: string[],
    filterString: string,
  ) {
    const allOpts = filterString
      ? options.filter((o) => !this.hideOption(o, filterString))
      : options;
    if (allOpts.every((o) => select.value?.includes(o))) {
      this.removeValuesFromSelect(select, allOpts);
    } else {
      this.addValuesToSelect(select, allOpts);
    }
  }

  protected handleOptionClick(ctx: OptionChangeContext): boolean {
    if (
      !ctx.event.shiftKey ||
      !ctx.select.value ||
      ctx.lastClickedIndex === undefined ||
      Math.abs(ctx.i - ctx.lastClickedIndex) <= 1
    ) {
      return false;
    }

    const optionsToToggle =
      ctx.lastClickedIndex < ctx.i
        ? ctx.options.slice(ctx.lastClickedIndex, ctx.i)
        : ctx.options.slice(ctx.i + 1, ctx.lastClickedIndex + 1);

    const filteredOptions = optionsToToggle.filter(
      (o) => !this.hideOption(o, ctx.filterString),
    );

    if (ctx.option.selected) {
      this.addValuesToSelect(ctx.select, filteredOptions);
    } else {
      this.removeValuesFromSelect(ctx.select, filteredOptions);
    }

    return true;
  }

  private addValuesToSelect(select: MatSelect, opts: string[]) {
    const newValues = new Set((select.value ?? []).concat(opts));
    select.value = Array.from(newValues);
  }

  private removeValuesFromSelect(select: MatSelect, opts: string[]) {
    select.value = select.value.filter((o: string) => !opts.includes(o));
  }

  protected abstract onToggleAll(select: MatSelect, context?: T): void;
}

interface OptionChangeContext {
  event: MouseEvent;
  i: number;
  select: MatSelect;
  option: MatOption;
  lastClickedIndex: number | undefined;
  options: string[];
  filterString: string;
}

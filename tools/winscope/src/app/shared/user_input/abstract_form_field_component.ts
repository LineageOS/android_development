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

import {Directive, input} from '@angular/core';
import {MatFormField, MatFormFieldAppearance,} from '@angular/material/form-field';
import {isElementOverflowing} from '@common/dom';

@Directive()
export abstract class AbstractFormFieldComponent {
  label = input<string>('Search');
  appearance = input<MatFormFieldAppearance>('fill');
  formFieldClass = input<string>('');

  disableFormFieldTooltip(formField: MatFormField) {
    const el = formField._elementRef.nativeElement;
    const label = el.querySelector('label');
    if (label) {
      return !isElementOverflowing(label);
    }
    return true;
  }
}

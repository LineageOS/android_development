/*
 * Copyright (C) 2026 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {ElementRef} from '@angular/core';

export class ItemHeightPredictor<T> {
  protected readonly defaultRowHeight: number = 36;
  protected readonly charWidth: number = 7.5;
  protected readonly additionalRowHeight: number = 20;

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    protected readonly getRow: (index: number) => T | undefined,
  ) {}

  predict(index: number): number {
    const row = this.getRow(index);
    if (!row) {
      return this.defaultRowHeight;
    }
    return this.predictHeight(row);
  }

  protected predictHeight(_: T): number {
    return this.defaultRowHeight;
  }

  protected subItemHeight(subItem: string, rowWidth: number): number {
    const rows = Math.ceil((subItem.length * this.charWidth) / rowWidth);
    return this.defaultRowHeight + (rows - 1) * this.additionalRowHeight;
  }

  protected getElementWidth(selector: string, defaultWidth: number): number {
    const width =
      this.elementRef.nativeElement.querySelector(selector)?.clientWidth ?? 0;
    return width === 0 ? defaultWidth : width;
  }
}

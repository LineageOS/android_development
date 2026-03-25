/*
 * Copyright (C) 2023 The Android Open Source Project
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
import {ItemHeightPredictor} from '@app/shared/scroll/item_height_predictor';
import {assertString} from '@common/assert';
import {TransactionColumnType} from '@trace/transactions/transaction_column_type';
import {LogEntry} from '@ui/shared/log/ui_data_log';

export class TransactionsHeightPredictor extends ItemHeightPredictor<LogEntry> {
  constructor(
    elementRef: ElementRef<HTMLElement>,
    getRow: (index: number) => LogEntry | undefined,
  ) {
    super(elementRef, getRow);
  }

  protected override predictHeight(row: LogEntry): number {
    const flags = assertString(
      row.fields.find((f) => f.spec.columnType === TransactionColumnType.FLAGS)
        ?.value ?? '',
    ).split(/(?<=\s\|\s)/);
    const flagsColumnWidth = this.getFlagsColumnWidth();
    const charsPerRow = Math.ceil(flagsColumnWidth / this.charWidth);

    let currRowRemainder = charsPerRow;
    let additionalRows = 0;

    for (const flag of flags) {
      if (flag.length > currRowRemainder) {
        additionalRows++;
        currRowRemainder = charsPerRow;
      }
      currRowRemainder -= flag.length;
      if (currRowRemainder < 0) {
        additionalRows++;
        currRowRemainder += charsPerRow;
      }
    }

    return this.defaultRowHeight + additionalRows * this.additionalRowHeight;
  }

  private getFlagsColumnWidth(): number {
    return this.getElementWidth('.headers .flags', 350);
  }
}

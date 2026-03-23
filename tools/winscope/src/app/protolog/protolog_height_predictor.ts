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
import {ProtologColumnType} from '@trace/protolog/protolog_column_type';
import {LogEntry} from '@ui/shared/log/ui_data_log';

export class ProtologHeightPredictor extends ItemHeightPredictor<LogEntry> {
  constructor(
    elementRef: ElementRef<HTMLElement>,
    getRow: (index: number) => LogEntry | undefined,
  ) {
    super(elementRef, getRow);
  }

  override predictHeight(row: LogEntry): number {
    const text = assertString(
      row.fields.find((f) => f.spec.columnType === ProtologColumnType.MESSAGE)
        ?.value ?? '',
    );
    const sourceFile = assertString(
      row.fields.find((f) => f.spec.columnType === ProtologColumnType.LOCATION)
        ?.value ?? '',
    );
    const textHeight = this.subItemHeight(text, this.getTextColumnWidth());
    const sourceFileHeight = this.subItemHeight(
      sourceFile,
      this.getSourceFileColumnWidth(),
    );
    return Math.max(textHeight, sourceFileHeight);
  }

  private getTextColumnWidth(): number {
    return this.getElementWidth('.headers .text', 350);
  }

  private getSourceFileColumnWidth(): number {
    return this.getElementWidth('.headers .source-file', 150);
  }
}

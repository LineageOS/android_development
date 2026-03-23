/*
 * Copyright (C) 2024 The Android Open Source Project
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
import {LogEntry} from '@ui/shared/log/ui_data_log';

export class TransitionsHeightPredictor extends ItemHeightPredictor<LogEntry> {
  constructor(
    elementRef: ElementRef<HTMLElement>,
    getRow: (index: number) => LogEntry | undefined,
  ) {
    super(elementRef, getRow);
  }

  override predictHeight(entry: LogEntry): number {
    const participantsHeight = this.predictParticipantsHeight(entry);
    const timestampHeight = this.subItemHeight(
      entry.traceEntry.getTimestamp().format(),
      this.getTimestampColumnWidth(),
    );
    return Math.max(participantsHeight, timestampHeight);
  }

  private predictParticipantsHeight(entry: LogEntry) {
    const participants = assertString(entry.fields[6].value ?? '');
    const words = participants.split(/\s/);

    const participantsColumnWidth = this.getParticipantsColumnWidth();
    const charsPerRow = Math.ceil(participantsColumnWidth / this.charWidth);

    let additionalRows = 0;
    let currRowRemainder = charsPerRow;

    for (const word of words) {
      if (word === 'Windows:' || word.length > currRowRemainder) {
        additionalRows++;
        currRowRemainder = charsPerRow;
      }
      currRowRemainder -= word.length;
      if (currRowRemainder < 0) {
        additionalRows++;
        currRowRemainder += charsPerRow;
      }
    }

    return this.defaultRowHeight + additionalRows * this.additionalRowHeight;
  }

  private getParticipantsColumnWidth(): number {
    return this.getElementWidth('.headers .participants', 100);
  }

  private getTimestampColumnWidth(): number {
    return this.getElementWidth('.headers .time', 135);
  }
}

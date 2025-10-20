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

import {assertString} from 'common/assert';
import {ProtologColumnType} from 'trace/protolog/protolog_column_type';
import {ItemHeightPredictor} from 'viewers/common/item_height_predictor';
import {ProtologEntry} from 'viewers/viewer_protolog/ui_data';

export class ProtologHeightPredictor extends ItemHeightPredictor {
  protected override readonly defaultRowSize = 16;
  private readonly textCharsPerRow = 150;
  private readonly timestampCharsPerRow = 20;
  private readonly sourceFileCharsPerRow = 50;

  override predictHeight(entry: ProtologEntry): number {
    const textHeight = this.subItemHeight(
      assertString(
        entry.fields.find(
          (f) => f.spec.columnType === ProtologColumnType.MESSAGE,
        )?.value,
      ),
      this.textCharsPerRow,
    );
    const timestampHeight = this.subItemHeight(
      entry.traceEntry.getTimestamp().format(),
      this.timestampCharsPerRow,
    );
    const sourceFileHeight = this.subItemHeight(
      assertString(
        entry.fields.find(
          (f) => f.spec.columnType === ProtologColumnType.LOCATION,
        )?.value,
      ),
      this.sourceFileCharsPerRow,
    );
    return Math.max(textHeight, timestampHeight, sourceFileHeight);
  }
}

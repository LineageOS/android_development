/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {ElementRef} from '@angular/core';
import {ItemHeightPredictor} from '@app/shared/scroll/item_height_predictor';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';
import {UiTreeNode} from '@ui/shared/tree/ui_tree_node';

export abstract class TreeNodeHeightPredictor<
  T extends UiTreeNode,
> extends ItemHeightPredictor<FlattenedTreeRow<T>> {
  protected override readonly defaultRowHeight = 24;
  protected override readonly charWidth = 9;
  protected override readonly additionalRowHeight = 16;
  protected readonly nodeIconWidth = 24;
  private readonly rowPaddingWidth = 12;
  private readonly defaultRowWidth = 480;
  private getViewportWidth?: () => number | undefined;

  constructor(
    elementRef: ElementRef<HTMLElement>,
    getRow: (index: number) => FlattenedTreeRow<T> | undefined,
  ) {
    super(elementRef, getRow);
  }

  setViewportWidthCallback(callback: () => number | undefined) {
    this.getViewportWidth = callback;
  }

  protected override predictHeight(row: FlattenedTreeRow<T>): number {
    const rows = this.getRows(row);
    return this.defaultRowHeight + (rows - 1) * this.additionalRowHeight;
  }

  private getRows(nodeRow: FlattenedTreeRow<T>): number {
    const rowWidth = this.getRowWidth(nodeRow, this.getFullWidth());
    const textWidths = this.getTextWidths(nodeRow.node);
    return textWidths.reduce((rows, textWidth) => {
      return rows + Math.ceil(textWidth / rowWidth);
    }, 0);
  }

  private getFullWidth(): number {
    return this.getMaxRowWidth() - this.rowPaddingWidth;
  }

  private getMaxRowWidth(): number {
    const viewportWidth = this.getViewportWidth?.();
    return viewportWidth ?? this.defaultRowWidth;
  }

  protected abstract getRowWidth(
    row: FlattenedTreeRow<T>,
    fullWidth: number,
  ): number;
  protected abstract getTextWidths(node: T): number[];
}

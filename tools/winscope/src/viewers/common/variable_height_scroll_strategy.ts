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

import {
  CdkVirtualScrollViewport,
  VirtualScrollStrategy,
} from '@angular/cdk/scrolling';
import {assertDefined} from 'common/assert';
import {distinctUntilChanged, Observable, Subject} from 'rxjs';
import {TraceType} from 'trace_api/trace_type';
import {InputHeightPredictor} from 'viewers/viewer_input/input_height_predictor';
import {ProtologHeightPredictor} from 'viewers/viewer_protolog/protolog_height_predictor';
import {SearchHeightPredictor} from 'viewers/viewer_search/search_height_predictor';
import {TransactionsHeightPredictor} from 'viewers/viewer_transactions/transactions_height_predictor';
import {TransitionsHeightPredictor} from 'viewers/viewer_transitions/transitions_height_predictor';
import {ItemHeightPredictor} from './item_height_predictor';

export class VariableHeightScrollStrategy implements VirtualScrollStrategy {
  private scrollItems: object[] = [];
  private itemHeightPredictor: ItemHeightPredictor | undefined;
  private itemHeightCache = new Map<number, ItemHeight>(); // indexed by scrollIndex
  private wrapper: any = undefined;
  private viewport: CdkVirtualScrollViewport | undefined;
  scrolledIndexChangeSubject = new Subject<number>();
  scrolledIndexChange: Observable<number> =
    this.scrolledIndexChangeSubject.pipe(distinctUntilChanged());

  attach(viewport: CdkVirtualScrollViewport) {
    this.viewport = viewport;
    this.wrapper = viewport.getElementRef().nativeElement.childNodes[0];
    if (this.scrollItems.length > 0) {
      this.viewport.setTotalContentSize(this.getTotalItemsHeight());
      this.updateRenderedRange();
    }
  }

  detach() {
    this.scrolledIndexChangeSubject.complete();
    this.viewport = undefined;
    this.wrapper = undefined;
  }

  onDataLengthChanged() {
    if (!this.viewport) {
      return;
    }
    this.viewport.setTotalContentSize(this.getTotalItemsHeight());
    this.updateRenderedRange();
  }

  onContentScrolled(): void {
    if (this.viewport) {
      this.updateRenderedRange();
    }
  }

  onContentRendered() {
    // do nothing
  }

  onRenderedOffsetChanged() {
    // do nothing
  }

  updateItems(items: object[]) {
    this.scrollItems = items;
    if (this.viewport) {
      this.viewport.checkViewportSize();
    }
  }

  updateTraceType(value: TraceType) {
    switch (value) {
      case TraceType.TRANSACTIONS:
        this.itemHeightPredictor = new TransactionsHeightPredictor();
        break;
      case TraceType.PROTO_LOG:
        this.itemHeightPredictor = new ProtologHeightPredictor();
        break;
      case TraceType.TRANSITION:
        this.itemHeightPredictor = new TransitionsHeightPredictor();
        break;
      case TraceType.INPUT_EVENT_MERGED:
        this.itemHeightPredictor = new InputHeightPredictor();
        break;
      case TraceType.SEARCH:
        this.itemHeightPredictor = new SearchHeightPredictor();
        break;
      default:
        throw new Error(
          'unexpected trace type received - no height predictor available',
        );
    }
  }

  scrollToIndex(index: number) {
    if (!this.viewport) {
      return;
    }
    const offset = this.getOffsetByItemIndex(index);
    this.viewport.scrollToOffset(offset);
  }

  private updateRenderedRange() {
    const viewport = assertDefined(this.viewport);
    const scrollOffset = viewport.measureScrollOffset();
    const viewportHeight = viewport.getViewportSize();
    const dataLength = viewport.getDataLength();
    const {start, end} = viewport.getRenderedRange();
    const newRange = {start, end};

    const firstVisibleIndex = this.calculateIndexFromOffset(scrollOffset);
    const visibleOffset = viewportHeight + scrollOffset;
    const startBuf = scrollOffset - this.getOffsetByItemIndex(start);
    const endBuf =
      this.getOffsetByItemIndex(end > 0 ? end - 1 : 0) - visibleOffset;

    if ((startBuf <= 0 && start !== 0) || (endBuf <= 0 && end !== dataLength)) {
      newRange.start = Math.max(0, this.calculateIndexFromOffset(scrollOffset));
      newRange.end = Math.min(
        dataLength,
        this.calculateIndexFromOffset(visibleOffset) + 1,
      );
    }

    viewport.setRenderedRange(newRange);
    viewport.setRenderedContentOffset(
      this.getOffsetByItemIndex(newRange.start),
    );
    this.scrolledIndexChangeSubject.next(firstVisibleIndex);
    this.updateItemHeightCache(this.wrapper, viewport);
  }

  private updateItemHeightCache(
    wrapper: any,
    viewport: CdkVirtualScrollViewport,
  ) {
    let cacheUpdated = false;

    for (const node of wrapper.childNodes) {
      if (node && node.nodeName === 'DIV') {
        const id = Number(node.getAttribute('item-id'));
        const cachedHeight = this.itemHeightCache.get(id);

        if (
          cachedHeight?.source !== ItemHeightSource.RENDERED ||
          cachedHeight.value !== node.clientHeight
        ) {
          this.itemHeightCache.set(id, {
            value: node.clientHeight,
            source: ItemHeightSource.RENDERED,
          });
          cacheUpdated = true;
        }
      }
    }

    if (cacheUpdated) {
      viewport.setTotalContentSize(this.getTotalItemsHeight());
    }
  }

  private getTotalItemsHeight(): number {
    return this.getItemsHeight(this.scrollItems);
  }

  private getOffsetByItemIndex(index: number): number {
    return this.getItemsHeight(this.scrollItems.slice(0, index));
  }

  private getItemsHeight(items: object[]): number {
    return items
      .map((item, index) => this.getItemHeight(item, index))
      .reduce((prev, curr) => prev + curr, 0);
  }

  private calculateIndexFromOffset(offset: number): number {
    return this.calculateIndexOfFinalRenderedItem(0, offset) ?? 0;
  }

  private calculateIndexOfFinalRenderedItem(
    start: number,
    viewportHeight: number,
  ): number | undefined {
    let totalItemHeight = 0;
    for (let i = start; i < this.scrollItems.length; i++) {
      const item = this.scrollItems[i];
      totalItemHeight += this.getItemHeight(item, i);

      if (totalItemHeight >= viewportHeight) {
        return i;
      }
      if (i === this.scrollItems.length - 1) {
        return i;
      }
    }
    return undefined;
  }

  private getItemHeight(item: object, index: number): number {
    const currentHeight = this.itemHeightCache.get(index);
    if (!currentHeight) {
      const predictedHeight = this.predictScrollItemHeight(item);
      this.itemHeightCache.set(index, {
        value: predictedHeight,
        source: ItemHeightSource.PREDICTED,
      });
      return predictedHeight;
    } else {
      return currentHeight.value;
    }
  }

  // best-effort estimate of item height using hardcoded values -
  // we render more items than are in the viewport, and once rendered,
  // the item's actual height is cached and used instead of the estimate
  protected predictScrollItemHeight(entry: object): number {
    return assertDefined(this.itemHeightPredictor).predictHeight(entry);
  }
}

enum ItemHeightSource {
  PREDICTED,
  RENDERED,
}

interface ItemHeight {
  value: number;
  source: ItemHeightSource;
}

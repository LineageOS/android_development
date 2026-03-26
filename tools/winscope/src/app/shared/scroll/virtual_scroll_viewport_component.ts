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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Directive, effect, ElementRef, HostListener, Inject, InjectionToken, input, NgZone, output, ViewChild,} from '@angular/core';
import {assertDefined} from '@common/assert';
import {fromEvent, Observable, ReplaySubject, Subject} from 'rxjs';
import {debounceTime, map, takeUntil} from 'rxjs/operators';

interface VirtualScrollViewportHost {
  updateHeight(index: number, elementRef: ElementRef<HTMLElement>): void;
}

const HOST = new InjectionToken<VirtualScrollViewportHost>(
  'VirtualScrollViewportHost',
);

function nextAnimationFrame(): Promise<DOMHighResTimeStamp> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

export interface HeightPredictor {
  predict(index: number): number;
}

export interface RenderedRange {
  start: number;
  end: number;
}

@Directive({
  selector: '[virtualRow]',
  exportAs: 'virtualRow',
})
export class VirtualRow {
  constructor(
    @Inject(HOST) private readonly host: VirtualScrollViewportHost,
    private readonly elementRef: ElementRef<HTMLElement>,
  ) {}

  rowIndex = input.required<number>();

  ngAfterViewChecked() {
    this.host.updateHeight(this.rowIndex(), this.elementRef);
  }
}

@Component({
  selector: 'virtual-scroll-viewport',
  standalone: true,
  imports: [CommonModule],
  providers: [{provide: HOST, useExisting: VirtualScrollViewportComponent}],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './virtual_scroll_viewport_component.ng.html',
  styleUrls: ['virtual_scroll_viewport_component.scss'],
})
export class VirtualScrollViewportComponent {
  private readonly destroyed = new ReplaySubject<void>(1);
  private readonly resizeObserver: ResizeObserver;
  private readonly scrolled: Observable<number>;

  private anchorIndex?: number;
  private heights: number[] = [];
  private isScrolling = false;
  private targetScrollTop = 0;
  private visibleRange: RenderedRange = {start: 0, end: 0};

  itemCount = input.required<number>();
  heightPredictor = input.required<HeightPredictor>();

  readonly visibleRangeChanged = output<RenderedRange>();

  @ViewChild('contentWrapper', {static: true})
  contentWrapper: ElementRef<HTMLElement> | undefined;

  // Spacer used to set the scrolling container height such that the scrollbar
  // can be used over all contents
  @ViewChild('spacer', {static: true})
  spacer: ElementRef<HTMLElement> | undefined;

  constructor(
    readonly elementRef: ElementRef<HTMLElement>,
    private readonly ngZone: NgZone,
  ) {
    effect(() => {
      const itemCount = this.itemCount();
      const heightPredictor = this.heightPredictor();
      if (this.heights.length > itemCount) {
        this.heights.splice(itemCount);
      } else if (this.heights.length < itemCount) {
        this.heights.push(
          ...Array.from({length: itemCount - this.heights.length}, (_, i) => {
            return heightPredictor.predict(i + this.heights.length - 1);
          }),
        );
        this.updateSpacer();
      }
      this.handleChanges();
    });

    const resized = new Subject<void>();
    this.resizeObserver = new ResizeObserver(() => resized.next());
    resized.pipe(takeUntil(this.destroyed), debounceTime(1)).subscribe(() => {
      this.ngZone.run(() => {
        this.onResize();
      });
    });
    this.scrolled = this.ngZone.runOutsideAngular(() =>
      fromEvent(this.elementRef.nativeElement, 'scroll').pipe(
        map(() => this.elementRef.nativeElement.scrollTop),
      ),
    );
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
    this.resizeObserver.disconnect();
  }

  ngAfterViewInit() {
    this.resizeObserver.observe(this.elementRef.nativeElement);
    this.scrolled.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.handleChanges();
    });
    this.handleChanges();
  }

  ngAfterViewChecked() {
    this.updateSpacer();
  }

  isIndexVisible(index: number) {
    return this.visibleRange.start <= index && index < this.visibleRange.end;
  }

  async scrollToIndex(index: number) {
    await nextAnimationFrame();
    this.anchorIndex = index;
    const viewportHeight = this.elementRef.nativeElement.clientHeight;
    const scrollHeight = this.elementRef.nativeElement.scrollHeight;
    const targetItemHeight = this.heights[index];

    let targetTop = Math.floor((targetItemHeight - viewportHeight) / 2);
    for (let i = 0; i < index; i++) {
      targetTop += this.heights[i];
    }
    await this.scrollTo(
      Math.max(0, Math.min(scrollHeight - viewportHeight, targetTop)),
    );
  }

  updateHeight(index: number, elementRef: ElementRef<HTMLElement>) {
    const height = elementRef.nativeElement.offsetHeight + 1;
    const offset = height - this.heights[index];
    const heightChanged = Math.abs(this.heights[index] - height) > 5;
    this.heights[index] = height;

    if (offset !== 0) {
      const beforeVisibleAnchor =
        this.anchorIndex &&
        this.isIndexVisible(this.anchorIndex) &&
        index < this.anchorIndex;
      const notInRange = index > 0 && index <= this.visibleRange.start;
      if (beforeVisibleAnchor || notInRange) {
        this.scrollTo(this.targetScrollTop + offset);
        return;
      }
    }

    if (heightChanged) {
      this.checkViewportSize();
    }
  }

  checkViewportSize() {
    this.handleChanges();
    this.updateSpacer();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.onResize();
  }

  private handleChanges() {
    if (this.isScrolling) {
      return;
    }
    const contentWrapper = assertDefined(this.contentWrapper);
    const itemCount = this.itemCount();
    if (itemCount === 0) {
      this.scrollTo(0);
      contentWrapper.nativeElement.style.top = '0px';
      this.updateVisibleRange({start: 0, end: 0});
      return;
    }

    const top = this.elementRef.nativeElement.scrollTop;
    this.targetScrollTop = top;

    let start = 0;
    let totalHeight = 0;
    while (start < itemCount && top > totalHeight + this.heights[start]) {
      totalHeight += this.heights[start++];
    }

    contentWrapper.nativeElement.style.top = `${totalHeight}px`;
    let end = start;
    totalHeight += this.heights[end++];
    const targetTotalHeight = top + this.elementRef.nativeElement.clientHeight;
    while (end < itemCount && totalHeight < targetTotalHeight) {
      totalHeight += this.heights[end++];
    }

    this.updateVisibleRange({start, end});
  }

  private async scrollTo(top: number) {
    if (this.targetScrollTop === top) {
      return;
    }
    this.targetScrollTop = top;
    for (
      let i = 0;
      i < 3 && this.elementRef.nativeElement.scrollTop !== this.targetScrollTop;
      i++
    ) {
      this.isScrolling = true;
      this.elementRef.nativeElement.scrollTo({
        behavior: 'instant',
        top: this.targetScrollTop,
      });
      await nextAnimationFrame();
    }
    this.isScrolling = false;
    this.handleChanges();
  }

  private updateSpacer() {
    let sum = 0;
    for (let i = 0; i < this.itemCount(); i++) {
      sum += this.heights[i];
    }
    assertDefined(this.spacer).nativeElement.style.flexBasis = `${sum}px`;
  }

  private updateVisibleRange(newValue: RenderedRange) {
    if (
      newValue.start !== this.visibleRange.start ||
      newValue.end !== this.visibleRange.end
    ) {
      this.visibleRange = newValue;
      this.visibleRangeChanged.emit(this.visibleRange);
    }
  }

  private onResize() {
    const heightPredictor = this.heightPredictor();
    for (let i = 0; i < this.itemCount(); i++) {
      if (!this.isIndexVisible(i)) {
        this.heights[i] = heightPredictor.predict(i);
      }
    }
    this.updateSpacer();
    this.handleChanges();
  }
}

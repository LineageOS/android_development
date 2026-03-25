/*
 * Copyright (C) 2022 The Android Open Source Project
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

import {CdkMenuModule} from '@angular/cdk/menu';
import {CommonModule} from '@angular/common';
import {ChangeDetectorRef, Component, computed, effect, ElementRef, HostListener, Inject, input, output, signal, viewChild,} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MiniTimelineDrawer} from '@app/shared/timeline/mini-timeline/drawer/mini_timeline_drawer';
import {MiniTimelineDrawerImpl} from '@app/shared/timeline/mini-timeline/drawer/mini_timeline_drawer_impl';
import {MiniTimelineDrawerInput} from '@app/shared/timeline/mini-timeline/drawer/mini_timeline_drawer_input';
import {assertDefined} from '@common/assert';
import {KeyboardEventCode} from '@common/dom';
import {PersistentStore} from '@common/store/persistent_store';
import {TimeRange, Timestamp} from '@common/time/time';
import {Analytics} from '@logging/analytics';
import {Trace} from '@trace_api/trace';
import {TracePosition} from '@trace_api/trace_position';
import {compareByDisplayOrder} from '@trace_api/trace_type';
import {TimelineData} from '@ui/timeline/timeline_data';

import {Transformer} from './drawer/transformer';
import {SliderComponent} from './slider_component';

/**
 * A component for displaying the mini timeline view.
 */
@Component({
  selector: 'mini-timeline',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    CdkMenuModule,
    SliderComponent,
  ],
  templateUrl: './mini_timeline_component.ng.html',
  styleUrls: ['mini_timeline_component.scss'],
})
export class MiniTimelineComponent {
  private static readonly SLIDER_HORIZONTAL_STEP = 30;
  private static readonly SENSITIVITY_FACTOR = 5;

  timelineData = input.required<TimelineData>();
  currentTracePosition = input.required<TracePosition>();
  selectedTraces = input.required<Array<Trace<unknown>>>();
  store = input.required<PersistentStore>();

  initialZoom = input<TimeRange>();
  expandedTimelineScrollEvent = input<WheelEvent>();
  expandedTimelineMouseXRatio = input<number>();
  bookmarks = input<Timestamp[]>([]);

  readonly onTracePositionUpdate = output<TracePosition>();
  readonly onSeekTimestampUpdate = output<Timestamp | undefined>();
  readonly onRemoveAllBookmarks = output<void>();
  readonly onToggleBookmark = output<{
    range: TimeRange;
    rangeContainsBookmark: boolean;
  }>();
  readonly onTraceClicked = output<[Trace<unknown>, Timestamp]>();
  readonly onHoverPositionUpdate = output<HoverPositionUpdate | undefined>();

  outerWrapper = viewChild.required<ElementRef<HTMLElement>>('outerWrapper');
  miniTimelineWrapper = viewChild.required<ElementRef<HTMLElement>>(
    'miniTimelineWrapper',
  );
  canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly getTracesToShow = computed<Array<Trace<unknown>>>(() => {
    return (
      this.selectedTraces()
        .slice()
        .sort((a, b) => compareByDisplayOrder(a.type, b.type))
        .reverse() ?? []
    ); // reversed to ensure display is ordered top to bottom
  });

  readonly toggleBookmarkText = computed(() => {
    const lastRightClickTimeRange = this.lastRightClickTimeRange();
    if (!lastRightClickTimeRange) {
      return 'Add/remove bookmark';
    }

    const rangeContainsBookmark = this.bookmarks().some((bookmark) => {
      return lastRightClickTimeRange.containsTimestamp(bookmark);
    });
    if (rangeContainsBookmark) {
      return 'Remove bookmark';
    }

    return 'Add bookmark';
  });

  drawer: MiniTimelineDrawer | undefined = undefined;
  private lastMousePosX: number | undefined;
  private hoverTimestamp: Timestamp | undefined;
  private lastMoves: WheelEvent[] = [];
  private lastRightClickTimeRange = signal<TimeRange | undefined>(undefined);

  constructor(
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
  ) {
    effect(() => {
      const mouseXRatio = this.expandedTimelineMouseXRatio();
      if (!this.drawer) {
        return;
      }
      this.lastMousePosX = mouseXRatio
        ? mouseXRatio * this.drawer.getWidth()
        : undefined;
      this.updateHoverTimestamp();
      this.drawer.updateHover(
        this.lastMousePosX ? {x: this.lastMousePosX, y: 0} : undefined,
      );
    });

    effect(() => {
      const event = this.expandedTimelineScrollEvent();
      if (!event) {
        return;
      }
      const moveDirection = this.getMoveDirection(event);

      if (event.deltaY !== 0 && moveDirection === 'y') {
        this.updateZoomByScrollEvent(event);
      }

      if (event.deltaX !== 0 && moveDirection === 'x') {
        this.updateHorizontalScroll(event);
      }
    });

    effect(() => {
      this.timelineData();
      this.currentTracePosition();
      this.selectedTraces();
      this.initialZoom();
      this.bookmarks();
      this.store();
      this.drawer?.draw();
    });
  }

  ngAfterViewInit(): void {
    this.makeHiPPICanvas();

    const updateTimestampCallback = (timestamp: Timestamp) => {
      this.onSeekTimestampUpdate.emit(undefined);
      this.onTracePositionUpdate.emit(
        this.timelineData().makePositionFromActiveTrace(timestamp),
      );
    };

    const onClickCallback = (
      timestamp: Timestamp,
      trace: Trace<unknown> | undefined,
    ) => {
      if (trace) {
        this.onTraceClicked.emit([trace, timestamp]);
        this.onSeekTimestampUpdate.emit(undefined);
      } else {
        updateTimestampCallback(timestamp);
      }
    };

    this.drawer = new MiniTimelineDrawerImpl(
      this.getCanvas(),
      () => this.getMiniCanvasDrawerInput(),
      (position) => {
        this.onSeekTimestampUpdate.emit(position);
      },
      updateTimestampCallback,
      onClickCallback,
    );

    const initialZoom = this.initialZoom();
    if (initialZoom !== undefined) {
      this.onZoomChanged(initialZoom);
    } else {
      this.resetZoom();
    }
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvasRef().nativeElement;
  }

  recordClickPosition(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const timelineData = this.timelineData();

    const lastRightClickPos = {x: event.offsetX, y: event.offsetY};
    const drawer = assertDefined(this.drawer);
    const clickRange = drawer.getClickRange(lastRightClickPos);
    const zoomRange = timelineData.getZoomRange();
    const usableRange = drawer.getUsableRange();
    const transformer = new Transformer(
      zoomRange,
      usableRange,
      timelineData.getTimestampConverter(),
    );
    this.lastRightClickTimeRange.set(
      new TimeRange(
        transformer.untransform(clickRange.from),
        transformer.untransform(clickRange.to),
      ),
    );
  }

  @HostListener('window:resize', ['$event'])
  onResize(_: Event) {
    this.makeHiPPICanvas();
    this.drawer?.draw();
  }

  trackMousePos(event: MouseEvent) {
    this.lastMousePosX = event.offsetX;
    this.updateHoverTimestamp();
  }

  onMouseLeave(_: MouseEvent) {
    this.lastMousePosX = undefined;
    this.updateHoverTimestamp();
  }

  @HostListener('document:keydown', ['$event'])
  async handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.target as HTMLElement).tagName === 'INPUT') {
      return;
    }
    if (event.code === KeyboardEventCode.A) {
      this.updateSliderPosition(-MiniTimelineComponent.SLIDER_HORIZONTAL_STEP);
    }
    if (event.code === KeyboardEventCode.D) {
      this.updateSliderPosition(MiniTimelineComponent.SLIDER_HORIZONTAL_STEP);
    }

    if (
      event.code !== KeyboardEventCode.W &&
      event.code !== KeyboardEventCode.S
    ) {
      return;
    }

    const zoomTo = this.hoverTimestamp;
    const isZoomIn = event.code === KeyboardEventCode.W;
    Analytics.Navigation.logZoom('key', 'timeline', isZoomIn ? 'in' : 'out');
    if (isZoomIn) {
      this.zoomIn(zoomTo);
    } else {
      this.zoomOut(zoomTo);
    }
  }

  onZoomChanged(zoom: TimeRange) {
    const timelineData = this.timelineData();
    timelineData.setZoom(zoom);
    timelineData.setSelectionTimeRange(zoom);
    this.drawer?.draw();
    this.changeDetectorRef.detectChanges();
  }

  onSliderZoomChanged(zoom: TimeRange) {
    this.onZoomChanged(zoom);
    this.updateHoverTimestamp();
  }

  resetZoom() {
    Analytics.Navigation.logZoom('reset', 'timeline');
    this.onZoomChanged(
      this.initialZoom() ?? this.timelineData().getFullTimeRange(),
    );
  }

  onZoomInButtonClick() {
    Analytics.Navigation.logZoom('button', 'timeline', 'in');
    this.zoomIn();
  }

  onZoomOutButtonClick() {
    Analytics.Navigation.logZoom('button', 'timeline', 'out');
    this.zoomOut();
  }

  @HostListener('wheel', ['$event'])
  onScroll(event: WheelEvent) {
    if ((event.target as HTMLElement)?.id !== 'mini-timeline-canvas') {
      return;
    }
    event.preventDefault();

    const moveDirection = this.getMoveDirection(event);
    if (event.deltaY !== 0 && moveDirection === 'y') {
      this.updateZoomByScrollEvent(event);
    }
    if (event.deltaX !== 0 && moveDirection === 'x') {
      this.updateHorizontalScroll(event);
    }
  }

  toggleBookmark() {
    const lastRightClickTimeRange = this.lastRightClickTimeRange();
    if (!lastRightClickTimeRange) {
      return;
    }
    this.onToggleBookmark.emit({
      range: lastRightClickTimeRange,
      rangeContainsBookmark: this.bookmarks().some((bookmark) => {
        return lastRightClickTimeRange.containsTimestamp(bookmark);
      }),
    });
  }

  removeAllBookmarks() {
    this.onRemoveAllBookmarks.emit();
  }

  private getMiniCanvasDrawerInput() {
    const timelineData = this.timelineData();
    return new MiniTimelineDrawerInput(
      timelineData.getFullTimeRange(),
      this.currentTracePosition().timestamp,
      timelineData.getSelectionTimeRange(),
      timelineData.getZoomRange(),
      this.getTracesToShow(),
      timelineData,
      this.bookmarks(),
      this.store().get('dark-mode') === 'true',
    );
  }

  private makeHiPPICanvas() {
    // Reset any size before computing new size to avoid it interfering with size computations
    const canvas = this.getCanvas();
    canvas.width = 0;
    canvas.height = 0;
    canvas.style.width = 'auto';
    canvas.style.height = 'auto';

    const miniTimelineWrapper = this.miniTimelineWrapper();
    const width = miniTimelineWrapper.nativeElement.clientWidth;
    const height = miniTimelineWrapper.nativeElement.clientHeight;

    const HiPPIwidth = window.devicePixelRatio * width;
    const HiPPIheight = window.devicePixelRatio * height;

    canvas.width = HiPPIwidth;
    canvas.height = HiPPIheight;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    // ensure all drawing operations are scaled
    if (window.devicePixelRatio !== 1) {
      const context = canvas.getContext('2d')!;
      context.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
  }

  // -1 for x direction, 1 for y direction
  private getMoveDirection(event: WheelEvent): string {
    this.lastMoves.push(event);
    setTimeout(() => this.lastMoves.shift(), 1000);

    const xMoveAmount = this.lastMoves.reduce(
      (accumulator, it) => accumulator + it.deltaX,
      0,
    );
    const yMoveAmount = this.lastMoves.reduce(
      (accumulator, it) => accumulator + it.deltaY,
      0,
    );

    if (Math.abs(yMoveAmount) > Math.abs(xMoveAmount)) {
      return 'y';
    } else {
      return 'x';
    }
  }

  private updateZoomByScrollEvent(event: WheelEvent) {
    if (!this.hoverTimestamp) {
      const canvas = event.target as HTMLCanvasElement;
      const drawer = assertDefined(this.drawer);
      this.lastMousePosX =
        (drawer.getWidth() * event.offsetX) / canvas.offsetWidth;
      this.updateHoverTimestamp();
    }
    const isZoomIn = event.deltaY < 0;
    Analytics.Navigation.logZoom('scroll', 'timeline', isZoomIn ? 'in' : 'out');
    if (isZoomIn) {
      this.zoomIn(this.hoverTimestamp);
    } else {
      this.zoomOut(this.hoverTimestamp);
    }
  }

  private updateHorizontalScroll(event: WheelEvent) {
    const scrollAmount =
      event.deltaX / MiniTimelineComponent.SENSITIVITY_FACTOR;
    this.updateSliderPosition(scrollAmount);
  }

  private updateSliderPosition(step: number) {
    const timelineData = this.timelineData();
    const fullRange = timelineData.getFullTimeRange();
    const zoomRange = timelineData.getZoomRange();

    const usableRange = assertDefined(this.drawer).getUsableRange();
    const transformer = new Transformer(
      zoomRange,
      usableRange,
      timelineData.getTimestampConverter(),
    );
    const shiftAmount = transformer
      .untransform(usableRange.from + step)
      .minus(zoomRange.startNs);

    let newFrom = zoomRange.from.add(shiftAmount);
    let newTo = zoomRange.to.add(shiftAmount);

    if (newFrom.getValueNs() < fullRange.startNs) {
      newTo = newTo.add(fullRange.from.minus(newFrom));
      newFrom = fullRange.from;
    }

    if (newTo.getValueNs() > fullRange.endNs) {
      newFrom = newFrom.minus(newTo.minus(fullRange.to));
      newTo = fullRange.to;
    }

    this.onZoomChanged(new TimeRange(newFrom, newTo));
    this.updateHoverTimestamp();
  }

  private zoomIn(zoomOn?: Timestamp) {
    this.zoom({nominator: 6n, denominator: 7n}, zoomOn);
  }

  private zoomOut(zoomOn?: Timestamp) {
    this.zoom({nominator: 8n, denominator: 7n}, zoomOn);
  }

  private zoom(
    zoomRatio: {nominator: bigint; denominator: bigint},
    zoomOn?: Timestamp,
  ) {
    const timelineData = this.timelineData();
    const fullRange = timelineData.getFullTimeRange();
    const currentZoomRange = timelineData.getZoomRange();
    const currentZoomWidth = currentZoomRange.to.minus(currentZoomRange.from);
    const zoomToWidth = currentZoomWidth
      .times(zoomRatio.nominator)
      .div(zoomRatio.denominator);

    const cursorPosition = this.currentTracePosition().timestamp;
    const currentMiddle = currentZoomRange.from
      .add(currentZoomRange.to)
      .div(2n);

    let newFrom: Timestamp;
    let newTo: Timestamp;

    let zoomTowards = currentMiddle;
    if (zoomOn === undefined) {
      if (cursorPosition !== undefined && cursorPosition.in(currentZoomRange)) {
        zoomTowards = cursorPosition;
      }
    } else if (zoomOn.in(currentZoomRange)) {
      zoomTowards = zoomOn;
    }

    newFrom = zoomTowards.minus(
      zoomToWidth
        .times(zoomTowards.minus(currentZoomRange.from).getValueNs())
        .div(currentZoomWidth.getValueNs()),
    );

    newTo = zoomTowards.add(
      zoomToWidth
        .times(currentZoomRange.to.minus(zoomTowards).getValueNs())
        .div(currentZoomWidth.getValueNs()),
    );

    if (newFrom.getValueNs() < fullRange.startNs) {
      newTo = Timestamp.min(fullRange.to, newFrom.add(zoomToWidth));
      newFrom = fullRange.from;
    }

    if (newTo.getValueNs() > fullRange.endNs) {
      newFrom = Timestamp.max(fullRange.from, fullRange.to.minus(zoomToWidth));
      newTo = fullRange.to;
    }

    this.onZoomChanged(new TimeRange(newFrom, newTo));
  }

  private updateHoverTimestamp() {
    if (!this.lastMousePosX) {
      this.hoverTimestamp = undefined;
      this.onHoverPositionUpdate.emit(undefined);
      return;
    }
    const timelineData = this.timelineData();
    this.hoverTimestamp = new Transformer(
      timelineData.getZoomRange(),
      assertDefined(this.drawer).getUsableRange(),
      timelineData.getTimestampConverter(),
    ).untransform(this.lastMousePosX);
    const miniTimelineWrapper = this.miniTimelineWrapper();
    const posX =
      (miniTimelineWrapper.nativeElement.offsetLeft ?? 0) + this.lastMousePosX;
    this.onHoverPositionUpdate.emit({
      posX,
      xRatio:
        this.lastMousePosX /
        (miniTimelineWrapper.nativeElement.clientWidth ?? this.lastMousePosX),
      ts: this.hoverTimestamp,
    });
  }
}

export interface HoverPositionUpdate {
  posX: number;
  xRatio: number;
  ts: Timestamp;
}

/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {DragDropModule} from '@angular/cdk/drag-drop';
import {CdkMenuModule} from '@angular/cdk/menu';
import {ChangeDetectionStrategy} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule, NoopAnimationsModule,} from '@angular/platform-browser/animations';
import {assertDefined} from '@common/assert';
import {KeyboardEventCode} from '@common/dom';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeConverterZeroRteOffsets} from '@common/time/testing/test_helpers';
import {TimeRange, Timestamp} from '@common/time/time';
import {TracesBuilder} from '@trace_api/testing/traces_builder';
import {TracePosition} from '@trace_api/trace_position';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {TimelineData} from '@ui/timeline/timeline_data';

import {Transformer} from './drawer/transformer';
import {MiniTimelineComponent} from './mini_timeline_component';
import {SliderComponent} from './slider_component';

describe('MiniTimelineComponent', () => {
  let component: MiniTimelineComponent;
  let dom: DOMTestHelper<MiniTimelineComponent>;
  let timelineData: TimelineData;

  const resetButtonSelector = 'button#reset-zoom-btn';
  const zoomInSelector = '#zoom-in-btn';
  const zoomOutSelector = '#zoom-out-btn';
  const zoomControlSelector = '.zoom-control';

  const converter = makeConverterZeroRteOffsets();

  const timestamp10 = converter.makeTimestampFromRealNs(10n);
  const timestamp15 = converter.makeTimestampFromRealNs(15n);
  const timestamp16 = converter.makeTimestampFromRealNs(16n);
  const timestamp20 = converter.makeTimestampFromRealNs(20n);
  const timestamp700 = converter.makeTimestampFromRealNs(700n);
  const timestamp810 = converter.makeTimestampFromRealNs(810n);
  const timestamp1000 = converter.makeTimestampFromRealNs(10000000n);
  const timestamp1750 = converter.makeTimestampFromRealNs(17500000n);
  const timestamp2000 = converter.makeTimestampFromRealNs(20000000n);
  const timestamp3000 = converter.makeTimestampFromRealNs(30000000n);
  const timestamp4000 = converter.makeTimestampFromRealNs(40000000n);

  const position800 = TracePosition.fromTimestamp(
    converter.makeTimestampFromRealNs(800n),
  );

  const traces = new TracesBuilder()
    .setTimestamps(TraceType.SURFACE_FLINGER, [timestamp10])
    .setTimestamps(TraceType.TRANSACTIONS, [timestamp10, timestamp20])
    .setTimestamps(TraceType.WINDOW_MANAGER, [timestamp20])
    .build();
  const traceSf = assertDefined(traces.getTrace(TraceType.SURFACE_FLINGER));
  const traceWm = assertDefined(traces.getTrace(TraceType.WINDOW_MANAGER));
  const traceTransactions = assertDefined(
    traces.getTrace(TraceType.TRANSACTIONS),
  );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        FormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule,
        MatSelectModule,
        MatTooltipModule,
        ReactiveFormsModule,
        BrowserAnimationsModule,
        DragDropModule,
        CdkMenuModule,
        MiniTimelineComponent,
        SliderComponent,
        MiniTimelineComponent,
      ],
    })
      .overrideComponent(MiniTimelineComponent, {
        set: {changeDetection: ChangeDetectionStrategy.Default},
      })
      .compileComponents();
    const fixture = TestBed.createComponent(MiniTimelineComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);

    timelineData = await createAndInitializeTimelineData(traces);
    dom.setComponentInput('timelineData', timelineData);
    dom.setComponentInput(
      'currentTracePosition',
      timelineData.getCurrentPosition(),
    );
    dom.setComponentInput('selectedTraces', [traceSf]);
    dom.setComponentInput('store', new InMemoryStorage());
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('redraws on resize', () => {
    dom.detectChanges();
    const spy = spyOn(assertDefined(component.drawer), 'draw');
    expect(spy).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('resize'));
    dom.detectChanges();

    expect(spy).toHaveBeenCalled();
  });

  it('resets zoom to full time range on reset button click if initial zoom unavailable', () => {
    const expectedZoomRange = new TimeRange(timestamp15, timestamp16);
    timelineData.setZoom(expectedZoomRange);
    const fullRange = timelineData.getFullTimeRange();
    const zoomRange = timelineData.getZoomRange();
    expect(zoomRange).toEqual(expectedZoomRange);
    expect(zoomRange).not.toEqual(fullRange);
    dom.detectChanges();
    dom.findAndClick(resetButtonSelector);
    expect(timelineData.getZoomRange()).toEqual(fullRange);
  });

  it('resets zoom to initial zoom on reset button click if available', () => {
    const initialZoom = new TimeRange(timestamp15, timestamp16);
    dom.setComponentInput('initialZoom', initialZoom);
    dom.detectChanges();
    expect(timelineData.getZoomRange()).toEqual(initialZoom);

    const newZoom = new TimeRange(timestamp10, timestamp16);
    timelineData.setZoom(newZoom);
    expect(timelineData.getZoomRange()).toEqual(newZoom);
    dom.detectChanges();

    dom.findAndClick(resetButtonSelector);
    expect(timelineData.getZoomRange()).toEqual(initialZoom);
    expect(timelineData.getFullTimeRange()).not.toEqual(initialZoom);
  });

  it('show zoom controls when zoomed out', () => {
    const zoomControlDiv = dom.get(zoomControlSelector).getHTMLElement();
    expect(window.getComputedStyle(zoomControlDiv).visibility).toEqual(
      'visible',
    );
    const zoomButton = dom.get(resetButtonSelector).getHTMLElement();
    expect(window.getComputedStyle(zoomButton).visibility).toBe('visible');
  });

  it('shows zoom controls when zoomed in', () => {
    const zoom = new TimeRange(timestamp15, timestamp16);
    timelineData.setZoom(zoom);
    dom.detectChanges();

    const zoomControlDiv = dom.get(zoomControlSelector).getHTMLElement();
    expect(window.getComputedStyle(zoomControlDiv).visibility).toEqual(
      'visible',
    );
    const zoomButton = dom.get(resetButtonSelector).getHTMLElement();
    expect(window.getComputedStyle(zoomButton).visibility).toBe('visible');
  });

  it('loads with initial zoom', () => {
    const initialZoom = new TimeRange(timestamp15, timestamp16);
    dom.setComponentInput('initialZoom', initialZoom);
    dom.detectChanges();
    const timelineData = component.timelineData();
    const zoomRange = timelineData.getZoomRange();
    expect(zoomRange.from).toEqual(initialZoom.from);
    expect(zoomRange.to).toEqual(initialZoom.to);
  });

  it('updates timelineData on zoom changed', () => {
    dom.detectChanges();
    const zoom = new TimeRange(timestamp15, timestamp16);
    component.onZoomChanged(zoom);
    dom.detectChanges();
    expect(timelineData.getZoomRange()).toBe(zoom);
  });

  it('creates an appropriately sized canvas', () => {
    dom.detectChanges();
    const canvas = component.getCanvas();
    expect(canvas.width).toBeGreaterThan(100);
    expect(canvas.height).toBeGreaterThan(10);
  });

  it('getTracesToShow returns traces targeted by selectedTraces', () => {
    dom.detectChanges();
    const selectedTraces = component.selectedTraces();
    const selectedTracesTypes = selectedTraces.map((trace) => trace.type);

    const tracesToShow = component.getTracesToShow();
    const tracesToShowTypes = tracesToShow.map((trace) => trace.type);

    expect(new Set(tracesToShowTypes)).toEqual(new Set(selectedTracesTypes));
  });

  it('getTracesToShow adds traces in correct order', () => {
    dom.setComponentInput('selectedTraces', [
      traceWm,
      traceSf,
      traceTransactions,
    ]);
    dom.detectChanges();
    const tracesToShowTypes = component
      .getTracesToShow()
      .map((trace) => trace.type);
    expect(tracesToShowTypes).toEqual([
      TraceType.TRANSACTIONS,
      TraceType.WINDOW_MANAGER,
      TraceType.SURFACE_FLINGER,
    ]);
  });

  it('updates zoom when slider moved', () => {
    dom.detectChanges();
    const initialZoom = new TimeRange(timestamp15, timestamp16);
    component.onZoomChanged(initialZoom);
    dom.detectChanges();

    const slider = dom.get('.slider .handle');
    const sliderEl = slider.getHTMLElement();
    expect(window.getComputedStyle(sliderEl).visibility).toBe('visible');

    slider.dragElement(100, 8);
    const finalZoom = timelineData.getZoomRange();
    expect(finalZoom).not.toBe(initialZoom);
  });

  it('zooms in/out with buttons', async () => {
    await initializeTraces();

    const initialZoom = new TimeRange(timestamp700, timestamp810);
    component.onZoomChanged(initialZoom);
    dom.setComponentInput('currentTracePosition', position800);
    dom.detectChanges();

    dom.findAndClick(zoomInSelector);
    const zoomedIn = timelineData.getZoomRange();
    checkZoomDifference(initialZoom, zoomedIn);

    dom.findAndClick(zoomOutSelector);
    const zoomedOut = timelineData.getZoomRange();
    checkZoomDifference(zoomedOut, zoomedIn);
  });

  it('cannot zoom out past full range', async () => {
    await initializeTraces();

    const initialZoom = new TimeRange(timestamp10, timestamp1000);
    component.onZoomChanged(initialZoom);

    timelineData.setPosition(position800);
    dom.detectChanges();

    dom.findAndClick(zoomOutSelector);
    let finalZoom = timelineData.getZoomRange();
    expect(finalZoom.startNs).toEqual(initialZoom.startNs);
    expect(finalZoom.endNs).toEqual(initialZoom.endNs);

    setCanvasZeroXOffset();
    zoomOutByScrollWheel();
    finalZoom = timelineData.getZoomRange();
    expect(finalZoom.startNs).toEqual(initialZoom.startNs);
    expect(finalZoom.endNs).toEqual(initialZoom.endNs);
  });

  it('zooms in/out with scroll wheel', async () => {
    await initializeTraces();
    let initialZoom = new TimeRange(timestamp10, timestamp1000);
    component.onZoomChanged(initialZoom);
    dom.detectChanges();
    setCanvasZeroXOffset();

    for (let i = 0; i < 10; i++) {
      zoomInByScrollWheel();
      const finalZoom = timelineData.getZoomRange();
      checkZoomDifference(initialZoom, finalZoom);
      initialZoom = finalZoom;
    }

    for (let i = 0; i < 9; i++) {
      zoomOutByScrollWheel();
      const finalZoom = timelineData.getZoomRange();
      checkZoomDifference(finalZoom, initialZoom);
      initialZoom = finalZoom;
    }
  });

  it('applies expanded timeline scroll wheel event', async () => {
    await initializeTraces();

    const initialZoom = new TimeRange(timestamp10, timestamp1000);
    component.onZoomChanged(initialZoom);
    dom.detectChanges();

    dom.setComponentInput('expandedTimelineScrollEvent', {
      deltaY: -200,
      deltaX: 0,
      x: 10, // scrolling on pos
      target: component.getCanvas(),
    } as unknown as WheelEvent);
    dom.detectChanges();

    const finalZoom = timelineData.getZoomRange();
    checkZoomDifference(initialZoom, finalZoom);
  });

  it('opens context menu', () => {
    dom.detectChanges();
    expect(dom.findInDocument('.context-menu')).toBeUndefined();

    openContextMenu(component);
    const options = getContextMenuItems();
    expect(options.length).toBe(2);
  });

  it('adds bookmark', () => {
    dom.detectChanges();
    spyOnProperty(component.getCanvas(), 'width').and.returnValue(1732);
    const spy = spyOn(component.onToggleBookmark, 'emit');

    openContextMenu(component);
    const options = getContextMenuItems();
    options[0].checkText('Add bookmark');

    options[0].click();
    expect(spy).toHaveBeenCalledWith({
      range: new TimeRange(timestamp10, timestamp10),
      rangeContainsBookmark: false,
    });
  });

  it('removes bookmark', () => {
    dom.setComponentInput('bookmarks', [timestamp10]);
    dom.detectChanges();
    spyOnProperty(component.getCanvas(), 'width').and.returnValue(1732);
    const spy = spyOn(component.onToggleBookmark, 'emit');

    openContextMenu(component);
    const options = getContextMenuItems();
    options[0].checkText('Remove bookmark');
    options[0].click();
    expect(spy).toHaveBeenCalledWith({
      range: new TimeRange(timestamp10, timestamp10),
      rangeContainsBookmark: true,
    });
  });

  it('removes all bookmarks', () => {
    dom.setComponentInput('bookmarks', [timestamp10, timestamp1000]);
    dom.detectChanges();
    const spy = spyOn(component.onRemoveAllBookmarks, 'emit');

    openContextMenu(component);
    const options = getContextMenuItems();
    options[1].checkText('Remove all bookmarks');

    options[1].click();
    expect(spy).toHaveBeenCalled();
  });

  it('zooms in/out on KeyW/KeyS press', async () => {
    await initializeTracesForWASDZoom();

    const initialZoom = new TimeRange(timestamp1000, timestamp2000);
    dom.setComponentInput('initialZoom', initialZoom);
    dom.detectChanges();

    zoomInByKeyW();
    const zoomedIn = timelineData.getZoomRange();
    checkZoomDifference(initialZoom, zoomedIn);

    zoomOutByKeyS();
    const zoomedOut = timelineData.getZoomRange();
    checkZoomDifference(zoomedOut, zoomedIn);
  });

  it('moves right/left on KeyD/KeyA press', async () => {
    await initializeTracesForWASDZoom();

    const initialZoom = new TimeRange(timestamp1000, timestamp2000);
    dom.setComponentInput('initialZoom', initialZoom);
    dom.detectChanges();

    while (timelineData.getZoomRange().to !== timestamp4000) {
      dom.dispatchEventInDocument(
        new KeyboardEvent('keydown', {code: KeyboardEventCode.D}),
      );
      const zoomRange = timelineData.getZoomRange();
      const increase = zoomRange.startNs - initialZoom.startNs;
      expect(increase).toBeGreaterThan(0);
      expect(zoomRange.endNs).toEqual(initialZoom.endNs + increase);
    }

    // cannot move past end of trace
    const finalZoom = timelineData.getZoomRange();
    dom.dispatchEventInDocument(
      new KeyboardEvent('keydown', {code: KeyboardEventCode.D}),
    );
    expect(timelineData.getZoomRange()).toEqual(finalZoom);

    while (timelineData.getZoomRange().from !== timestamp1000) {
      dom.dispatchEventInDocument(
        new KeyboardEvent('keydown', {code: KeyboardEventCode.A}),
      );
      const zoomRange = timelineData.getZoomRange();
      const decrease = finalZoom.startNs - zoomRange.startNs;
      expect(decrease).toBeGreaterThan(0);
      expect(zoomRange.endNs).toEqual(finalZoom.endNs - decrease);
    }

    // cannot move before start of trace
    dom.dispatchEventInDocument(
      new KeyboardEvent('keydown', {code: KeyboardEventCode.A}),
    );
    expect(timelineData.getZoomRange()).toEqual(initialZoom);
  });

  it('zooms in/out on mouse position if within current range', async () => {
    await initializeTracesForWASDZoom();
    const initialZoom = new TimeRange(timestamp1000, timestamp4000);
    dom.setComponentInput('initialZoom', initialZoom);
    dom.setComponentInput(
      'currentTracePosition',
      TracePosition.fromTimestamp(timestamp2000),
    );
    // fix width to timeline regardless of browser window size, so that test
    // timestamps are correctly calibrated for usable range
    dom.get('#mini-timeline-wrapper').getHTMLElement().style.minWidth =
      '1000px';
    dom.get('#mini-timeline-wrapper').getHTMLElement().style.maxWidth =
      '1000px';
    dom.detectChanges();
    const drawer = assertDefined(component.drawer);
    const usableRange = drawer.getUsableRange();
    dispatchMouseMoveToCanvas(
      (usableRange.to - usableRange.from) * 0.25 + drawer.getPadding().left,
    );

    const fullRangeQuarterTimestamp = timestamp1750;
    checkZoomOnTimestamp(
      fullRangeQuarterTimestamp,
      1n,
      4n,
      zoomInByKeyW,
      zoomOutByKeyS,
    );

    setCanvasZeroXOffset();
    checkZoomOnTimestamp(
      fullRangeQuarterTimestamp,
      1n,
      4n,
      zoomInByScrollWheel,
      zoomOutByScrollWheel,
    );
  });

  it('zooms in/out on current position if within current range and mouse position not available', async () => {
    await initializeTracesForWASDZoom();
    const initialZoom = new TimeRange(timestamp1000, timestamp4000);
    dom.setComponentInput('initialZoom', initialZoom);
    dom.setComponentInput(
      'currentTracePosition',
      TracePosition.fromTimestamp(timestamp1750),
    );
    dom.detectChanges();

    const fullRangeQuarterTimestamp = timestamp1750;
    checkZoomOnTimestamp(
      fullRangeQuarterTimestamp,
      1n,
      4n,
      zoomInByKeyW,
      zoomOutByKeyS,
    );

    const zoomInButton = dom.get(zoomInSelector);
    const zoomOutButton = dom.get(zoomOutSelector);
    checkZoomOnTimestamp(
      fullRangeQuarterTimestamp,
      1n,
      4n,
      () => {
        zoomInButton.click();
      },
      () => {
        zoomOutButton.click();
      },
    );
  });

  it('zooms in/out on current position after mouse leaves canvas', async () => {
    await initializeTracesForWASDZoom();
    const initialZoom = new TimeRange(timestamp1000, timestamp4000);
    dom.setComponentInput('initialZoom', initialZoom);
    dom.setComponentInput(
      'currentTracePosition',
      TracePosition.fromTimestamp(timestamp1750),
    );
    dom.detectChanges();

    const drawer = assertDefined(component.drawer);
    const usableRange = drawer.getUsableRange();
    dispatchMouseMoveToCanvas((usableRange.to - usableRange.from) * 0.5);
    dispatchMouseLeaveToCanvas();

    const fullRangeQuarterTimestamp = timestamp1750;
    checkZoomOnTimestamp(
      fullRangeQuarterTimestamp,
      1n,
      4n,
      zoomInByKeyW,
      zoomOutByKeyS,
    );

    const zoomInButton = dom.get(zoomInSelector);
    const zoomOutButton = dom.get(zoomOutSelector);
    checkZoomOnTimestamp(
      fullRangeQuarterTimestamp,
      1n,
      4n,
      () => {
        zoomInButton.click();
      },
      () => {
        zoomOutButton.click();
      },
    );
  });

  it('zooms in/out on middle of slider bar if current position out of range and mouse position not available', async () => {
    await initializeTracesForWASDZoom();
    const initialZoom = new TimeRange(timestamp2000, timestamp4000);
    dom.setComponentInput('initialZoom', initialZoom);
    dom.setComponentInput(
      'currentTracePosition',
      TracePosition.fromTimestamp(timestamp1750),
    );
    dom.detectChanges();

    const fullRangeMiddleTimestamp = timestamp3000;
    checkZoomOnTimestamp(
      fullRangeMiddleTimestamp,
      1n,
      2n,
      zoomInByKeyW,
      zoomOutByKeyS,
    );

    setCanvasZeroXOffset();
    checkZoomOnTimestamp(
      fullRangeMiddleTimestamp,
      1n,
      2n,
      zoomInByScrollWheel,
      zoomOutByScrollWheel,
    );

    const zoomInButton = dom.get(zoomInSelector);
    const zoomOutButton = dom.get(zoomOutSelector);
    checkZoomOnTimestamp(
      fullRangeMiddleTimestamp,
      1n,
      2n,
      () => {
        zoomInButton.click();
      },
      () => {
        zoomOutButton.click();
      },
    );
  });

  it('zooms in/out on mouse position from expanded timeline', async () => {
    await initializeTracesForWASDZoom();
    const initialZoom = new TimeRange(timestamp1000, timestamp4000);
    dom.setComponentInput('initialZoom', initialZoom);
    dom.detectChanges();
    dom.setComponentInput(
      'currentTracePosition',
      TracePosition.fromTimestamp(timestamp2000),
    );
    dom.setComponentInput('expandedTimelineMouseXRatio', 0.25);
    dom.detectChanges();

    const fullRangeQuarterTimestamp = timestamp1750;
    checkZoomOnTimestamp(
      fullRangeQuarterTimestamp,
      1n,
      4n,
      zoomInByKeyW,
      zoomOutByKeyS,
      10,
    );

    setCanvasZeroXOffset();
    checkZoomOnTimestamp(
      fullRangeQuarterTimestamp,
      1n,
      4n,
      zoomInByScrollWheel,
      zoomOutByScrollWheel,
      10,
    );
  });

  it('draws hover timestamp for mouse position from expanded timeline', async () => {
    await initializeTracesForWASDZoom();
    const initialZoom = new TimeRange(timestamp1000, timestamp4000);
    dom.setComponentInput('initialZoom', initialZoom);
    dom.setComponentInput(
      'currentTracePosition',
      TracePosition.fromTimestamp(timestamp2000),
    );
    dom.detectChanges();

    const drawer = assertDefined(component.drawer);
    const spy = spyOn(drawer, 'updateHover');
    const ratio = 0.25;
    dom.setComponentInput('expandedTimelineMouseXRatio', ratio);
    dom.detectChanges();
    expect(spy).toHaveBeenCalledOnceWith({x: ratio * drawer.getWidth(), y: 0});
  });

  it('emits hover position update', async () => {
    await initializeTracesForWASDZoom();
    const initialZoom = new TimeRange(timestamp1000, timestamp4000);
    dom.setComponentInput('initialZoom', initialZoom);
    dom.setComponentInput(
      'currentTracePosition',
      TracePosition.fromTimestamp(timestamp2000),
    );
    dom.detectChanges();

    const miniTimelineElement = component.miniTimelineWrapper().nativeElement;
    const spy = spyOn(component.onHoverPositionUpdate, 'emit');

    const xRatio = 0.1;
    const offsetX = xRatio * miniTimelineElement.clientWidth;
    const hoverTs = new Transformer(
      timelineData.getZoomRange(),
      assertDefined(component.drawer).getUsableRange(),
      timelineData.getTimestampConverter(),
    ).untransform(offsetX);

    dispatchMouseMoveToCanvas(offsetX);
    expect(spy).toHaveBeenCalledTimes(1);
    const args = assertDefined(spy.calls.mostRecent().args[0]);
    expect(args.posX).toBeCloseTo(
      offsetX + miniTimelineElement.offsetLeft,
      0.001,
    );
    expect(args.ts).toEqual(hoverTs);
    expect(args.xRatio).toBeCloseTo(xRatio, 0.001);

    spy.calls.reset();
    dispatchMouseLeaveToCanvas();
    expect(spy).toHaveBeenCalledOnceWith(undefined);
  });

  async function createAndInitializeTimelineData(traces: Traces) {
    timelineData = new TimelineData();
    await timelineData.initialize(traces, undefined, converter);
    return timelineData;
  }

  async function initializeTraces() {
    const traces = new TracesBuilder()
      .setTimestamps(TraceType.SURFACE_FLINGER, [timestamp10])
      .setTimestamps(TraceType.WINDOW_MANAGER, [timestamp1000])
      .build();
    dom.setComponentInput(
      'timelineData',
      await createAndInitializeTimelineData(traces),
    );
    dom.detectChanges();
  }

  async function initializeTracesForWASDZoom() {
    const traces = new TracesBuilder()
      .setTimestamps(TraceType.SURFACE_FLINGER, [
        timestamp1000,
        timestamp2000,
        timestamp4000,
      ])
      .build();
    dom.setComponentInput(
      'timelineData',
      await createAndInitializeTimelineData(traces),
    );
  }

  function checkZoomDifference(
    biggerRange: TimeRange,
    smallerRange: TimeRange,
  ) {
    expect(biggerRange).not.toBe(smallerRange);
    expect(smallerRange.startNs).toBeGreaterThanOrEqual(
      Number(biggerRange.startNs),
    );
    expect(smallerRange.endNs).toBeLessThanOrEqual(Number(biggerRange.endNs));
  }

  function zoomInByKeyW() {
    dom.dispatchEventInDocument(
      new KeyboardEvent('keydown', {code: KeyboardEventCode.W}),
    );
  }

  function zoomOutByKeyS() {
    dom.dispatchEventInDocument(
      new KeyboardEvent('keydown', {code: KeyboardEventCode.S}),
    );
  }

  function zoomInByScrollWheel() {
    const wheelEvent = new WheelEvent('wheel');
    spyOnProperty(wheelEvent, 'x').and.returnValue(10);
    spyOnProperty(wheelEvent, 'deltaY').and.returnValue(-200);
    zoomByScroll(wheelEvent);
  }

  function zoomOutByScrollWheel() {
    const wheelEvent = new WheelEvent('wheel');
    spyOnProperty(wheelEvent, 'y').and.returnValue(10);
    spyOnProperty(wheelEvent, 'deltaY').and.returnValue(200);
    zoomByScroll(wheelEvent);
  }

  function zoomByScroll(wheelEvent: WheelEvent) {
    const spy = spyOn(wheelEvent, 'preventDefault').and.callThrough();
    spyOnProperty(wheelEvent, 'deltaX').and.returnValue(0);

    const canvas = component.getCanvas();
    spyOnProperty(wheelEvent, 'target').and.returnValue(canvas);

    dom.dispatchEvent(wheelEvent);
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
  }

  function getContextMenuItems(): Array<DOMTestHelper<MiniTimelineComponent>> {
    return dom.getInDocument('.context-menu')?.findAll('.context-menu-item');
  }

  function checkZoomOnTimestamp(
    zoomOnTimestamp: Timestamp,
    ratioNom: bigint,
    ratioDenom: bigint,
    zoomInAction: () => void,
    zoomOutAction: () => void,
    scaleFactor = 1,
  ) {
    let currentZoom = timelineData.getZoomRange();
    for (let i = 0; i < 5; i++) {
      zoomInAction();

      const zoomedIn = timelineData.getZoomRange();
      checkZoomDifference(currentZoom, zoomedIn);
      currentZoom = zoomedIn;

      const zoomedInTimestamp = zoomedIn.from.add(
        (zoomedIn.to.minus(zoomedIn.startNs).getValueNs() * ratioNom) /
          ratioDenom,
      );
      expect(
        Math.abs(Number(zoomedInTimestamp.minus(zoomOnTimestamp))),
      ).toBeLessThanOrEqual(5000 * scaleFactor);
    }
    for (let i = 0; i < 4; i++) {
      zoomOutAction();

      const zoomedOut = timelineData.getZoomRange();
      checkZoomDifference(zoomedOut, currentZoom);
      currentZoom = zoomedOut;

      const zoomedOutTimestamp = zoomedOut.from.add(
        (zoomedOut.to.minus(zoomedOut.startNs).getValueNs() * ratioNom) /
          ratioDenom,
      );
      expect(
        Math.abs(Number(zoomedOutTimestamp.minus(zoomOnTimestamp))),
      ).toBeLessThanOrEqual(5000 * scaleFactor);
    }
  }

  function openContextMenu(miniTimelineComponent: MiniTimelineComponent) {
    miniTimelineComponent
      .getCanvas()
      .dispatchEvent(new MouseEvent('contextmenu'));
    dom.detectChanges();
  }

  function setCanvasZeroXOffset() {
    const canvas = component.getCanvas();
    spyOnProperty(canvas, 'offsetLeft').and.returnValue(0);
  }

  function dispatchMouseMoveToCanvas(offsetX: number) {
    const canvas = component.getCanvas();
    const mouseMoveEvent = new MouseEvent('mousemove');
    Object.defineProperty(mouseMoveEvent, 'target', {value: canvas});
    Object.defineProperty(mouseMoveEvent, 'offsetX', {
      value: offsetX,
    });
    canvas.dispatchEvent(mouseMoveEvent);
    dom.detectChanges();
  }

  function dispatchMouseLeaveToCanvas() {
    component.getCanvas().dispatchEvent(new MouseEvent('mouseleave'));
    dom.detectChanges();
  }
});

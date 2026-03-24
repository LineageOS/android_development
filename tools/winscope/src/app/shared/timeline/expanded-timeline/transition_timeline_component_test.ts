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
import {PENDING_TO_PLAY_COLOR} from '@app/shared/timeline/common/transition_timeline_helpers';
import {Rect} from '@common/geometry/rect';
import {waitToBeCalled} from '@common/spy_utils';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeConverterZeroRteOffsets} from '@common/time/testing/test_helpers';
import {TimeRange, Timestamp} from '@common/time/time';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {TraceType} from '@trace_api/trace_type';
import {TransitionStatus} from '@trace/transitions/status';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';

import {TransitionTimelineComponent} from './transition_timeline_component';

describe('TransitionTimelineComponent', () => {
  let component: TransitionTimelineComponent;
  let dom: DOMTestHelper<TransitionTimelineComponent>;

  const converter = makeConverterZeroRteOffsets();
  const time0 = converter.makeTimestampFromRealNs(0n);
  const time5 = converter.makeTimestampFromRealNs(5n);
  const time10 = converter.makeTimestampFromRealNs(10n);
  const time20 = converter.makeTimestampFromRealNs(20n);
  const time30 = converter.makeTimestampFromRealNs(30n);
  const time35 = converter.makeTimestampFromRealNs(35n);
  const time60 = converter.makeTimestampFromRealNs(60n);
  const time85 = converter.makeTimestampFromRealNs(85n);
  const time110 = converter.makeTimestampFromRealNs(110n);
  const time120 = converter.makeTimestampFromRealNs(120n);
  const time160 = converter.makeTimestampFromRealNs(160n);

  const range10to110 = new TimeRange(time10, time110);
  const range0to160 = new TimeRange(time0, time160);

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
        TransitionTimelineComponent,
      ],
    })
      .overrideComponent(TransitionTimelineComponent, {
        set: {changeDetection: ChangeDetectionStrategy.Default},
      })
      .compileComponents();
    const fixture = TestBed.createComponent(TransitionTimelineComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('timestampConverter', converter);
    dom.setComponentInput('fullRange', range0to160);
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('can draw non-overlapping transitions', async () => {
    const drawRectSpy = spyOn(component.canvasDrawer, 'drawRect');

    const transitions = [
      makeTransition(time10, time30),
      makeTransition(time60, time110),
    ];
    await setTraceAndSelectionRange(transitions, [time10, time60]);

    const padding = 5;
    const oneRowTotalHeight = 30;
    const oneRowHeight = oneRowTotalHeight - padding;
    const width = component.canvasDrawer.getScaledCanvasWidth();
    const color = component.color();

    expect(drawRectSpy).toHaveBeenCalledTimes(2);
    expect(drawRectSpy).toHaveBeenCalledWith(
      new Rect(0, padding, Math.floor(width / 5), oneRowHeight),
      color,
      1,
      false,
      false,
    );
    expect(drawRectSpy).toHaveBeenCalledWith(
      new Rect(
        Math.floor(width / 2),
        padding,
        Math.floor(width / 2),
        oneRowHeight,
      ),
      color,
      1,
      false,
      false,
    );
  });

  it('can draw transitions zoomed in', async () => {
    const drawRectSpy = spyOn(component.canvasDrawer, 'drawRect');

    const transitions = [
      makeTransition(time10, time20), // drawn
      makeTransition(time60, time160), // drawn at half size
      makeTransition(time120, time160), // not drawn - starts after selection range
      makeTransition(time0, time5), // not drawn - finishes before selection range
      makeTransition(time5, undefined), // not drawn - starts before selection range with unknown finish time
    ];
    await setTraceAndSelectionRange(transitions, [
      time10,
      time60,
      time120,
      time0,
      time5,
    ]);

    const padding = 5;
    const oneRowTotalHeight =
      (component.canvasDrawer.getScaledCanvasHeight() - 2 * padding) / 3;
    const oneRowHeight = oneRowTotalHeight - padding;
    const width = component.canvasDrawer.getScaledCanvasWidth();
    const color = component.color();

    expect(drawRectSpy).toHaveBeenCalledTimes(2);
    expect(drawRectSpy).toHaveBeenCalledWith(
      new Rect(0, padding, Math.floor(width / 10), oneRowHeight),
      color,
      1,
      false,
      false,
    );
    expect(drawRectSpy).toHaveBeenCalledWith(
      new Rect(
        Math.floor(width / 2),
        padding,
        Math.floor(width / 2),
        oneRowHeight,
      ),
      color,
      1,
      false,
      false,
    );
  });

  it('can draw selected entry', async () => {
    const drawRectSpy = spyOn(component.canvasDrawer, 'drawRect');
    const drawRectBorderSpy = spyOn(component.canvasDrawer, 'drawRectBorder');
    const waitPromises = [
      waitToBeCalled(drawRectSpy, 1),
      waitToBeCalled(drawRectBorderSpy, 1),
    ];
    await setDefaultTraceAndSelectionRange(true);
    await Promise.all(waitPromises);

    const expectedRect = getExpectedBorderedRect();
    expect(drawRectSpy).toHaveBeenCalledOnceWith(
      expectedRect,
      component.color(),
      1,
      false,
      false,
    );
    expect(drawRectBorderSpy).toHaveBeenCalledTimes(1);
    expect(drawRectBorderSpy).toHaveBeenCalledWith(expectedRect);
  });

  it('can draw hovering entry', async () => {
    const drawRectSpy = spyOn(component.canvasDrawer, 'drawRect');
    await setDefaultTraceAndSelectionRange();
    const expectedRect = getExpectedBorderedRect();
    const color = component.color();

    expect(drawRectSpy).toHaveBeenCalledOnceWith(
      expectedRect,
      color,
      1,
      false,
      false,
    );

    const drawRectBorderSpy = spyOn(
      component.canvasDrawer,
      'drawRectBorder',
    ).and.callThrough();

    await dispatchMousemoveEvent();
    expect(drawRectBorderSpy).toHaveBeenCalledOnceWith(expectedRect);

    drawRectSpy.calls.reset();
    drawRectBorderSpy.calls.reset();

    await dispatchMousemoveEvent();
    expect(drawRectSpy).toHaveBeenCalledOnceWith(
      expectedRect,
      color,
      1,
      false,
      false,
    );
    expect(drawRectBorderSpy).toHaveBeenCalledOnceWith(expectedRect);
  });

  it('redraws timeline to clear hover entry after mouse out', async () => {
    await setDefaultTraceAndSelectionRange();
    const drawRectSpy = spyOn(component.canvasDrawer, 'drawRect');

    const mouseoutEvent = new MouseEvent('mouseout');
    component.getCanvas().dispatchEvent(mouseoutEvent);
    await dom.detectChangesAndRenderingDone();
    expect(drawRectSpy).not.toHaveBeenCalled();

    await dispatchMousemoveEvent();
    component.getCanvas().dispatchEvent(mouseoutEvent);
    await dom.detectChangesAndRenderingDone();

    expect(drawRectSpy).toHaveBeenCalledOnceWith(
      getExpectedBorderedRect(),
      component.color(),
      1,
      false,
      false,
    );
  });

  it('can draw overlapping transitions (default)', async () => {
    const drawRectSpy = spyOn(component.canvasDrawer, 'drawRect');
    const transitions = [
      makeTransition(time10, time85),
      makeTransition(time60, time110),
    ];
    await setTraceAndSelectionRange(transitions, [time10, time60]);

    const padding = 5;
    const rows = 2;
    const oneRowTotalHeight =
      (component.canvasDrawer.getScaledCanvasHeight() - 2 * padding) / rows;
    const oneRowHeight = oneRowTotalHeight - padding;
    const width = component.canvasDrawer.getScaledCanvasWidth();
    const color = component.color();

    expect(drawRectSpy).toHaveBeenCalledTimes(2);
    expect(drawRectSpy).toHaveBeenCalledWith(
      new Rect(0, padding, Math.floor((width * 3) / 4), oneRowHeight),
      color,
      1,
      false,
      false,
    );
    expect(drawRectSpy).toHaveBeenCalledWith(
      new Rect(
        Math.floor(width / 2),
        padding + oneRowTotalHeight,
        Math.floor(width / 2),
        oneRowHeight,
      ),
      color,
      1,
      false,
      false,
    );
  });

  it('can draw overlapping transitions (contained)', async () => {
    const drawRectSpy = spyOn(component.canvasDrawer, 'drawRect');
    const transitions = [
      makeTransition(time10, time85),
      makeTransition(time35, time60),
    ];
    await setTraceAndSelectionRange(transitions, [time10, time35]);

    const padding = 5;
    const rows = 2;
    const oneRowTotalHeight =
      (component.canvasDrawer.getScaledCanvasHeight() - 2 * padding) / rows;
    const oneRowHeight = oneRowTotalHeight - padding;
    const width = component.canvasDrawer.getScaledCanvasWidth();
    const color = component.color();

    expect(drawRectSpy).toHaveBeenCalledTimes(2);
    expect(drawRectSpy).toHaveBeenCalledWith(
      new Rect(0, padding, Math.floor((width * 3) / 4), oneRowHeight),
      color,
      1,
      false,
      false,
    );
    expect(drawRectSpy).toHaveBeenCalledWith(
      new Rect(
        Math.floor(width / 4),
        padding + oneRowTotalHeight,
        Math.floor(width / 4),
        oneRowHeight,
      ),
      color,
      1,
      false,
      false,
    );
  });

  it('can draw aborted transitions', async () => {
    const drawRectSpy = spyOn(component.canvasDrawer, 'drawRect');
    const transitions = [
      makeTransition(undefined, undefined, time85, undefined, time35),
    ];
    await setTraceAndSelectionRange(transitions, [time35]);

    const padding = 5;
    const oneRowTotalHeight = 30;
    const oneRowHeight = oneRowTotalHeight - padding;
    const width = component.canvasDrawer.getScaledCanvasWidth();

    expect(drawRectSpy).toHaveBeenCalledTimes(1);
    expect(drawRectSpy).toHaveBeenCalledWith(
      new Rect(
        Math.floor((width * 1) / 4),
        padding,
        Math.floor(width / 2),
        oneRowHeight,
      ),
      PENDING_TO_PLAY_COLOR,
      0.25,
      false,
      false,
    );
  });

  it('can draw transition with unknown start time', async () => {
    const drawRectSpy = spyOn(component.canvasDrawer, 'drawRect');
    const transitions = [makeTransition(undefined, undefined, time85)];
    await setTraceAndSelectionRange(transitions, [time0]);

    const padding = 5;
    const oneRowTotalHeight = 30;
    const oneRowHeight = oneRowTotalHeight - padding;

    expect(drawRectSpy).toHaveBeenCalledTimes(1);
    expect(drawRectSpy).toHaveBeenCalledWith(
      new Rect(
        Math.floor((component.canvasDrawer.getScaledCanvasWidth() * 74) / 100),
        padding,
        oneRowHeight,
        oneRowHeight,
      ),
      PENDING_TO_PLAY_COLOR,
      0.25,
      true,
      false,
    );
  });

  it('can draw transition with unknown end time', async () => {
    const drawRectSpy = spyOn(component.canvasDrawer, 'drawRect');
    const transitions = [makeTransition(time35, undefined)];
    await setTraceAndSelectionRange(transitions, [time35]);

    const padding = 5;
    const oneRowTotalHeight = 30;
    const oneRowHeight = oneRowTotalHeight - padding;

    expect(drawRectSpy).toHaveBeenCalledTimes(1);
    expect(drawRectSpy).toHaveBeenCalledWith(
      new Rect(
        Math.floor((component.canvasDrawer.getScaledCanvasWidth() * 1) / 4),
        padding,
        oneRowHeight,
        oneRowHeight,
      ),
      component.color(),
      1,
      false,
      true,
    );
  });

  it('handles missing trace entries', async () => {
    const transition0 = makeTransition(time10, time30);
    const transition1 = makeTransition(time60, time110);

    const trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.TRANSITION)
      .setEntries([transition0, transition1])
      .setTimestamps([time10, time20])
      .build();

    dom.setComponentInput('trace', trace);
    dom.setComponentInput('transitionEntries', [transition0, undefined]);
    dom.setComponentInput('selectionRange', range10to110);

    const drawRectSpy = spyOn(component.canvasDrawer, 'drawRect');

    await dom.detectChangesAndRenderingDone();
    expect(drawRectSpy).toHaveBeenCalledTimes(1);
  });

  it('emits scroll event', async () => {
    await setDefaultTraceAndSelectionRange();
    const spy = spyOn(component.onScrollEvent, 'emit');
    dom.dispatchEvent(new WheelEvent('wheel'));
    expect(spy).toHaveBeenCalled();
  });

  it('tracks mouse position', async () => {
    await setDefaultTraceAndSelectionRange();

    const spy = spyOn(component.onMouseXRatioUpdate, 'emit');
    const canvas = component.canvasRef().nativeElement;

    const mouseMoveEvent = new MouseEvent('mousemove');
    Object.defineProperty(mouseMoveEvent, 'target', {value: canvas});
    Object.defineProperty(mouseMoveEvent, 'offsetX', {value: 100});
    canvas.dispatchEvent(mouseMoveEvent);
    dom.detectChanges();

    expect(spy).toHaveBeenCalledWith(100 / canvas.offsetWidth);

    const mouseLeaveEvent = new MouseEvent('mouseleave');
    canvas.dispatchEvent(mouseLeaveEvent);
    dom.detectChanges();
    expect(spy).toHaveBeenCalledWith(undefined);
  });

  async function setDefaultTraceAndSelectionRange(setSelectedEntry = false) {
    const transitions = [makeTransition(time35, time85)];
    const trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.TRANSITION)
      .setEntries(transitions)
      .setTimestamps([time35])
      .build();

    dom.setComponentInput('trace', trace);
    dom.setComponentInput('transitionEntries', transitions);
    dom.setComponentInput('selectionRange', range10to110);
    if (setSelectedEntry) {
      dom.setComponentInput('selectedEntry', trace.getEntry(0));
    }
    await dom.detectChangesAndRenderingDone();
  }

  function makeTransition(
    dispatchTimeNs: Timestamp | undefined,
    finishTimeNs: Timestamp | undefined,
    shellAbortTimeNs?: Timestamp,
    createTimeNs?: Timestamp,
    sendTimeNs?: Timestamp | undefined,
  ): HierarchyTreeNode {
    return new HierarchyTreeBuilder()
      .setRootNodeFormatter(new SetFormatters())
      .setId('TransitionsTraceEntry')
      .setName('transition')
      .setProperties({
        dispatchTimeNs,
        shellAbortTimeNs,
        finishTimeNs,
        createTimeNs,
        sendTimeNs,
        status:
          shellAbortTimeNs !== undefined ? TransitionStatus.ABORTED : undefined,
      })
      .build();
  }

  async function setTraceAndSelectionRange(
    transitions: HierarchyTreeNode[],
    timestamps: Timestamp[],
    range = range10to110,
  ) {
    const trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.TRANSITION)
      .setEntries(transitions)
      .setTimestamps(timestamps)
      .build();
    dom.setComponentInput('trace', trace);
    dom.setComponentInput('transitionEntries', transitions);
    dom.setComponentInput('selectionRange', range);
    await dom.detectChangesAndRenderingDone();
  }

  function getExpectedBorderedRect(): Rect {
    const padding = 5;
    const oneRowTotalHeight = 30;
    const oneRowHeight = oneRowTotalHeight - padding;
    const width = component.canvasDrawer.getScaledCanvasWidth();
    return new Rect(
      Math.floor((width * 1) / 4),
      padding,
      Math.floor(width / 2),
      oneRowHeight,
    );
  }

  async function dispatchMousemoveEvent() {
    const mousemoveEvent = new MouseEvent('mousemove');
    spyOnProperty(mousemoveEvent, 'offsetX').and.returnValue(
      Math.floor(component.canvasDrawer.getScaledCanvasWidth() / 2),
    );
    spyOnProperty(mousemoveEvent, 'offsetY').and.returnValue(25 / 2);
    component.getCanvas().dispatchEvent(mousemoveEvent);
    await dom.detectChangesAndRenderingDone();
  }
});

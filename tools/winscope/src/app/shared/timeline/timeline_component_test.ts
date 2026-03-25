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

import {ClipboardModule} from '@angular/cdk/clipboard';
import {DragDropModule} from '@angular/cdk/drag-drop';
import {CdkMenuModule} from '@angular/cdk/menu';
import {ChangeDetectionStrategy} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatDrawer, MatDrawerContainer, MatDrawerContent,} from '@app/shared/bottomnav/bottom_drawer_component';
import {CanvasDrawer} from '@app/shared/timeline/expanded-timeline/canvas_drawer';
import {DefaultTimelineRowComponent} from '@app/shared/timeline/expanded-timeline/default_timeline_row_component';
import {ExpandedTimelineComponent} from '@app/shared/timeline/expanded-timeline/expanded_timeline_component';
import {TransitionTimelineComponent} from '@app/shared/timeline/expanded-timeline/transition_timeline_component';
import {MiniTimelineDrawerImpl} from '@app/shared/timeline/mini-timeline/drawer/mini_timeline_drawer_impl';
import {MiniTimelineComponent} from '@app/shared/timeline/mini-timeline/mini_timeline_component';
import {SliderComponent} from '@app/shared/timeline/mini-timeline/slider_component';
import {assertDefined} from '@common/assert';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {Store} from '@common/store/store';
import {checkTooltips, DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeConverterZeroRteOffsets} from '@common/time/testing/test_helpers';
import {TimeRange} from '@common/time/time';
import {WinscopeEvent} from '@messaging/winscope_event';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {TracesBuilder} from '@trace_api/testing/traces_builder';
import {Trace, TraceEntry} from '@trace_api/trace';
import {ActiveTraceChanged, InitializeTraceSearchRequest, TraceAddRequest, TracePositionUpdate, TraceRemoveRequest, TraceSearchCompleted, TraceSearchInitialized, TraceSearchRequest,} from '@trace_api/trace_events';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TracePosition} from '@trace_api/trace_position';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {QueryResult} from '@trace_processor/query_result';
import {makeSearchTraceSpies} from '@trace_processor/test_utils';
import {CanvasEntry, MediaBasedTraceEntry, VideoEntry,} from '@trace/media_based/media_based_trace_entry';
import {Thumbnail} from '@trace/media_based/thumbnail';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {BookmarksChanged} from '@ui/shared/events/misc_events';
import {PlaybackSpeedChange, PlaybackStateChangeHandled, PlaybackStateChangeRequest,} from '@ui/shared/playback/events';
import {PlaybackState} from '@ui/shared/playback/playback_state';
import {TimelineData} from '@ui/timeline/timeline_data';
import {ExpandedTimelineToggled} from '@ui/timeline/timeline_events';

import {PlaybackControlsComponent} from './playback_component';
import {TimelineComponent} from './timeline_component';

describe('TimelineComponent', () => {
  const converter = makeConverterZeroRteOffsets();

  const time90 = converter.makeTimestampFromRealNs(90n);
  const time100 = converter.makeTimestampFromRealNs(100n);
  const time101 = converter.makeTimestampFromRealNs(101n);
  const time105 = converter.makeTimestampFromRealNs(105n);
  const time110 = converter.makeTimestampFromRealNs(110n);
  const time112 = converter.makeTimestampFromRealNs(112n);

  const time2000 = converter.makeTimestampFromRealNs(2000n);
  const time3000 = converter.makeTimestampFromRealNs(3000n);
  const time4000 = converter.makeTimestampFromRealNs(4000n);
  const time6000 = converter.makeTimestampFromRealNs(6000n);
  const time8000 = converter.makeTimestampFromRealNs(8000n);

  const position90 = TracePosition.fromTimestamp(time90);
  const position100 = TracePosition.fromTimestamp(time100);
  const position105 = TracePosition.fromTimestamp(time105);
  const position110 = TracePosition.fromTimestamp(time110);
  const position112 = TracePosition.fromTimestamp(time112);

  const nextEntrySelector = '#next_entry_button';
  const prevEntrySelector = '#prev_entry_button';

  let component: TimelineComponent;
  let dom: DOMTestHelper<TimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
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
        ClipboardModule,
        CdkMenuModule,
        MatProgressSpinnerModule,
        ExpandedTimelineComponent,
        DefaultTimelineRowComponent,
        MatDrawer,
        MatDrawerContainer,
        MatDrawerContent,
        MiniTimelineComponent,
        TimelineComponent,
        SliderComponent,
        TimelineComponent,
        TransitionTimelineComponent,
        PlaybackControlsComponent,
      ],
    })
      .overrideComponent(TimelineComponent, {
        set: {changeDetection: ChangeDetectionStrategy.Default},
      })
      .compileComponents();
    resetDom(new InMemoryStorage());
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('can be expanded', () => {
    const traces = new TracesBuilder()
      .setTimestamps(TraceType.SURFACE_FLINGER, [time100, time110])
      .build();
    component.timelineData().initialize(traces, undefined, converter);
    dom.detectChanges();

    // initially not expanded
    let expandedTimelineElement = dom.findByDirective(
      ExpandedTimelineComponent,
    );
    expect(expandedTimelineElement).toBeUndefined();

    let isExpanded = false;
    component.setEmitEvent(async (event: WinscopeEvent) => {
      expect(event).toBeInstanceOf(ExpandedTimelineToggled);
      isExpanded = (event as ExpandedTimelineToggled).isTimelineExpanded;
    });

    const button = dom.findAndClick(`.${component.TOGGLE_BUTTON_CLASS}`);
    expandedTimelineElement = dom.findByDirective(ExpandedTimelineComponent);
    expect(expandedTimelineElement).toBeDefined();
    expect(isExpanded).toBeTrue();

    button.click();
    expandedTimelineElement = dom.findByDirective(ExpandedTimelineComponent);
    expect(expandedTimelineElement).toBeUndefined();
    expect(isExpanded).toBeFalse();
  });

  it('handles empty traces', () => {
    const traces = new TracesBuilder()
      .setEntries(TraceType.SURFACE_FLINGER, [])
      .build();
    component.timelineData().initialize(traces, undefined, converter);
    dom.detectChanges();

    expect(dom.find('.time-selector')).toBeUndefined();
    expect(dom.find('.trace-selector')).toBeUndefined();

    const errorMessageContainer = dom.get('.no-timeline-msg');
    errorMessageContainer.checkText('No timeline to show!');
    errorMessageContainer.checkText('All loaded traces contain no timestamps.');

    checkNoTimelineNavigation();
  });

  it('handles some empty traces and some with one timestamp', async () => {
    await loadTracesWithOneTimestamp();

    expect(dom.find('#time-selector')).toBeDefined();
    const shownSelection = dom.get('#trace-selector .shown-selection');
    shownSelection.checkInnerHTML('Window Manager');
    shownSelection.checkInnerHTML('Surface Flinger', false);

    const errorMessageContainer = dom.get('.no-timeline-msg');
    errorMessageContainer.checkText('No timeline to show!');
    errorMessageContainer.checkText(
      'Only a single timestamp has been recorded.',
    );

    checkNoTimelineNavigation();
  });

  it('processes active trace input and updates selected traces', async () => {
    loadAllTraces();
    dom.detectChanges();

    const nextEntryButton = dom.get(nextEntrySelector);
    const prevEntryButton = dom.get(prevEntrySelector);

    component.selectedTraces.set([getLoadedTrace(TraceType.SURFACE_FLINGER)]);
    dom.detectChanges();
    checkActiveTraceSurfaceFlinger(nextEntryButton, prevEntryButton);

    // setting same trace as active does not affect selected traces
    await updateActiveTrace(TraceType.SURFACE_FLINGER);
    expectSelectedTraceTypes([TraceType.SURFACE_FLINGER]);
    checkActiveTraceSurfaceFlinger(nextEntryButton, prevEntryButton);

    await updateActiveTrace(TraceType.SCREEN_RECORDING);
    expectSelectedTraceTypes([
      TraceType.SURFACE_FLINGER,
      TraceType.SCREEN_RECORDING,
    ]);
    testCurrentTimestampOnButtonClick(prevEntryButton, position110, 110n);

    await updateActiveTrace(TraceType.WINDOW_MANAGER);
    expectSelectedTraceTypes([
      TraceType.SURFACE_FLINGER,
      TraceType.SCREEN_RECORDING,
      TraceType.WINDOW_MANAGER,
    ]);
    checkActiveTraceWindowManager(nextEntryButton, prevEntryButton);

    await updateActiveTrace(TraceType.PROTO_LOG);
    expectSelectedTraceTypes([
      TraceType.SURFACE_FLINGER,
      TraceType.SCREEN_RECORDING,
      TraceType.WINDOW_MANAGER,
      TraceType.PROTO_LOG,
    ]);
    testCurrentTimestampOnButtonClick(nextEntryButton, position100, 100n);
    checkActiveTraceHasOneEntry(nextEntryButton, prevEntryButton);

    // setting active trace that is already selected does not affect selection
    await updateActiveTrace(TraceType.SCREEN_RECORDING);
    expectSelectedTraceTypes([
      TraceType.SURFACE_FLINGER,
      TraceType.SCREEN_RECORDING,
      TraceType.WINDOW_MANAGER,
      TraceType.PROTO_LOG,
    ]);
    testCurrentTimestampOnButtonClick(nextEntryButton, position110, 110n);
    checkActiveTraceHasOneEntry(nextEntryButton, prevEntryButton);
  });

  it('handles undefined active trace input', async () => {
    const traces = new TracesBuilder()
      .setTimestamps(TraceType.WM_TRANSITION, [time100, time110])
      .build();

    const timelineData = component.timelineData();
    timelineData.initialize(traces, undefined, converter);
    timelineData.setPosition(position100);
    dom.detectChanges();
    const nextEntryButton = dom.get(nextEntrySelector);
    const prevEntryButton = dom.get(prevEntrySelector);
    expect(timelineData.getActiveTrace()).toBeUndefined();
    expect(timelineData.getCurrentPosition()?.timestamp.getValueNs()).toEqual(
      100n,
    );

    prevEntryButton.checkDisabled(true);
    nextEntryButton.checkDisabled(true);
  });

  it('handles ActiveTraceChanged event', async () => {
    loadSfWmTraces();
    dom.detectChanges();

    const nextEntryButton = dom.get(nextEntrySelector);
    const prevEntryButton = dom.get(prevEntrySelector);
    const spy = spyOn(assertDefined(component.miniTimeline()?.drawer), 'draw');

    await updateActiveTrace(TraceType.SURFACE_FLINGER);
    dom.detectChanges();
    checkActiveTraceSurfaceFlinger(nextEntryButton, prevEntryButton);
    expect(spy).toHaveBeenCalled();
  });

  it('updates trace selection using selector', async () => {
    const allTraceTypes = [
      TraceType.SEARCH,
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
      TraceType.PROTO_LOG,
      TraceType.VIEW_CAPTURE,
    ];
    loadAllTraces();
    const [spyQueryResult] = makeSearchTraceSpies(time100);
    const searchTrace = new TraceBuilder<QueryResult>()
      .setEntries([spyQueryResult])
      .setTimestamps([time100])
      .setDescriptors(['test query', '0'])
      .setType(TraceType.SEARCH)
      .build();
    await component.onWinscopeEvent(new TraceAddRequest(searchTrace));
    expectSelectedTraceTypes(allTraceTypes);

    await dom.openMatSelect();

    const matOptions = dom.getMatSelectPanel().findAll('mat-option');
    await checkTooltips(Array.from(matOptions), [
      'test query, 0',
      'mock_screen_recording',
      'file descriptor',
      'file descriptor',
      'file descriptor',
      'Test Window, mock_view_capture',
    ]);
    matOptions[0].checkText('Search test query');
    const sfOption = matOptions[2];
    sfOption.checkText('Surface Flinger');
    expect(sfOption.getHTMLElement().ariaDisabled).toBe('true');
    for (const i of [1, 3, 4]) {
      expect(matOptions[i].getHTMLElement().ariaDisabled).toBe('false');
    }

    matOptions[3].click();
    const expectedTypes = [
      TraceType.SEARCH,
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.PROTO_LOG,
      TraceType.VIEW_CAPTURE,
    ];
    expectSelectedTraceTypes(expectedTypes);
    const traceIcons = dom
      .findAll('#trace-selector .shown-selection .mat-icon')
      .slice(1);
    traceIcons.forEach((el, index) => {
      const expectedType = expectedTypes[index];
      el.checkTextExact(TRACE_INFO[expectedType].icon);
    });
    await checkTooltips(traceIcons, [
      'Search test query',
      'Screen Recording mock_screen_recording',
      TRACE_INFO[TraceType.SURFACE_FLINGER].name,
      TRACE_INFO[TraceType.PROTO_LOG].name,
      'View Capture Test Window',
    ]);

    matOptions[3].click();
    expectSelectedTraceTypes(allTraceTypes);
    const newIcons = dom.findAll('#trace-selector .shown-selection .mat-icon');
    expect(
      Array.from(newIcons)
        .map((icon) => icon.getText())
        .slice(1),
    ).toEqual(allTraceTypes.map((type) => TRACE_INFO[type].icon));
  });

  it('update name and disables option for dumps', async () => {
    loadAllTraces(false);
    await dom.openMatSelect();

    const matOptions = dom.getMatSelectPanel().findAll('.mat-mdc-option'); // [WM, SF, SR, ProtoLog, VC]

    for (const i of [0, 2, 4]) {
      expect(matOptions[i].getHTMLElement().ariaDisabled).toBe('false');
    }
    for (const i of [1, 3]) {
      expect(matOptions[i].getHTMLElement().ariaDisabled).toBe('true');
    }
    matOptions[3].checkText('ProtoLog Dump');
    matOptions[4].checkText('View Capture Test Window');
  });

  it('next button disabled if no next entry', () => {
    loadSfWmTraces();
    const timelineData = component.timelineData();

    expect(timelineData.getCurrentPosition()?.timestamp.getValueNs()).toEqual(
      100n,
    );

    const nextEntryButton = dom.get(nextEntrySelector);
    nextEntryButton.checkDisabled(false);

    timelineData.setPosition(position90);
    dom.detectChanges();
    nextEntryButton.checkDisabled(false);

    timelineData.setPosition(position110);
    dom.detectChanges();
    nextEntryButton.checkDisabled(true);

    timelineData.setPosition(position112);
    dom.detectChanges();
    nextEntryButton.checkDisabled(true);
  });

  it('prev button disabled if no prev entry', () => {
    loadSfWmTraces();
    const timelineData = component.timelineData();

    expect(timelineData.getCurrentPosition()?.timestamp.getValueNs()).toEqual(
      100n,
    );
    const prevEntryButton = dom.get(prevEntrySelector);
    prevEntryButton.checkDisabled(true);

    timelineData.setPosition(position90);
    dom.detectChanges();
    prevEntryButton.checkDisabled(true);

    timelineData.setPosition(position110);
    dom.detectChanges();
    prevEntryButton.checkDisabled(false);

    timelineData.setPosition(position112);
    dom.detectChanges();
    prevEntryButton.checkDisabled(false);
  });

  it('next button enabled for different active viewers', async () => {
    loadSfWmTraces();
    const nextEntryButton = dom.get(nextEntrySelector);
    nextEntryButton.checkDisabled(false);

    await updateActiveTrace(TraceType.WINDOW_MANAGER);
    dom.detectChanges();
    nextEntryButton.checkDisabled(false);
  });

  it('changes timestamp on next entry button press', () => {
    loadSfWmTraces();

    expect(
      component.timelineData().getCurrentPosition()?.timestamp.getValueNs(),
    ).toBe(100n);
    const nextEntryButton = dom.get(nextEntrySelector);

    testCurrentTimestampOnButtonClick(nextEntryButton, position105, 110n);

    testCurrentTimestampOnButtonClick(nextEntryButton, position100, 110n);

    testCurrentTimestampOnButtonClick(nextEntryButton, position90, 100n);

    // No change when we are already on the last timestamp of the active trace
    testCurrentTimestampOnButtonClick(nextEntryButton, position110, 110n);

    // No change when we are after the last entry of the active trace
    testCurrentTimestampOnButtonClick(nextEntryButton, position112, 112n);
  });

  it('changes timestamp on previous entry button press', () => {
    loadSfWmTraces();

    expect(
      component.timelineData().getCurrentPosition()?.timestamp.getValueNs(),
    ).toBe(100n);
    const prevEntryButton = dom.get(prevEntrySelector);

    // In this state we are already on the first entry at timestamp 100, so
    // there is no entry to move to before and we just don't update the timestamp
    testCurrentTimestampOnButtonClick(prevEntryButton, position105, 105n);

    testCurrentTimestampOnButtonClick(prevEntryButton, position110, 100n);

    // Active entry here should be 110 so moving back means moving to 100.
    testCurrentTimestampOnButtonClick(prevEntryButton, position112, 100n);

    // No change when we are already on the first timestamp of the active trace
    testCurrentTimestampOnButtonClick(prevEntryButton, position100, 100n);

    // No change when we are before the first entry of the active trace
    testCurrentTimestampOnButtonClick(prevEntryButton, position90, 90n);
  });

  it('performs expected action on arrow key press depending on input form focus', async () => {
    loadSfWmTraces();

    const spyNextEntry = spyOn(component, 'moveToNextEntry');
    const spyPrevEntry = spyOn(component, 'moveToPreviousEntry');

    await dom.keydownArrowRight(true);
    expect(spyNextEntry).toHaveBeenCalled();

    const formElement = dom.get('.time-input input').getHTMLElement();
    const focusInEvent = new FocusEvent('focusin');
    Object.defineProperty(focusInEvent, 'target', {value: formElement});
    dom.dispatchEventInDocument(focusInEvent);

    await dom.keydownArrowLeft(true);
    expect(spyPrevEntry).not.toHaveBeenCalled();

    const focusOutEvent = new FocusEvent('focusout');
    Object.defineProperty(focusOutEvent, 'target', {value: formElement});
    dom.dispatchEventInDocument(focusOutEvent);

    dom.keydownArrowLeft(true);
    expect(spyPrevEntry).toHaveBeenCalled();
  });

  it('updates position based on ns input field', () => {
    loadSfWmTraces();

    expect(
      component.timelineData().getCurrentPosition()?.timestamp.getValueNs(),
    ).toBe(100n);

    const timeInputField = dom.get('.time-input.nano');

    testCurrentTimestampOnTimeInput(
      timeInputField,
      position105,
      '110 ns',
      110n,
    );

    testCurrentTimestampOnTimeInput(
      timeInputField,
      position100,
      '110 ns',
      110n,
    );

    testCurrentTimestampOnTimeInput(timeInputField, position90, '100 ns', 100n);

    // No change when we are already on the last timestamp of the active trace
    testCurrentTimestampOnTimeInput(
      timeInputField,
      position110,
      '110 ns',
      110n,
    );

    // No change when we are after the last entry of the active trace
    testCurrentTimestampOnTimeInput(
      timeInputField,
      position112,
      '112 ns',
      112n,
    );
  });

  it('treats small ns values as boottime and uses makeTimestampFromBootTimeNs', () => {
    loadSfWmTraces();

    const timeInputField = dom.get('.time-input.nano');
    const spy = spyOn(
      component.timelineData().getTimestampConverter(),
      'makeTimestampFromBootTimeNs',
    ).and.callThrough();

    testCurrentTimestampOnTimeInput(timeInputField, position105, '10 ns', 90n);

    expect(spy).toHaveBeenCalledWith(10n);
  });

  it('updates position based on human time input field using date time format', () => {
    loadSfWmTraces();

    expect(
      component.timelineData().getCurrentPosition()?.timestamp.getValueNs(),
    ).toBe(100n);

    const timeInputField = dom.get('.time-input.human');

    testCurrentTimestampOnTimeInput(
      timeInputField,
      position105,
      '1970-01-01, 00:00:00.000000110',
      110n,
    );

    testCurrentTimestampOnTimeInput(
      timeInputField,
      position100,
      '1970-01-01, 00:00:00.000000110',
      110n,
    );

    testCurrentTimestampOnTimeInput(
      timeInputField,
      position90,
      '1970-01-01, 00:00:00.000000100',
      100n,
    );

    // No change when we are already on the last timestamp of the active trace
    testCurrentTimestampOnTimeInput(
      timeInputField,
      position110,
      '1970-01-01, 00:00:00.000000110',
      110n,
    );

    // No change when we are after the last entry of the active trace
    testCurrentTimestampOnTimeInput(
      timeInputField,
      position112,
      '1970-01-01, 00:00:00.000000112',
      112n,
    );
  });

  it('updates position based on human time input field using ISO timestamp format', () => {
    loadSfWmTraces();

    expect(
      component.timelineData().getCurrentPosition()?.timestamp.valueOf(),
    ).toBe(100n);

    const timeInputField = dom.get('.time-input.human');

    testCurrentTimestampOnTimeInput(
      timeInputField,
      position90,
      '1970-01-01T00:00:00.000000100',
      100n,
    );
  });

  it('updates position based on human time input field using time-only format', () => {
    loadSfWmTraces();

    expect(
      component.timelineData().getCurrentPosition()?.timestamp.valueOf(),
    ).toBe(100n);

    const timeInputField = dom.get('.time-input.human');

    testCurrentTimestampOnTimeInput(
      timeInputField,
      position105,
      '00:00:00.000000110',
      110n,
    );
  });

  it('sets initial zoom of mini timeline from first non-SR viewer to end of all traces', () => {
    loadAllTraces();
    expect(component.initialZoom).toEqual(new TimeRange(time100, time112));
  });

  it('stores manual trace deselection and applies on new load', async () => {
    loadAllTraces();
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
      TraceType.PROTO_LOG,
      TraceType.VIEW_CAPTURE,
    ]);
    await dom.openMatSelect();
    clickTraceFromSelectPanel(2);
    clickTraceFromSelectPanel(3);
    clickTraceFromSelectPanel(4);
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
    ]);

    const store = component.store();
    resetDom(store);
    loadAllTraces();
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
    ]);

    clickTraceFromSelectPanel(2);
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
    ]);

    resetDom(store);
    loadAllTraces();
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
    ]);
  });

  it('does not apply stored trace deselection on active trace', async () => {
    loadAllTraces();
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
      TraceType.PROTO_LOG,
      TraceType.VIEW_CAPTURE,
    ]);
    await updateActiveTrace(TraceType.PROTO_LOG);
    await dom.openMatSelect();
    clickTraceFromSelectPanel(1);
    clickTraceFromSelectPanel(4);
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.WINDOW_MANAGER,
      TraceType.PROTO_LOG,
    ]);

    const store = component.store();
    resetDom(store);
    loadAllTraces();
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
      TraceType.PROTO_LOG,
    ]);
  });

  it('does not apply stored trace deselection if only one timestamp available', async () => {
    loadAllTraces();
    await updateActiveTrace(TraceType.PROTO_LOG);
    await dom.openMatSelect();
    clickTraceFromSelectPanel(2);

    const store = component.store();
    resetDom(store);
    await loadTracesWithOneTimestamp();

    const shownSelection = dom.get('#trace-selector .shown-selection');
    expect(shownSelection.getHTMLElement().innerHTML).toContain(
      'Window Manager',
    );
    expect(shownSelection.getHTMLElement().innerHTML).not.toContain(
      'Surface Flinger',
    );
  });

  it('does not store traces based on active view trace type', async () => {
    loadAllTraces();
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
      TraceType.PROTO_LOG,
      TraceType.VIEW_CAPTURE,
    ]);
    await dom.openMatSelect();
    clickTraceFromSelectPanel(3);
    clickTraceFromSelectPanel(4);
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
    ]);
    await updateActiveTrace(TraceType.PROTO_LOG);
    dom.detectChanges();
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
      TraceType.PROTO_LOG,
    ]);

    const store = component.store();
    resetDom(store);
    loadAllTraces();
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
    ]);
  });

  it('applies stored trace deselection between non-consecutive applicable sessions', async () => {
    loadAllTraces();
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
      TraceType.PROTO_LOG,
      TraceType.VIEW_CAPTURE,
    ]);
    await dom.openMatSelect();
    clickTraceFromSelectPanel(3);
    clickTraceFromSelectPanel(4);
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
    ]);

    const store = component.store();
    resetDom(store);
    loadSfWmTraces();
    expectSelectedTraceTypes([
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
    ]);

    resetDom(store);
    loadAllTraces();
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
    ]);
  });

  it('shows all traces in new session that were not present (so not deselected) in previous session', async () => {
    loadSfWmTraces();
    expectSelectedTraceTypes([
      TraceType.SURFACE_FLINGER,
      TraceType.WINDOW_MANAGER,
    ]);
    await dom.openMatSelect();
    clickTraceFromSelectPanel(1);
    expectSelectedTraceTypes([TraceType.SURFACE_FLINGER]);

    const store = component.store();
    resetDom(store);
    loadAllTraces();
    expectSelectedTraceTypes([
      TraceType.SCREEN_RECORDING,
      TraceType.SURFACE_FLINGER,
      TraceType.PROTO_LOG,
      TraceType.VIEW_CAPTURE,
    ]);
  });

  it('toggles bookmark of current position', () => {
    loadSfWmTraces();
    const emitEventSpy = jasmine.createSpy('emitEvent');
    component.setEmitEvent(emitEventSpy);

    expect(component.bookmarks).toEqual([]);
    expect(component.currentPositionBookmarked()).toBeFalse();

    const bookmarkIcon = dom.findAndClick('.bookmark-icon');

    expect(component.bookmarks).toEqual([time100]);
    expect(component.currentPositionBookmarked()).toBeTrue();
    let event = emitEventSpy.calls.mostRecent().args[0];
    expect(event).toBeInstanceOf(BookmarksChanged);
    expect(event.bookmarks).toEqual([time100]);

    bookmarkIcon.click();
    expect(component.bookmarks).toEqual([]);
    expect(component.currentPositionBookmarked()).toBeFalse();
    event = emitEventSpy.calls.mostRecent().args[0];
    expect(event).toBeInstanceOf(BookmarksChanged);
    expect(event.bookmarks).toEqual([]);
  });

  it('toggles same bookmark if click within range', () => {
    loadTracesWithLargeTimeRange();

    expect(component.bookmarks.length).toBe(0);

    openContextMenu();
    clickToggleBookmarkOption();
    expect(component.bookmarks.length).toBe(1);

    // click within marker y-pos, x-pos close enough to remove bookmark
    openContextMenu(5);
    clickToggleBookmarkOption();
    expect(component.bookmarks.length).toBe(0);

    openContextMenu();
    clickToggleBookmarkOption();
    expect(component.bookmarks.length).toBe(1);

    // click within marker y-pos, x-pos too large so new bookmark added
    openContextMenu(20);
    clickToggleBookmarkOption();
    expect(component.bookmarks.length).toBe(2);

    openContextMenu(20);
    clickToggleBookmarkOption();
    expect(component.bookmarks.length).toBe(1);

    // click below marker y-pos, x-pos now too large so new bookmark added
    openContextMenu(5, true);
    clickToggleBookmarkOption();
    expect(component.bookmarks.length).toBe(2);
  });

  it('removes all bookmarks', () => {
    loadSfWmTraces();
    const emitEventSpy = jasmine.createSpy('emitEvent');
    component.setEmitEvent(emitEventSpy);

    component.bookmarks = [time100, time101, time112];
    dom.detectChanges();

    openContextMenu();
    clickRemoveAllBookmarksOption();
    expect(component.bookmarks).toEqual([]);
    const event = emitEventSpy.calls.mostRecent().args[0];
    expect(event).toBeInstanceOf(BookmarksChanged);
    expect(event.bookmarks).toEqual([]);
  });

  it('updates active trace then trace position on mini timeline click', async () => {
    loadAllTraces();

    let firstEvent: WinscopeEvent | undefined;
    let activeTrace: Trace<unknown> | undefined;
    let position: TracePosition | undefined;
    component.setEmitEvent(async (event: WinscopeEvent) => {
      if (!firstEvent) {
        expect(event).toBeInstanceOf(ActiveTraceChanged);
        firstEvent = event;
        activeTrace = (event as ActiveTraceChanged).trace;
      } else {
        expect(event).toBeInstanceOf(TracePositionUpdate);
        position = (event as TracePositionUpdate).position;
      }
    });
    const miniTimelineComponent = assertDefined(component.miniTimeline());
    const trace = assertDefined(
      component
        .timelineData()
        .getTraces()
        .getTrace<HierarchyTreeNode>(TraceType.WINDOW_MANAGER),
    );
    spyOn(
      assertDefined(miniTimelineComponent.drawer),
      'getTraceClicked',
    ).and.returnValue(Promise.resolve(trace));
    const canvas = miniTimelineComponent.getCanvas();
    canvas.dispatchEvent(new MouseEvent('mousedown'));
    await dom.detectChangesAndWaitStable();
    await dom.detectChangesAndWaitStable();

    expect(activeTrace).toEqual(trace);
    expect(position).toBeDefined();
  });

  it('adds/removes trace and redraws timeline', async () => {
    loadSfWmTraces();
    const initialTraces = component.sortedTraces.slice();

    await dom.openMatSelect();
    dom.getMatSelectPanel().findAndClickByIndex('mat-option', 1);
    expectSelectedTraceTypes([TraceType.SURFACE_FLINGER]);

    const spy = spyOn(assertDefined(component.miniTimeline()?.drawer), 'draw');
    const trace = makeEmptyTrace<HierarchyTreeNode>(TraceType.SEARCH);

    await component.onWinscopeEvent(new TraceAddRequest(trace));
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(component.sortedTraces).not.toEqual(initialTraces);
    expect(component.sortedTraces[0]).toEqual(trace);
    expectSelectedTraceTypes([TraceType.SEARCH, TraceType.SURFACE_FLINGER]);

    await component.onWinscopeEvent(new TraceRemoveRequest(trace));
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(component.sortedTraces).toEqual(initialTraces);
    expectSelectedTraceTypes([TraceType.SURFACE_FLINGER]);
  });

  it('disables or enables timeline on winscope events', async () => {
    loadSfWmTraces();
    checkTimelineEnabled();

    await component.onWinscopeEvent(new InitializeTraceSearchRequest());
    checkTimelineDisabled();
    await component.onWinscopeEvent(new TraceSearchInitialized([]));
    checkTimelineEnabled();

    await component.onWinscopeEvent(new TraceSearchRequest(''));
    checkTimelineDisabled();
    await component.onWinscopeEvent(new TraceSearchCompleted());
    checkTimelineEnabled();
  });

  it('does not handle arrow key presses if component disabled', () => {
    loadSfWmTraces();
    component.isDisabled = true;
    dom.detectChanges();

    const spyNextEntry = spyOn(component, 'moveToNextEntry');
    dom.keydownArrowRight(true);
    expect(spyNextEntry).not.toHaveBeenCalled();
  });

  it('redraws both timelines on scroll', () => {
    loadSfWmTraces();
    openExpandedTimeline();
    dom.get('single-timeline').getHTMLElement().style.maxWidth = '500px';
    dom.detectChanges();
    const expandedDrawSpy = spyOn(CanvasDrawer.prototype, 'drawRect');
    const miniDrawSpy = spyOn(MiniTimelineDrawerImpl.prototype, 'draw');

    // scroll from expanded timeline
    const wheelEvent = new WheelEvent('wheel');
    spyOnProperty(wheelEvent, 'deltaY').and.returnValue(-200);
    spyOnProperty(wheelEvent, 'deltaX').and.returnValue(0);
    spyOnProperty(wheelEvent, 'y').and.returnValue(10);
    dom.get('single-timeline').dispatchEvent(wheelEvent);
    expect(expandedDrawSpy).toHaveBeenCalledTimes(5); // 3 entries total + 2 selected
    expect(miniDrawSpy).toHaveBeenCalledTimes(1); // all on one canvas so spy called once

    // scroll from mini timeline
    expandedDrawSpy.calls.reset();
    miniDrawSpy.calls.reset();
    spyOnProperty(wheelEvent, 'target').and.returnValue(
      dom.get('#mini-timeline-canvas').getHTMLElement(),
    );
    dom.get('mini-timeline').dispatchEvent(wheelEvent);
    expect(expandedDrawSpy).toHaveBeenCalledTimes(4); // 2 entries total + 2 selected
    expect(miniDrawSpy).toHaveBeenCalledTimes(1);
  });

  it('redraws both timelines on new position from expanded timeline click', () => {
    loadSfWmTraces();
    openExpandedTimeline();
    const expandedDrawSpy = spyOn(CanvasDrawer.prototype, 'drawRect');
    const miniDrawSpy = spyOn(MiniTimelineDrawerImpl.prototype, 'draw');

    const clickEvent = new MouseEvent('mousedown');
    spyOnProperty(clickEvent, 'offsetX').and.returnValue(0);
    spyOnProperty(clickEvent, 'offsetY').and.returnValue(0);
    dom.get('single-timeline #canvas').dispatchEvent(clickEvent);
    expect(expandedDrawSpy).toHaveBeenCalledTimes(3); // redraws SF timeline row
    expect(miniDrawSpy).toHaveBeenCalledTimes(1); // all on one canvas so spy called once
  });

  it('does not show screen recording content in expanded timeline overlay', () => {
    loadSfWmTraces();
    openExpandedTimeline();
    expect(dom.find('#video-content')).toBeUndefined();
  });

  it('shows screen recording placeholder in expanded timeline overlay', () => {
    loadAllTraces();
    openExpandedTimeline();
    dom.get('.no-video-message').checkText('No screen recording frame to show');
  });

  it('shows screen recording video in expanded timeline overlay', async () => {
    loadAllTraces();
    await dom.whenStable();

    openExpandedTimeline();
    await dom.whenStable();
    await dom.whenRenderingDone();
    expect(dom.find('#video-content #video')).toBeDefined();
    expect(dom.find('#frameCanvasElementTimeline')).toBeUndefined();
  });

  it('shows screen recording canvas in expanded timeline overlay', async () => {
    loadAllTraces();
    await dom.whenStable();

    openExpandedTimeline();
    await dom.whenStable();
    await dom.whenRenderingDone();
    expect(dom.find('#video-content #video')).toBeDefined();
    expect(dom.find('#frameCanvasElementTimeline')).toBeUndefined();

    const frame = jasmine.createSpyObj<ImageBitmap>('frame', [], {
      width: 4,
      height: 10,
    });
    const canvasEntry = new CanvasEntry(frame);
    const drawSpy = spyOn(canvasEntry.frame, 'tryDrawOnCanvas');
    const mockSrEntry = jasmine.createSpyObj<
      TraceEntry<MediaBasedTraceEntry, Promise<CanvasEntry>>
    >('entry', ['getValue']);
    mockSrEntry.getValue.and.returnValue(Promise.resolve(canvasEntry));

    await component.onWinscopeEvent(
      new TracePositionUpdate(position110, undefined, {
        trace: undefined,
        seek: time110,
        screenRecording: mockSrEntry,
      }),
    );
    expect(dom.find('#video-content #video')).toBeUndefined();
    expect(dom.find('#frameCanvasElementTimeline')).toBeDefined();
    expect(drawSpy).toHaveBeenCalledTimes(1);

    await component.onWinscopeEvent(
      new TracePositionUpdate(position110, undefined),
    );
    expect(dom.find('#video-content #video')).toBeDefined();
    expect(dom.find('#frameCanvasElementTimeline')).toBeUndefined();
  });

  it('updates seek position based on trace position update', async () => {
    loadAllTraces();
    expect(component.getCurrentTracePosition().timestamp).toEqual(time100);

    await component.onWinscopeEvent(
      new TracePositionUpdate(position100, undefined, {
        trace: undefined,
        seek: time112,
        screenRecording: undefined,
      }),
    );
    expect(component.getCurrentTracePosition().timestamp).toEqual(time112);

    await component.onWinscopeEvent(
      new TracePositionUpdate(position100, undefined),
    );
    expect(component.getCurrentTracePosition().timestamp).toEqual(time100);
  });

  it('shows hover timestamp', () => {
    loadSfWmTraces();
    const hoverPreview = dom.get('.hover-preview').getHTMLElement();
    expect(hoverPreview.style.display).toBe('none');

    const ts = converter.makeTimestampFromRealNs(5025789000000n);
    const miniTimeline = assertDefined(component.miniTimeline());
    miniTimeline.onHoverPositionUpdate.emit({posX: 10, ts, xRatio: 0.1});
    dom.detectChanges();

    expect(hoverPreview.style.display).not.toBe('none');
    const hoverTs = dom.get('.hover-timestamp');
    hoverTs.checkTextExact('01:23:45.789');
    expect(dom.find('#thumbnail-video')).toBeUndefined();
  });

  it('shows hover video thumbnail', async () => {
    const thumbnail = new Thumbnail(10, 2, 4, new Blob(), 2, 40);
    const entry = new VideoEntry(new Blob(), 0, thumbnail);
    const srTrace = new TraceBuilder<MediaBasedTraceEntry>()
      .setType(TraceType.SCREEN_RECORDING)
      .setDescriptors(['mock_screen_recording'])
      .setTimestamps([time100, time105, time110])
      .setEntries([entry, entry, entry])
      .build();
    loadAllTraces(undefined, srTrace);
    await dom.whenStable();
    const hoverPreview = dom.get('.hover-preview').getHTMLElement();
    expect(hoverPreview.style.display).toBe('none');

    const miniTimeline = assertDefined(component.miniTimeline());
    miniTimeline.onHoverPositionUpdate.emit({
      posX: 10,
      ts: time105,
      xRatio: 0.5,
    });
    dom.detectChanges();

    expect(hoverPreview.style.display).not.toBe('none');
    const thumbnailVideo = dom.get('#thumbnail-video').getHTMLElement();
    expect(thumbnailVideo.style.backgroundImage).toMatch(/url\("blob:.*"\)/);
    expect(thumbnailVideo.style.backgroundSize).toEqual('1500px 75px');
    expect(thumbnailVideo.style.backgroundPosition).toEqual('-450px 0px');

    openExpandedTimeline();
    expect(dom.find('#thumbnail-video')).toBeUndefined();
  });

  describe('playback controls', () => {
    let emitEventSpy: jasmine.Spy;

    beforeEach(() => {
      dom.setComponentInput('initialTabTraceType', TraceType.SURFACE_FLINGER);
      loadSfWmTraces();

      emitEventSpy = jasmine.createSpy('emitEvent');
      component.setEmitEvent(emitEventSpy);
    });

    it('disables timeline component on playback initialization', () => {
      component.playbackState = PlaybackState.PAUSED;
      dom.keydownSpace();
      expect(component.isDisabled).toEqual(true);
    });

    it('starts playback on space click', () => {
      component.playbackState = PlaybackState.PAUSED;

      dom.keydownSpace();
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
      expect(emitEventSpy).toHaveBeenCalledWith(
        new PlaybackStateChangeRequest(
          TraceType.SURFACE_FLINGER,
          PlaybackState.FORWARDS,
          0,
        ),
      );
    });

    it('starts playback backwards on space click if previously playing backwards', async () => {
      await component.onWinscopeEvent(
        new PlaybackStateChangeHandled(PlaybackState.BACKWARDS),
      );
      await component.onWinscopeEvent(
        new PlaybackStateChangeHandled(PlaybackState.PAUSED),
      );

      dom.keydownSpace();
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
      expect(emitEventSpy).toHaveBeenCalledWith(
        new PlaybackStateChangeRequest(
          TraceType.SURFACE_FLINGER,
          PlaybackState.BACKWARDS,
          0,
        ),
      );
    });

    it('stops playback on space click if already playing', () => {
      component.playbackState = PlaybackState.FORWARDS;

      dom.keydownSpace();
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
      expect(emitEventSpy).toHaveBeenCalledWith(
        new PlaybackStateChangeRequest(
          TraceType.SURFACE_FLINGER,
          PlaybackState.PAUSED,
        ),
      );
    });

    it('starts playing backwards on media track previous click', () => {
      dom.keydownMediaTrackPrevious(true);
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
      expect(emitEventSpy).toHaveBeenCalledWith(
        new PlaybackStateChangeRequest(
          TraceType.SURFACE_FLINGER,
          PlaybackState.BACKWARDS,
          0,
        ),
      );
    });

    it('changes playback direction to backwards on media track previous click', () => {
      component.playbackState = PlaybackState.FORWARDS;
      dom.keydownMediaTrackPrevious(true);
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
      expect(emitEventSpy).toHaveBeenCalledWith(
        new PlaybackStateChangeRequest(
          TraceType.SURFACE_FLINGER,
          PlaybackState.BACKWARDS,
          0,
        ),
      );
    });

    it('does not send event on media track previous click if already playing backwards', () => {
      dom.keydownMediaTrackPrevious(true);
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
      dom.keydownMediaTrackPrevious(true);
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
    });

    it('starts playing forwards on media track next click', () => {
      dom.keydownMediaTrackNext(true);
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
      expect(emitEventSpy).toHaveBeenCalledWith(
        new PlaybackStateChangeRequest(
          TraceType.SURFACE_FLINGER,
          PlaybackState.FORWARDS,
          0,
        ),
      );
    });

    it('changes playback direction to forwards on media track next click', () => {
      component.playbackState = PlaybackState.BACKWARDS;
      dom.keydownMediaTrackNext(true);
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
      expect(emitEventSpy).toHaveBeenCalledWith(
        new PlaybackStateChangeRequest(
          TraceType.SURFACE_FLINGER,
          PlaybackState.FORWARDS,
          0,
        ),
      );
    });

    it('does not send event on media track next click if already playing backwards', () => {
      dom.keydownMediaTrackNext(true);
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
      dom.keydownMediaTrackNext(true);
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
    });

    it('does not handle arrow key presses if playback is playing', () => {
      component.playbackState = PlaybackState.FORWARDS;
      dom.detectChanges();

      const spyNextEntry = spyOn(component, 'moveToNextEntry');
      const spyPrevEntry = spyOn(component, 'moveToPreviousEntry');

      dom.keydownArrowRight(true);
      expect(spyNextEntry).not.toHaveBeenCalled();

      dom.keydownArrowLeft(true);
      expect(spyPrevEntry).not.toHaveBeenCalled();
    });

    it('prev and next button disabled on playback active', async () => {
      await updateActiveTrace(TraceType.WINDOW_MANAGER);
      const prevEntryButton = dom.get(prevEntrySelector);
      const nextEntryButton = dom.get(nextEntrySelector);
      nextEntryButton.click();
      prevEntryButton.checkDisabled(false);
      nextEntryButton.checkDisabled(false);

      component.playbackState = PlaybackState.FORWARDS;
      dom.detectChanges();
      prevEntryButton.checkDisabled(true);
      nextEntryButton.checkDisabled(true);

      component.playbackState = PlaybackState.PAUSED;
      dom.detectChanges();
      prevEntryButton.checkDisabled(false);
      nextEntryButton.checkDisabled(false);
    });

    it('emits PlaybackSpeedChange event', async () => {
      const emitEventSpy = jasmine.createSpy('emitEvent');
      component.setEmitEvent(emitEventSpy);

      await dom.openMatSelect();
      const selectPanel = dom.getMatSelectPanel();
      await selectPanel.clickByIndexAndWaitStable('mat-option', 3);
      const event = emitEventSpy.calls.mostRecent().args[0];
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
      expect(event).toBeInstanceOf(PlaybackSpeedChange);
    });

    it('handles PlaybackStateChangeHandled event', async () => {
      const emitEventSpy = jasmine.createSpy('emitEvent');
      component.setEmitEvent(emitEventSpy);

      dom.findAndClick('playback-controls #start-playback-button');
      const event = emitEventSpy.calls.mostRecent().args[0];
      expect(event.state).toEqual(PlaybackState.FORWARDS);
      await component.onWinscopeEvent(
        new PlaybackStateChangeHandled(event.state),
      );
      expect(component.playbackState).toEqual(event.state);
    });

    it('emits PlaybackStateChangeRequest event on a playback button clicked', () => {
      const emitEventSpy = jasmine.createSpy('emitEvent');
      component.setEmitEvent(emitEventSpy);

      dom.findAndClick('playback-controls #start-playback-button');
      expect(emitEventSpy).toHaveBeenCalledTimes(1);
      const event = emitEventSpy.calls.mostRecent().args[0];
      expect(event).toBeInstanceOf(PlaybackStateChangeRequest);
      expect(event.state).toEqual(PlaybackState.FORWARDS);
      expect(event.traceType).toEqual(TraceType.SURFACE_FLINGER);
    });

    it('emits PlaybackStateChangeRequest on position update during playback', async () => {
      const emitEventSpy = jasmine.createSpy('emitEvent');
      component.setEmitEvent(emitEventSpy);

      await component.onWinscopeEvent(
        new PlaybackStateChangeHandled(PlaybackState.BACKWARDS),
      );
      await component.updatePosition(TracePosition.fromTimestamp(time110));
      expect(emitEventSpy).toHaveBeenCalledOnceWith(
        new PlaybackStateChangeRequest(
          TraceType.SURFACE_FLINGER,
          PlaybackState.BACKWARDS,
          1,
        ),
      );
    });

    it('emits PlaybackStateChangeRequest event with current index of trace', () => {
      checkIndexOfStateChangeRequest(1, 1);
    });

    it('emits PlaybackStateChangeRequest event with first index of trace if no current entry found', () => {
      checkIndexOfStateChangeRequest(undefined, 0);
    });

    function checkIndexOfStateChangeRequest(
      currentIndex: number | undefined,
      expectedIndex: number,
    ) {
      const emitEventSpy = jasmine.createSpy('emitEvent');
      component.setEmitEvent(emitEventSpy);

      const trace = assertDefined(
        component
          .allTraces()
          .getTrace<HierarchyTreeNode>(TraceType.SURFACE_FLINGER),
      );
      spyOn(component.timelineData(), 'findCurrentEntryFor')
        .withArgs(trace)
        .and.returnValue(
          currentIndex !== undefined ? trace.getEntry(currentIndex) : undefined,
        );

      dom.findAndClick('playback-controls #start-playback-button');
      const event = emitEventSpy.calls.mostRecent().args[0];
      expect(event.currentTraceIndex).toEqual(expectedIndex);
    }
  });

  function loadSfWmTraces(c = component, domHelper = dom) {
    const traces = new TracesBuilder()
      .setTimestamps(TraceType.SURFACE_FLINGER, [time100, time110])
      .setTimestamps(TraceType.WINDOW_MANAGER, [
        time90,
        time101,
        time110,
        time112,
      ])
      .build();

    const timelineData = c.timelineData();
    timelineData.initialize(traces, undefined, converter);
    timelineData.setPosition(position100);
    domHelper.setComponentInput('allTraces', c.timelineData().getTraces());
    domHelper.detectChanges();
  }

  function loadAllTraces(
    loadAllTraces = true,
    srTrace?: Trace<MediaBasedTraceEntry>,
  ) {
    const builder = new TracesBuilder()
      .setTimestamps(TraceType.SURFACE_FLINGER, [time100, time110])
      .setTimestamps(TraceType.WINDOW_MANAGER, [
        time90,
        time101,
        time110,
        time112,
      ])
      .setTimestamps(TraceType.PROTO_LOG, [time100])
      .setTimestamps(
        TraceType.VIEW_CAPTURE,
        [time100],
        ['Test Window', 'mock_view_capture'],
      );
    if (srTrace === undefined) {
      builder
        .setTimestamps(
          TraceType.SCREEN_RECORDING,
          [time110],
          ['mock_screen_recording'],
        )
        .setEntries(TraceType.SCREEN_RECORDING, [
          new VideoEntry(new Blob(), 0),
        ]);
    }

    const traces = builder.build();

    if (srTrace !== undefined) {
      traces.addTrace(srTrace);
    }

    let timelineDataTraces: Traces;
    if (loadAllTraces) {
      timelineDataTraces = traces;
    } else {
      timelineDataTraces = new Traces();
      traces.forEachTrace((trace) => {
        if (trace.type !== TraceType.PROTO_LOG) {
          timelineDataTraces.addTrace(trace);
        }
      });
    }

    component
      .timelineData()
      .initialize(timelineDataTraces, undefined, converter);
    dom.setComponentInput('allTraces', traces);
    dom.detectChanges();
  }

  function loadTracesWithLargeTimeRange() {
    const traces = new TracesBuilder()
      .setTimestamps(TraceType.SURFACE_FLINGER, [
        time100,
        time2000,
        time3000,
        time4000,
      ])
      .setTimestamps(TraceType.WINDOW_MANAGER, [
        time2000,
        time4000,
        time6000,
        time8000,
      ])
      .build();

    const timelineData = component.timelineData();
    timelineData.initialize(traces, undefined, converter);
    timelineData.setPosition(position100);
    dom.setComponentInput('allTraces', timelineData.getTraces());
    dom.detectChanges();
  }

  function getLoadedTrace(type: TraceType): Trace<unknown> {
    const timelineData = component.timelineData();
    return assertDefined(timelineData.getTraces().getTrace(type));
  }

  async function loadTracesWithOneTimestamp(c = component, domHelper = dom) {
    const traces = new TracesBuilder()
      .setTimestamps(TraceType.SURFACE_FLINGER, [])
      .setTimestamps(TraceType.WINDOW_MANAGER, [time100])
      .build();
    c.timelineData().initialize(traces, undefined, converter);
    domHelper.setComponentInput('allTraces', traces);
    await domHelper.detectChangesAndWaitStable();
    domHelper.detectChanges();
  }

  async function updateActiveTrace(type: TraceType) {
    const trace = getLoadedTrace(type);
    component.timelineData().trySetActiveTrace(trace);

    await component.onWinscopeEvent(new ActiveTraceChanged(trace));
  }

  function expectSelectedTraceTypes(
    expected: TraceType[],
    c: TimelineComponent = component,
  ) {
    const actual = c.selectedTraces().map((trace) => trace.type);
    expect(actual).toEqual(expected);
  }

  function testCurrentTimestampOnButtonClick(
    button: DOMTestHelper<TimelineComponent>,
    pos: TracePosition,
    expectedNs: bigint,
  ) {
    const timelineData = component.timelineData();
    timelineData.setPosition(pos);
    dom.detectChanges();
    button.click();
    expect(timelineData.getCurrentPosition()?.timestamp.getValueNs()).toEqual(
      expectedNs,
    );
  }

  function testCurrentTimestampOnTimeInput(
    inputField: DOMTestHelper<TimelineComponent>,
    pos: TracePosition,
    textInput: string,
    expectedNs: bigint,
  ) {
    const timelineData = component.timelineData();
    timelineData.setPosition(pos);
    dom.detectChanges();

    inputField.updateValue(textInput);
    inputField.dispatchEvent(new Event('change'));

    expect(timelineData.getCurrentPosition()?.timestamp.getValueNs()).toEqual(
      expectedNs,
    );
  }

  function clickTraceFromSelectPanel(index: number) {
    dom.getMatSelectPanel().findAndClickByIndex('mat-option', index);
  }

  function checkActiveTraceSurfaceFlinger(
    nextEntryButton: DOMTestHelper<TimelineComponent>,
    prevEntryButton: DOMTestHelper<TimelineComponent>,
  ) {
    testCurrentTimestampOnButtonClick(prevEntryButton, position110, 100n);
    prevEntryButton.checkDisabled(true);
    nextEntryButton.checkDisabled(false);
    testCurrentTimestampOnButtonClick(nextEntryButton, position100, 110n);
    prevEntryButton.checkDisabled(false);
    nextEntryButton.checkDisabled(true);
  }

  function checkActiveTraceWindowManager(
    nextEntryButton: DOMTestHelper<TimelineComponent>,
    prevEntryButton: DOMTestHelper<TimelineComponent>,
  ) {
    testCurrentTimestampOnButtonClick(prevEntryButton, position90, 90n);
    prevEntryButton.checkDisabled(true);
    nextEntryButton.checkDisabled(false);
    testCurrentTimestampOnButtonClick(nextEntryButton, position90, 101n);
    prevEntryButton.checkDisabled(false);
    nextEntryButton.checkDisabled(false);
    testCurrentTimestampOnButtonClick(nextEntryButton, position110, 112n);
    prevEntryButton.checkDisabled(false);
    nextEntryButton.checkDisabled(true);
  }

  function checkActiveTraceHasOneEntry(
    nextEntryButton: DOMTestHelper<TimelineComponent>,
    prevEntryButton: DOMTestHelper<TimelineComponent>,
  ) {
    prevEntryButton.checkDisabled(true);
    nextEntryButton.checkDisabled(true);
  }

  function checkNoTimelineNavigation() {
    // no expand button
    expect(dom.find(`.${component.TOGGLE_BUTTON_CLASS}`)).toBeUndefined();

    // no timelines shown
    const miniTimelineElement = dom.findByDirective(MiniTimelineComponent);
    expect(miniTimelineElement).toBeUndefined();

    // arrow key presses don't do anything
    const spyNextEntry = spyOn(component, 'moveToNextEntry');
    const spyPrevEntry = spyOn(component, 'moveToPreviousEntry');

    dom.keydownArrowRight(true);
    expect(spyNextEntry).not.toHaveBeenCalled();

    dom.keydownArrowLeft(true);
    expect(spyPrevEntry).not.toHaveBeenCalled();
  }

  function openContextMenu(xOffset = 0, clickBelowMarker = false) {
    const miniTimelineCanvas = dom.get('#mini-timeline-canvas');
    const canvasEl = miniTimelineCanvas.getHTMLElement();
    const yOffset = clickBelowMarker
      ? assertDefined(component.miniTimeline()?.drawer?.getHeight()) / 6 + 1
      : 0;

    const event = new MouseEvent('contextmenu');
    spyOnProperty(event, 'offsetX').and.returnValue(
      canvasEl.offsetLeft + canvasEl.offsetWidth / 2 + xOffset,
    );
    spyOnProperty(event, 'offsetY').and.returnValue(
      canvasEl.offsetTop + yOffset,
    );
    miniTimelineCanvas.dispatchEvent(event);
  }

  function clickToggleBookmarkOption() {
    const menu = dom.getInDocument('.context-menu');
    menu.findAndClick('.context-menu-item');
  }

  function clickRemoveAllBookmarksOption() {
    const menu = dom.getInDocument('.context-menu');
    menu.findAndClickByIndex('.context-menu-item', 1);
  }

  function checkTimelineEnabled() {
    expect(dom.find('.disabled-component')).toBeUndefined();
    expect(dom.find('.disabled-message')).toBeUndefined();
  }

  function checkTimelineDisabled() {
    expect(dom.find('.disabled-component')).toBeDefined();
    expect(dom.find('.disabled-message')).toBeDefined();
  }

  function openExpandedTimeline() {
    dom.findAndClick(`.${component.TOGGLE_BUTTON_CLASS}`);
  }

  function resetDom(store: Store) {
    const fixture = TestBed.createComponent(TimelineComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('timelineData', new TimelineData());
    dom.setComponentInput('allTraces', new Traces());
    dom.setComponentInput('store', store);
  }
});

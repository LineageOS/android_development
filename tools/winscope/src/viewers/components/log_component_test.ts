/*
 * Copyright (C) 2024 The Android Open Source Project
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

import {Clipboard, ClipboardModule} from '@angular/cdk/clipboard';
import {CdkMenuModule} from '@angular/cdk/menu';
import {ScrollingModule} from '@angular/cdk/scrolling';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatPseudoCheckboxModule} from '@angular/material/core';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {assertDefined} from '@common/assert';
import {KeyboardEventKey} from '@common/dom';
import {makeElapsedTimestamp, makeRealTimestamp,} from '@common/time/test_helpers';
import {Timestamp} from '@common/time/time';
import {DOMTestHelper} from '@test/unit/common/dom_test_helpers';
import {TraceBuilder} from '@test/unit/trace_api/trace_builder';
import {TraceEntry} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {LogSelectFilter, LogTextFilter} from '@viewers/common/log_filters';
import {TextFilter} from '@viewers/common/text_filter';
import {ColumnSpec, LogEntry, LogField, LogHeader,} from '@viewers/common/ui_data_log';
import {VariableHeightScrollDirective} from '@viewers/common/variable_height_scroll_directive';
import {LogFilterChangeDetail, LogTextFilterChangeDetail, TimestampClickDetail, ViewerEvents,} from '@viewers/common/viewer_events';
import {CollapsedSectionsComponent} from '@viewers/components/collapsed_sections_component';
import {CollapsibleSectionTitleComponent} from '@viewers/components/collapsible_section_title_component';
import {PropertiesComponent} from '@viewers/components/properties_component';
import {SearchBoxComponent} from '@viewers/components/search_box_component';
import {SelectWithFilterComponent} from '@viewers/components/select_with_filter_component';

import {LogComponent} from './log_component';

describe('LogComponent', () => {
  const testColumn1: ColumnSpec = {name: 'test1', cssClass: 'test-1'};
  const testColumn2: ColumnSpec = {name: 'test2', cssClass: 'test-2'};
  const testColumn3: ColumnSpec = {name: 'test3', cssClass: 'test-3'};

  const tooltipMessage = 'Test tooltip message';

  let fixture: ComponentFixture<LogComponent>;
  let component: LogComponent;
  let dom: DOMTestHelper<LogComponent>;
  let mockCopyText: jasmine.Spy;

  beforeEach(async () => {
    mockCopyText = jasmine.createSpy();
    await TestBed.configureTestingModule({
      providers: [{provide: Clipboard, useValue: {copy: mockCopyText}}],
      imports: [
        ScrollingModule,
        MatFormFieldModule,
        FormsModule,
        MatInputModule,
        NoopAnimationsModule,
        MatSelectModule,
        MatDividerModule,
        MatButtonModule,
        MatIconModule,
        MatPseudoCheckboxModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        ClipboardModule,
        CdkMenuModule,
        LogComponent,
        SelectWithFilterComponent,
        CollapsedSectionsComponent,
        CollapsibleSectionTitleComponent,
        PropertiesComponent,
        SearchBoxComponent,
        VariableHeightScrollDirective,
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LogComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    await setComponentInputData();
    await dom.detectChangesAndWaitStable();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('renders filters', () => {
    expect(dom.findAll('.entries .filter').length).toBe(2);
  });

  it('renders entries', () => {
    const scroll = dom.get('.scroll');
    const entryText = scroll.get('.entry');
    entryText.checkText('Test tag');
    entryText.checkText('123');
    entryText.checkText('2ns');
  });

  it('emits event and scrolls to first entry on button click', () => {
    const spy = spyOn(component.scrollComponent(), 'scrollToIndex');
    let clicked: TraceEntry<unknown> | undefined;
    dom.addEventListener(ViewerEvents.TimestampClick, (event) => {
      clicked = (event as CustomEvent).detail.entry;
    });
    dom.findAndClick('.go-to-first-entry');
    expect(spy).toHaveBeenCalledWith(0);
    expect(clicked?.getIndex()).toBe(0);
  });

  it('scrolls to current entry on button click', () => {
    dom.setComponentInput('currentIndex', 1);
    dom.detectChanges();
    const spy = spyOn(component.scrollComponent(), 'scrollToIndex');
    dom.findAndClick('.go-to-current-entry');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('emits event and scrolls to last entry on button click', () => {
    const spy = spyOn(component.scrollComponent(), 'scrollToIndex');
    let clicked: TraceEntry<unknown> | undefined;
    dom.addEventListener(ViewerEvents.TimestampClick, (event) => {
      clicked = (event as CustomEvent).detail.entry;
    });
    dom.findAndClick('.go-to-last-entry');
    expect(spy).toHaveBeenCalledWith(1);
    expect(clicked?.getIndex()).toBe(1);
  });

  it('does not show time controls if flag not set', () => {
    dom.setComponentInput('showTraceEntryTimes', false);
    dom.detectChanges();
    expect(dom.find('.time-controls')).toBeUndefined();
  });

  it('does not show current time button if no header without filter and trace entry times flag not set', () => {
    dom.setComponentInput('showTraceEntryTimes', false);
    dom.detectChanges();
    expect(dom.find('.time-controls-trigger')).toBeUndefined();
  });

  it('does not show current time button if flag not set', () => {
    dom.setComponentInput('showTimeControls', false);
    dom.detectChanges();
    expect(dom.find('.time-controls-trigger')).toBeUndefined();
  });

  it('shows time controls menu if header without filter and trace entry times flag set', async () => {
    dom.setComponentInput('headers', [new LogHeader(testColumn1)]);
    dom.setComponentInput('showTraceEntryTimes', false);
    dom.detectChanges();
    expect(dom.findInDocument('.time-controls')).toBeUndefined();
    const trigger = dom.get('.time-controls-trigger');
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    dom.detectChanges();
    const menu = dom.getInDocument('.context-menu');
    expect(menu.find('.time-controls')).toBeDefined();
    menu.dispatchEvent(new MouseEvent('mouseleave'));
    dom.detectChanges();
    expect(dom.findInDocument('.time-controls')).toBeUndefined();
  });

  it('applies select filter correctly', async () => {
    const allEntries = component.entries().slice();
    dom.addEventListener(ViewerEvents.LogFilterChange, (event) => {
      const detail: LogFilterChangeDetail = (event as CustomEvent).detail;
      if (detail.value.length === 0) {
        dom.setComponentInput('entries', allEntries);
        return;
      }
      dom.setComponentInput(
        'entries',
        allEntries.filter((entry) => {
          const entryValue = assertDefined(
            entry.fields.find((f) => f.spec === detail.header.spec),
          ).value.toString();
          if (Array.isArray(detail.value)) {
            return detail.value.includes(entryValue);
          }
          return entryValue.includes(detail.value);
        }),
      );
    });
    expect(dom.findAll('.entry').length).toBe(2);
    await dom.openMatSelect();

    const firstOption = dom.getMatSelectPanel().get('mat-option');
    firstOption.click();
    expect(dom.findAll('.entry').length).toBe(1);

    firstOption.click();
    expect(dom.findAll('.entry').length).toBe(2);
  });

  it('applies text filter correctly', async () => {
    const allEntries = component.entries().slice();
    dom.addEventListener(ViewerEvents.LogTextFilterChange, (event) => {
      const detail: LogTextFilterChangeDetail = (event as CustomEvent).detail;
      if (detail.filter.filterString.length === 0) {
        dom.setComponentInput('entries', allEntries);
        return;
      }
      dom.setComponentInput(
        'entries',
        allEntries.filter((entry) => {
          const entryValue = assertDefined(
            entry.fields.find((f) => f.spec === detail.header.spec),
          ).value.toString();
          return entryValue.includes(detail.filter.filterString);
        }),
      );
    });
    expect(dom.findAll('.entry').length).toBe(2);

    const inputEl = dom.get('.headers input');

    inputEl.dispatchInput('123');
    expect(dom.findAll('.entry').length).toBe(2);

    inputEl.dispatchInput('1234');
    expect(dom.findAll('.entry').length).toBe(1);

    inputEl.dispatchInput('12345');
    expect(dom.findAll('.entry').length).toBe(0);

    inputEl.dispatchInput('');
    expect(dom.findAll('.entry').length).toBe(2);
  });

  it('emits event on arrow key press', () => {
    let downArrowPressedTimes = 0;
    dom.addEventListener(ViewerEvents.ArrowDownPress, (_) => {
      downArrowPressedTimes++;
    });
    let upArrowPressedTimes = 0;
    dom.addEventListener(ViewerEvents.ArrowUpPress, (_) => {
      upArrowPressedTimes++;
    });

    dom.keydownArrowUp(true);
    expect(upArrowPressedTimes).toBe(1);

    dom.keydownArrowDown(true);
    expect(downArrowPressedTimes).toBe(1);

    dom.keydownArrowUp(true);
    expect(upArrowPressedTimes).toBe(2);

    dom.keydownArrowDown(true);
    expect(downArrowPressedTimes).toBe(2);
  });

  it('propagates entry on trace entry timestamp click', () => {
    const logTimestampButton = dom.get(':not(.time-controls) .time-button');
    checkEntryPropagatedOnTimestampClick(logTimestampButton);
  });

  it('propagates entry on timestamp click with propagateEntryTimestamp set', () => {
    const logTimestampButton = dom.findAll(
      `.${testColumn3.cssClass} button`,
    )[1];
    checkEntryPropagatedOnTimestampClick(logTimestampButton);
  });

  it('propagates timestamp on raw timestamp click', async () => {
    // Force viewport layout update
    dom.detectChanges();
    await dom.whenRenderingDone();
    component.scrollComponent().checkViewportSize();
    dom.detectChanges();
    await dom.whenRenderingDone();

    let timestamp: Timestamp | undefined;
    dom.addEventListener(ViewerEvents.TimestampClick, (event) => {
      const detail: TimestampClickDetail = (event as CustomEvent).detail;
      timestamp = detail.timestamp;
    });
    dom.findAndClick(`.${testColumn3.cssClass} button`);
    expect(timestamp).toBeDefined();
  });

  it('does not show button for propagateEntryTimestamp field if entry timestamp invalid', () => {
    expect(dom.findAll(`.${testColumn3.cssClass} .time-button`).length).toEqual(
      2,
    );
    spyOn(
      component.entries()[1].traceEntry,
      'hasValidTimestamp',
    ).and.returnValue(false);
    dom.detectChanges();
    expect(dom.findAll(`.${testColumn3.cssClass} .time-button`).length).toEqual(
      1,
    );
  });

  it('changes css class on entry click and does not scroll', async () => {
    dom.addEventListener(ViewerEvents.LogEntryClick, (event) => {
      const index = (event as CustomEvent).detail;
      dom.setComponentInput('selectedIndex', index);
      dom.detectChanges();
    });

    const entry = dom.get('.entry[item-id="1"]');
    entry.checkClassName('selected', false);
    const spy = spyOn(component.scrollComponent(), 'scrollToIndex');
    entry.click();
    expect(spy).not.toHaveBeenCalled();
    entry.checkClassName('selected', true);
  });

  it('shows placeholder text', () => {
    expect(dom.find('.placeholder-text')).toBeUndefined();
    dom.setComponentInput('entries', []);
    dom.detectChanges();
    expect(dom.find('.placeholder-text')).toBeDefined();
    dom.setComponentInput('isFetchingData', true);
    dom.detectChanges();
    expect(dom.find('.placeholder-text')).toBeUndefined();
  });

  it('shows fetching data message', () => {
    expect(dom.find('.fetching-data')).toBeUndefined();
    dom.setComponentInput('isFetchingData', true);
    dom.detectChanges();
    expect(dom.find('.fetching-data')).toBeDefined();
  });

  it('formats timestamp without date unless multiple dates present', async () => {
    const entry = dom.get('.scroll .entry');
    entry.checkTextExact('1ns Test tag 1123 2ns');

    const spy = spyOn(component, 'areMultipleDatesPresent').and.returnValue(
      true,
    );
    dom.detectChanges();
    entry.checkTextExact('1ns Test tag 1123 2ns');

    await setComponentInputData(false);
    entry.checkTextExact('1970-01-01, 00:00:00.000 Test tag 21234 N/A');

    spy.and.returnValue(false);
    dom.detectChanges();
    entry.checkTextExact('00:00:00.000 Test tag 21234 N/A');
  });

  it('shows copy button for spec that can be copied', () => {
    const entry = dom.get('.scroll .entry .test-2');
    expect(entry.find('.copy-button')).toBeUndefined();
    component.entries()[0].fields[1].spec = {
      name: 'test2',
      cssClass: 'test-2',
      canCopy: true,
    };
    dom.detectChanges();
    entry.findAndClick('.copy-button');
    expect(mockCopyText).toHaveBeenCalledOnceWith('123');
  });

  it('propagates selected entry on keydown enter event', () => {
    let entry: TraceEntry<unknown> | undefined;
    dom.addEventListener(ViewerEvents.TimestampClick, (event) => {
      const detail: TimestampClickDetail = (event as CustomEvent).detail;
      entry = detail.entry;
    });
    const keydownEnter = new KeyboardEvent('keydown', {
      key: KeyboardEventKey.ENTER,
    });

    dom.setComponentInput('selectedIndex', undefined);
    dom.detectChanges();
    dom.dispatchEventInDocument(keydownEnter);
    expect(entry).toBeUndefined();

    dom.setComponentInput('selectedIndex', 1);
    dom.detectChanges();
    dom.dispatchEventInDocument(keydownEnter);
    expect(entry).toEqual(component.entries()[1].traceEntry);
  });

  it('checks scroll viewport size if flag set', () => {
    const spy = spyOn(
      component.scrollComponent(),
      'checkViewportSize',
    ).and.callThrough();

    dom.setComponentInput('checkScrollViewportCount', 1);
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);

    dom.setComponentInput('checkScrollViewportCount', 0);
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('checks scroll viewport size on window resize', () => {
    const spy = spyOn(
      component.scrollComponent(),
      'checkViewportSize',
    ).and.callThrough();
    window.dispatchEvent(new Event('resize'));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('scrolls to scrollToIndex - 1', () => {
    const spy = spyOn(
      component.scrollComponent(),
      'scrollToIndex',
    ).and.callThrough();

    dom.setComponentInput('scrollToIndex', 1);
    dom.detectChanges();
    expect(spy).toHaveBeenCalledOnceWith(0);
  });

  it('copies formatted log', () => {
    const onDocumentCopySpy = spyOn(
      component,
      'onDocumentCopy',
    ).and.callThrough();

    dom.setComponentInput('traceType', TraceType.PROTO_LOG);
    dom.detectChanges();

    const copyEvent = new ClipboardEvent('copy', {
      bubbles: true,
      composed: true,
    });

    const preventDefaultSpy = spyOn(copyEvent, 'preventDefault');
    const stopPropagationSpy = spyOn(copyEvent, 'stopPropagation');

    const entry = dom.findAndClick('.go-to-first-entry');

    entry.dispatchEvent(copyEvent);

    expect(onDocumentCopySpy).toHaveBeenCalledTimes(1);
    expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
    expect(stopPropagationSpy).toHaveBeenCalledTimes(1);
  });

  it('tooltip message correctly set', async () => {
    setTooltipInputData(tooltipMessage);

    dom.detectChanges();
    await dom.whenStable();

    const entry = dom.get('.field-value');
    await entry.checkTooltip(tooltipMessage);
  });

  it('tooltip message correctly undefined', async () => {
    setTooltipInputData(undefined);

    dom.detectChanges();
    await dom.whenStable();

    const entry = dom.get('.field-value');
    await entry.checkTooltip(undefined);
  });

  function setTooltipInputData(message: string | undefined) {
    const entryTime = makeElapsedTimestamp(1n);

    const fields: LogField[] = [
      {spec: testColumn1, value: 'Test tag 1', tooltip: message},
    ];

    const trace = new TraceBuilder<PropertyTreeNode>()
      .setTimestamps([entryTime, entryTime])
      .build();

    const entry: LogEntry = {
      traceEntry: trace.getEntry(0),
      fields,
      getPropertiesTree: undefined,
    };

    const headers = [
      new LogHeader(
        testColumn1,
        new LogSelectFilter(['Test tag 1', 'Test tag 2']),
      ),
    ];

    dom.setComponentInput('entries', [entry]);
    dom.setComponentInput('headers', headers);
    dom.setComponentInput('selectedIndex', 0);
    dom.setComponentInput('traceType', TraceType.CUJS);
  }

  async function setComponentInputData(elapsed = true) {
    let entryTime: Timestamp;
    let fieldTime: Timestamp;
    if (elapsed) {
      entryTime = makeElapsedTimestamp(1n);
      fieldTime = makeElapsedTimestamp(2n);
    } else {
      entryTime = makeRealTimestamp(1n);
      fieldTime = makeRealTimestamp(2n);
    }

    const fields1: LogField[] = [
      {spec: testColumn1, value: 'Test tag 1'},
      {spec: testColumn2, value: 123},
      {spec: testColumn3, value: fieldTime},
    ];
    const fields2 = [
      {spec: testColumn1, value: 'Test tag 2'},
      {spec: testColumn2, value: 1234},
      {spec: testColumn3, value: 'N/A', propagateEntryTimestamp: true},
    ];

    const trace = new TraceBuilder<PropertyTreeNode>()
      .setTimestamps([entryTime, entryTime])
      .build();

    const entry1: LogEntry = {
      traceEntry: trace.getEntry(0),
      fields: fields1,
      getPropertiesTree: undefined,
    };
    const entry2: LogEntry = {
      traceEntry: trace.getEntry(1),
      fields: fields2,
      getPropertiesTree: undefined,
    };

    const entries = [entry1, entry2];

    const headers = [
      new LogHeader(
        testColumn1,
        new LogSelectFilter(['Test tag 1', 'Test tag 2']),
      ),
      new LogHeader(testColumn2, new LogTextFilter(new TextFilter())),
    ];

    dom.setComponentInput('entries', entries);
    dom.setComponentInput('headers', headers);
    dom.setComponentInput('selectedIndex', 0);
    dom.setComponentInput('traceType', TraceType.CUJS);
    await dom.detectChangesAndWaitStable();
  }

  function checkEntryPropagatedOnTimestampClick(
    button: DOMTestHelper<LogComponent>,
  ) {
    let entry: TraceEntry<unknown> | undefined;
    dom.addEventListener(ViewerEvents.TimestampClick, (event) => {
      const detail: TimestampClickDetail = (event as CustomEvent).detail;
      entry = detail.entry;
    });
    button.click();
    expect(entry).toBeDefined();
  }
});

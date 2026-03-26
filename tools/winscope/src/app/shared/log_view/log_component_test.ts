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
import {CdkVirtualScrollViewport, ScrollingModule,} from '@angular/cdk/scrolling';
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
import {CollapsedSectionsComponent} from '@app/shared/collapsible_sections/collapsed_sections_component';
import {CollapsibleSectionTitleComponent} from '@app/shared/collapsible_sections/collapsible_section_title_component';
import {PropertiesComponent} from '@app/shared/properties/properties_component';
import {VirtualRow, VirtualScrollViewportComponent,} from '@app/shared/scroll/virtual_scroll_viewport_component';
import {SearchBoxComponent} from '@app/shared/search_box/search_box_component';
import {assertDefined} from '@common/assert';
import {KeyboardEventKey} from '@common/dom';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeElapsedTimestamp, makeRealTimestamp,} from '@common/time/testing/test_helpers';
import {Timestamp} from '@common/time/time';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {LogSelectFilter, LogTextFilter} from '@ui/shared/log/log_filters';
import {ColumnSpec, LogEntry, LogField, LogHeader,} from '@ui/shared/log/ui_data_log';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {LogFilterChangeDetail, LogTextFilterChangeDetail, TimestampClickDetail,} from '@ui/shared/viewers/viewer_event_details';

import {LogComponent} from './log_component';
import {SelectWithFilterComponent} from './select_with_filter_component';

describe('LogComponent', () => {
  const testColumn1: ColumnSpec = {
    name: 'test1',
    cssClass: 'test-1',
    canFilterBySingleOption: true,
  };
  const testColumn2: ColumnSpec = {
    name: 'test2',
    cssClass: 'test-2',
    canFilterBySingleOption: true,
  };
  const testColumn3: ColumnSpec = {name: 'test3', cssClass: 'test-3'};
  const testColumn4: ColumnSpec = {
    name: 'test4',
    cssClass: 'test-4',
    canFilterBySingleOption: true,
  };

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
        VirtualScrollViewportComponent,
        VirtualRow,
        CdkVirtualScrollViewport,
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
    expect(dom.findAll('.entries .filter').length).toBe(3);
  });

  it('renders entries', () => {
    const scroll = dom.get('.scroll');
    const entryText = scroll.get('.entry');
    entryText.checkText('Test tag');
    entryText.checkText('123');
    entryText.checkText('2ns');
  });

  it('emits event and scrolls to first entry on button click', () => {
    const spy = spyOn(component.virtualScrollViewport(), 'scrollToIndex');
    const timestampSpy = spyOn(component.timestampClick, 'emit');
    dom.findAndClick('.go-to-first-entry');
    expect(spy).toHaveBeenCalledWith(0);
    expect(timestampSpy).toHaveBeenCalledOnceWith(
      new TimestampClickDetail(component.entries()[0].traceEntry),
    );
  });

  it('scrolls to current entry on button click', () => {
    dom.setComponentInput('currentIndex', 1);
    dom.detectChanges();
    const spy = spyOn(component.virtualScrollViewport(), 'scrollToIndex');
    dom.findAndClick('.go-to-current-entry');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('emits event and scrolls to last entry on button click', () => {
    const spy = spyOn(component.virtualScrollViewport(), 'scrollToIndex');
    const timestampSpy = spyOn(component.timestampClick, 'emit');
    dom.findAndClick('.go-to-last-entry');
    expect(spy).toHaveBeenCalledWith(1);
    expect(timestampSpy).toHaveBeenCalledOnceWith(
      new TimestampClickDetail(component.entries()[1].traceEntry),
    );
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
    spyOn(component.logFilterChange, 'emit').and.callFake(
      (detail: LogFilterChangeDetail) => {
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
      },
    );
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
    spyOn(component.logTextFilterChange, 'emit').and.callFake(
      (detail: LogTextFilterChangeDetail) => {
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
      },
    );
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
    const arrowDownSpy = spyOn(component.arrowDownPress, 'emit');
    const arrowUpSpy = spyOn(component.arrowUpPress, 'emit');

    dom.keydownArrowUp(true);
    expect(arrowUpSpy).toHaveBeenCalledOnceWith();

    dom.keydownArrowDown(true);
    expect(arrowDownSpy).toHaveBeenCalledOnceWith();

    dom.keydownArrowUp(true);
    expect(arrowUpSpy).toHaveBeenCalledTimes(2);

    dom.keydownArrowDown(true);
    expect(arrowDownSpy).toHaveBeenCalledTimes(2);
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
    component.virtualScrollViewport().checkViewportSize();
    dom.detectChanges();
    await dom.whenRenderingDone();

    const spy = spyOn(component.timestampClick, 'emit');
    dom.findAndClick(`.${testColumn3.cssClass} button`);
    expect(spy).toHaveBeenCalledOnceWith(
      new TimestampClickDetail(undefined, makeElapsedTimestamp(2n)),
    );
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
    spyOn(component.logEntryClick, 'emit').and.callFake((index: number) => {
      dom.setComponentInput('selectedIndex', index);
      dom.detectChanges();
    });

    const entry = dom.get('.entry[item-id="1"]');
    entry.checkClassName('selected', false);
    const spy = spyOn(component.virtualScrollViewport(), 'scrollToIndex');
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
    const spy = spyOn(component, 'areMultipleDatesPresent').and.returnValue(
      true,
    );
    dom.detectChanges();
    const entry = dom.get('.scroll .entry');
    entry.get('.time').checkTextExact('1ns');
    entry.get('.test-3').checkTextExact('2ns');

    await setComponentInputData(false);
    entry.get('.time').checkTextExact('1970-01-01, 00:00:00.000');
    entry.get('.test-3').checkTextExact('1970-01-01, 00:00:00.000');

    spy.and.returnValue(false);
    await setComponentInputData(false);
    entry.get('.time').checkTextExact('00:00:00.000');
    entry.get('.test-3').checkTextExact('00:00:00.000');
  });

  it('shows copy button for spec that can be copied', () => {
    const entry = dom.get('.scroll .entry .test-2');
    expect(entry.find('.copy-button')).toBeUndefined();
    Object.assign(component.entries()[0].fields[1], {
      spec: {
        name: 'test2',
        cssClass: 'test-2',
        canCopy: true,
      },
    });
    dom.detectChanges();
    entry.findAndClick('.copy-button');
    expect(mockCopyText).toHaveBeenCalledOnceWith('123');
  });

  it('propagates selected entry on keydown enter event', () => {
    const spy = spyOn(component.timestampClick, 'emit');
    const keydownEnter = new KeyboardEvent('keydown', {
      key: KeyboardEventKey.ENTER,
    });

    dom.setComponentInput('selectedIndex', undefined);
    dom.detectChanges();
    dom.dispatchEventInDocument(keydownEnter);
    expect(spy).not.toHaveBeenCalled();

    dom.setComponentInput('selectedIndex', 1);
    dom.detectChanges();
    dom.dispatchEventInDocument(keydownEnter);
    expect(spy).toHaveBeenCalledOnceWith(
      new TimestampClickDetail(component.entries()[1].traceEntry),
    );
  });

  it('checks scroll viewport size if flag set', () => {
    const spy = spyOn(
      component.virtualScrollViewport(),
      'checkViewportSize',
    ).and.callThrough();

    dom.setComponentInput('checkScrollViewportCount', 1);
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);

    dom.setComponentInput('checkScrollViewportCount', 0);
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('scrolls to scrollToIndex - 1', () => {
    const spy = spyOn(
      component.virtualScrollViewport(),
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

    const entry1 = component.entries()[0];

    dom.setComponentInput('entries', [
      {
        traceEntry: entry1.traceEntry,
        fields: entry1.fields,
        getPropertiesTree: entry1.getPropertiesTree,
        formatForClipboard: (_: boolean) => 'formatted log',
      },
    ]);
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

  it('only shows context menu for field in column that can be filtered by single option', () => {
    const contextMenuTrigger = dom.get('.entry .test-3');
    contextMenuTrigger.openContextMenu();
    expect(dom.findInDocument('.context-menu')).toBeUndefined();
  });

  it('shows disabled message in context menu if filter not found', () => {
    const options = openContextMenuAndGetOptions('.entry .test-2');
    expect(options.length).toBe(1);
    expect(options[0].getText()).toBe('Filter disabled for this column.');
  });

  it('shows disabled message in context menu if filter disabled', () => {
    const filter = assertDefined(
      dom.findByDirective(SelectWithFilterComponent),
    );
    spyOn(filter, 'disabled').and.returnValue(true);
    const options = openContextMenuAndGetOptions('.entry .test-1');
    expect(options.length).toBe(1);
    expect(options[0].getText()).toBe('Filter disabled for this column.');
  });

  it('shows correct options for setting filter values', () => {
    const options = openContextMenuAndGetOptions('.entry[item-id="1"] .test-1');
    expect(options.length).toBe(2);
    expect(options[0].getText()).toBe('Exclude all "filterMatch" entries');
    expect(options[1].getText()).toBe('Show only "filterMatch" entries');
  });

  it('excludes filter match value from context menu', () => {
    const filter = dom.findByDirective(SelectWithFilterComponent);
    const option = openContextMenuAndGetOptions('.entry .test-1')[0];
    expect(option.getText()).toBe('Exclude all "Test tag 1" entries');
    option.click();
    expect(filter?.value()).toEqual(['Test tag 2']);
  });

  it('sets filter match value from context menu', () => {
    const filter = dom.findByDirective(SelectWithFilterComponent);
    const option = openContextMenuAndGetOptions(
      '.entry[item-id="1"] .test-1',
    )[1];
    expect(option.getText()).toBe('Show only "filterMatch" entries');
    option.click();
    expect(filter?.value()).toEqual(['filterMatch']);
  });

  it('sets filter match value for correct filter', () => {
    const filters = dom.findAllByDirective(SelectWithFilterComponent);
    expect(filters.length).toBe(2);
    const [filterCol1, filterCol4] = filters;
    expect(filterCol1.label()).toBe('test1');
    expect(filterCol4.label()).toBe('test4');
    expect(filterCol1.value()).toBeUndefined();
    expect(filterCol4.value()).toBeUndefined();

    const option = openContextMenuAndGetOptions('.entry .test-4')[0];
    expect(option.getText()).toBe('Exclude all "Test prop 1" entries');
    option.click();
    expect(filterCol1.value()).toBeUndefined();
    expect(filterCol4.value()).toEqual(['Test prop 2']);
  });

  function setTooltipInputData(message: string | undefined) {
    const entryTime = makeElapsedTimestamp(1n);

    const fields: LogField[] = [
      new LogField(
        testColumn1,
        'Test tag 1',
        undefined,
        undefined,
        undefined,
        message,
      ),
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
      new LogField(testColumn1, 'Test tag 1'),
      new LogField(testColumn2, 123),
      new LogField(testColumn3, fieldTime),
      new LogField(testColumn4, 'Test prop 1'),
    ];
    const fields2 = [
      new MockLogField(testColumn1, 'Test tag 2'),
      new LogField(testColumn2, 1234),
      new LogField(testColumn3, 'N/A', undefined, undefined, true),
      new LogField(testColumn4, 'Test prop 2'),
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
      new LogHeader(testColumn3),
      new LogHeader(
        testColumn4,
        new LogSelectFilter(['Test prop 1', 'Test prop 2']),
      ),
    ];

    dom.setComponentInput('entries', entries);
    dom.setComponentInput('headers', headers);
    dom.setComponentInput('selectedIndex', 0);
    await dom.detectChangesAndWaitStable();
  }

  function checkEntryPropagatedOnTimestampClick(
    button: DOMTestHelper<LogComponent>,
  ) {
    const spy = spyOn(component.timestampClick, 'emit');
    button.click();
    expect(spy).toHaveBeenCalledTimes(1);
  }

  function openContextMenuAndGetOptions(trigger: string) {
    const contextMenuTrigger = dom.get(trigger);
    contextMenuTrigger.openContextMenu();
    return dom.getInDocument('.context-menu').findAll('.context-menu-item');
  }
});

class MockLogField extends LogField {
  override getFilterValueMatch(): string {
    return 'filterMatch';
  }
}

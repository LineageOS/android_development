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

import {OverlayModule} from '@angular/cdk/overlay';
import {CommonModule} from '@angular/common';
import {TestBed} from '@angular/core/testing';
import {ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatTabsModule} from '@angular/material/tabs';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule, NoopAnimationsModule,} from '@angular/platform-browser/animations';
import {AngularViewer} from '@app/shared/angular_viewer';
import {ViewerStub} from '@app/shared/viewer_stub';
import {assertDefined} from '@common/assert';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {checkTooltips, DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeZeroTimestamp} from '@common/time/testing/test_helpers';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {ActiveTraceChanged} from '@trace_api/trace_events';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {FilterPresetApplyRequest, FilterPresetSaveRequest,} from '@ui/shared/events/misc_events';
import {TabbedViewSwitched, TabbedViewSwitchRequest,} from '@ui/shared/events/tabbed_view_events';
import {ViewType} from '@ui/shared/viewers/viewer';
import {ParsingErrorType} from '@ui/trace_loading/parsing_error_type';

import {TraceViewComponent} from './trace_view_component';

describe('TraceViewComponent', () => {
  const traceSf = makeEmptyTrace<HierarchyTreeNode>(TraceType.SURFACE_FLINGER);
  const traceWm = new TraceBuilder<object>()
    .setType(TraceType.WINDOW_MANAGER)
    .setEntries([{}])
    .setTimestamps([makeZeroTimestamp()])
    .setDescriptors(['file_1', 'file_1'])
    .build();
  const traceSr = makeEmptyTrace<HierarchyTreeNode>(TraceType.SCREEN_RECORDING);
  const traceProtolog = makeEmptyTrace<HierarchyTreeNode>(TraceType.PROTO_LOG);

  let component: TraceViewComponent;
  let dom: DOMTestHelper<TraceViewComponent>;
  let viewers: AngularViewer[];
  let store: InMemoryStorage;
  let traceTypesWithParsingErrors: Map<TraceType, ParsingErrorType>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        CommonModule,
        MatCardModule,
        MatDividerModule,
        MatTabsModule,
        MatTooltipModule,
        OverlayModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        BrowserAnimationsModule,
        MatInputModule,
        ReactiveFormsModule,
        TraceViewComponent,
      ],
      schemas: [],
    }).compileComponents();
    resetDom();
    store = new InMemoryStorage();

    viewers = [
      new ViewerStub('Title0', 'Content0', traceSf, ViewType.TRACE_TAB),
      new ViewerStub('Title1', 'Content1', traceWm, ViewType.TRACE_TAB),
      new ViewerStub('Title2', 'Content2', traceSr, ViewType.OVERLAY),
      new ViewerStub('Title3', 'Content3', traceProtolog, ViewType.TRACE_TAB),
    ];

    traceTypesWithParsingErrors = new Map<TraceType, ParsingErrorType>();
    traceTypesWithParsingErrors.set(
      TraceType.WINDOW_MANAGER,
      ParsingErrorType.DATA_INCORRECT,
    );

    dom.setComponentInput('viewers', viewers);
    dom.setComponentInput('store', store);
    dom.setComponentInput(
      'traceTypesWithParsingErrors',
      traceTypesWithParsingErrors,
    );
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('creates viewer tabs', () => {
    const tabs = getTabs();
    expect(tabs.length).toBe(3);
    tabs[0].checkText('Title0');
    tabs[1].checkText('Title1 Dump');
  });

  it('explicitly triggers on show for first tab to be shown', () => {
    resetDom();
    viewers[0].onShow = jasmine.createSpy();
    dom.setComponentInput('viewers', viewers);
    dom.setComponentInput('store', store);
    dom.detectChanges();
    expect(viewers[0].onShow).toHaveBeenCalledTimes(1);
  });

  it('creates viewer overlay', () => {
    const overlayContainer = dom.get('.overlay-container');
    overlayContainer.checkText('Content2');
  });

  it('throws error if more than one overlay present', () => {
    expect(() => {
      resetDom();
      dom.setComponentInput('viewers', [
        new ViewerStub('Title0', 'Content0', traceSf, ViewType.TRACE_TAB),
        new ViewerStub('Title1', 'Content1', traceWm, ViewType.OVERLAY),
        new ViewerStub('Title2', 'Content2', traceSr, ViewType.OVERLAY),
      ]);
      dom.detectChanges();
    }).toThrowError();
  });

  it('switches view on click', async () => {
    const tabs = getTabs();
    const switchTab0 = async () => {
      tabs[0].click();
    };
    const switchTab1 = async () => {
      tabs[1].click();
    };
    await checkTabSwitches(switchTab0, switchTab1);
  });

  it("emits 'view switched' events", () => {
    const tabs = getTabs();

    const emitAppEvent = jasmine.createSpy();
    component.setEmitEvent(emitAppEvent);
    expect(emitAppEvent).not.toHaveBeenCalled();

    tabs[1].click();
    expect(emitAppEvent).toHaveBeenCalledTimes(1);
    expect(emitAppEvent).toHaveBeenCalledWith(jasmine.any(TabbedViewSwitched));

    tabs[0].click();
    expect(emitAppEvent).toHaveBeenCalledTimes(2);
    expect(emitAppEvent).toHaveBeenCalledWith(jasmine.any(TabbedViewSwitched));
  });

  it("handles 'view switch' requests", async () => {
    const switchTab0 = async () => {
      await component.onWinscopeEvent(new TabbedViewSwitchRequest(traceSf));
      dom.detectChanges();
    };
    const switchTab1 = async () => {
      await component.onWinscopeEvent(new TabbedViewSwitchRequest(traceWm));
      dom.detectChanges();
    };
    await checkTabSwitches(switchTab0, switchTab1);
  });

  it('passes metadata from tab view switch request to tab view switched event', async () => {
    const emitAppEvent = jasmine.createSpy();
    component.setEmitEvent(emitAppEvent);
    await component.onWinscopeEvent(
      new TabbedViewSwitchRequest(traceWm, 'metadata'),
    );
    dom.detectChanges();
    expect(emitAppEvent).toHaveBeenCalledOnceWith(
      jasmine.any(TabbedViewSwitched),
    );
    expect(emitAppEvent.calls.mostRecent().args[0].metadata).toBe('metadata');
  });

  it('disables filter presets button for viewers without presets', () => {
    const filterPresets = dom.get('.filter-presets');
    filterPresets.checkText('Filter Presets');
    filterPresets.checkDisabled(false);
    const tabs = getTabs();
    tabs[2].click();
    filterPresets.checkDisabled(true);
  });

  it('saves preset by button', () => {
    const emitAppEvent = jasmine.createSpy();
    component.setEmitEvent(emitAppEvent);
    openFilterPresets();

    const overlay = getOverlay();
    const existingPresets = overlay.get('.existing-presets-section');
    existingPresets.checkText('No existing presets found');

    const saveButton = overlay.get('.save-field button');
    saveButton.checkDisabled(true);

    const input = overlay.findAndDispatchInput('.save-field', 'Test Preset');
    saveButton.click();

    expect(emitAppEvent).toHaveBeenCalledWith(
      new FilterPresetSaveRequest(
        'Test Preset.Surface Flinger',
        TraceType.SURFACE_FLINGER,
      ),
    );
    existingPresets.checkText('Test Preset');
    input.checkValue('');
    saveButton.checkDisabled(true);
  });

  it('saves preset by keydown', () => {
    const emitAppEvent = jasmine.createSpy();
    component.setEmitEvent(emitAppEvent);
    openFilterPresets();

    const overlay = getOverlay();

    const inputEl = overlay.get('.save-field input');
    inputEl.keydownEnter();
    expect(emitAppEvent).not.toHaveBeenCalled();

    inputEl.dispatchInput('Test Preset');
    inputEl.keydownEnter();

    expect(emitAppEvent).toHaveBeenCalledWith(
      new FilterPresetSaveRequest(
        'Test Preset.Surface Flinger',
        TraceType.SURFACE_FLINGER,
      ),
    );
  });

  it('saves preset between sessions', () => {
    savePresetByButton('Test Preset');

    // Simulate switching view or component recreation using same store
    // Use a new component instance with same store
    dom.destroy();
    const fixture = TestBed.createComponent(TraceViewComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('viewers', viewers);
    dom.setComponentInput('store', store); // Same store
    dom.detectChanges();

    // Switch to same view logic if needed, but defaults to first tab (SF)
    openFilterPresets();
    const existingPresets = dom.getInDocument(
      '.overlay-panel .existing-presets-section',
    );
    existingPresets.checkText('Test Preset');
  });

  it('deletes preset', () => {
    savePresetByButton('Test Preset');
    const overlay = getOverlay();
    const saveButton = overlay.get('.save-field button');
    overlay.findAndDispatchInput('.save-field', 'Test Preset');
    saveButton.checkDisabled(true);

    dom.findAndClickInDocument('.delete-button');
    dom
      .getInDocument('.existing-presets-section')
      .checkText('No existing presets found');
    saveButton.checkDisabled(false);
  });

  it('does not show presets for different trace', () => {
    savePresetByButton('Test Preset');
    dom.clickBackdrop();
    const tabs = getTabs();
    tabs[1].click();

    openFilterPresets();
    const overlay = getOverlay();
    overlay.checkText('No existing presets found');
  });

  it('emits apply preset request', () => {
    const emitAppEvent = jasmine.createSpy();
    component.setEmitEvent(emitAppEvent);
    savePresetByButton('Test Preset');

    dom.findAndClickInDocument('.overlay-panel .existing-preset button');
    expect(emitAppEvent).toHaveBeenCalledWith(
      new FilterPresetApplyRequest(
        'Test Preset.Surface Flinger',
        TraceType.SURFACE_FLINGER,
      ),
    );
  });

  it('does not show global tab first', () => {
    resetDom();
    dom.setComponentInput('viewers', [
      new ViewerStub('Title0', 'Content0', undefined, ViewType.GLOBAL_SEARCH),
      new ViewerStub('Title1', 'Content1', traceWm, ViewType.TRACE_TAB),
    ]);
    dom.setComponentInput('store', store);
    dom.detectChanges();
    expect(getVisibleTabContents()).toEqual(['Content1']);
  });

  it('shows tooltips for tabs with trace descriptors', async () => {
    const tabs = getTabs();
    const wmTab = tabs[1];
    const wmTabContent = wmTab.get('.tab-content');
    await wmTabContent.hover();
    await checkTooltips([wmTabContent], ['file_1']);

    await wmTabContent.unhover();
    expect(wmTabContent.findMatTooltipPanel()).toBeUndefined();
  });

  it('shows warning sign and tooltip if trace processor errors occurred', async () => {
    const tabs = getTabs();
    const wmTab = tabs[1];
    const wmTabWarningIcon = wmTab.get('.warning-icon');
    await checkTooltips(
      [wmTabWarningIcon],
      ['Trace processor errors occurred - data may be incorrect'],
    );
  });

  async function checkTabSwitches(
    switchTab0: () => Promise<void>,
    switchTab1: () => Promise<void>,
  ) {
    // Initially tab 0
    expect(getVisibleTabContents()).toEqual(['Content0']);

    const viewers = component.viewers();
    const showTab0 = spyOn(viewers[0], 'onShow');
    const showTab1 = spyOn(viewers[1], 'onShow');
    const hideTab0 = spyOn(viewers[0], 'onHide');
    const hideTab1 = spyOn(viewers[1], 'onHide');

    // Switch to tab 1
    await switchTab1();
    expect(getVisibleTabContents()).toEqual(['Content0', 'Content1']);
    expect(showTab0).not.toHaveBeenCalled();
    expect(showTab1).toHaveBeenCalledTimes(1);
    expect(hideTab0).toHaveBeenCalledTimes(1);
    expect(hideTab1).not.toHaveBeenCalled();
    showTab1.calls.reset();
    hideTab0.calls.reset();

    // Stay on tab 1, change active trace
    const emitSpy = jasmine.createSpy();
    component.setEmitEvent(emitSpy);
    await switchTab1();
    expect(getVisibleTabContents()).toEqual(['Content0', 'Content1']);
    expect(showTab0).not.toHaveBeenCalled();
    expect(showTab1).not.toHaveBeenCalled();
    expect(hideTab0).not.toHaveBeenCalled();
    expect(hideTab1).not.toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledOnceWith(new ActiveTraceChanged(traceWm));

    // Switch to tab 0
    await switchTab0();
    expect(getVisibleTabContents()).toEqual(['Content0', 'Content1']);
    expect(showTab0).toHaveBeenCalledTimes(1);
    expect(showTab1).not.toHaveBeenCalled();
    expect(hideTab0).not.toHaveBeenCalled();
    expect(hideTab1).toHaveBeenCalledTimes(1);
  }

  function getVisibleTabContents(): string[] {
    return dom
      .findAll('.trace-view-content viewer-stub')
      .map((stub) => assertDefined(stub.getText()));
  }

  function getTabs() {
    return dom.findAll('.tab');
  }

  function getOverlay() {
    return dom.getInDocument('.overlay-panel');
  }

  function savePresetByButton(presetName: string) {
    openFilterPresets();
    const overlay = getOverlay();
    overlay.findAndDispatchInput('.save-field', presetName);
    overlay.findAndClick('.save-field button');
  }

  function openFilterPresets() {
    dom.findAndClick('.filter-presets');
  }

  function resetDom() {
    const fixture = TestBed.createComponent(TraceViewComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
  }
});

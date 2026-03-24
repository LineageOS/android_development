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

import {CdkVirtualScrollViewport, ScrollingModule,} from '@angular/cdk/scrolling';
import {CommonModule} from '@angular/common';
import {ComponentFixtureAutoDetect, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatOptionModule, MatPseudoCheckboxModule} from '@angular/material/core';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {assertDefined} from '@common/assert';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';

import {SelectWithFilterComponent} from './select_with_filter_component';

describe('SelectWithFilterComponent', () => {
  const filterInputField = '.select-filter';
  let component: SelectWithFilterComponent;
  let dom: DOMTestHelper<SelectWithFilterComponent>;
  let selectChangeSpy: jasmine.Spy;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [{provide: ComponentFixtureAutoDetect, useValue: true}],
      imports: [
        CommonModule,
        MatSelectModule,
        MatFormFieldModule,
        MatOptionModule,
        MatInputModule,
        BrowserAnimationsModule,
        FormsModule,
        MatPseudoCheckboxModule,
        MatDividerModule,
        MatTooltipModule,
        ScrollingModule,
        SelectWithFilterComponent,
        CdkVirtualScrollViewport,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SelectWithFilterComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('label', 'TEST FILTER');
    dom.setComponentInput('options', ['0', '1', '2']);
    dom.detectChanges();
    selectChangeSpy = spyOn(component.selectChange, 'emit');
  });

  afterAll(() => {
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('applies filter correctly', async () => {
    await dom.openMatSelect();

    checkOptions(getOptions(), [0, 1, 2]);

    const panel = dom.getMatSelectPanel();
    const input = panel.findAndDispatchInput(filterInputField, '2');
    checkOptions(getOptions(), [2]);

    input.dispatchInput('');
    checkOptions(getOptions(), [0, 1, 2]);
  });

  it('maintains selection even if filtered out', async () => {
    await dom.openMatSelect();

    let options = getOptions();
    checkOptions(options, [0, 1, 2]);

    // select '0'
    options[0].click();
    await dom.whenStable();
    await checkSelectValue(['0']);

    // filter options to list just '2'
    const panel = dom.getMatSelectPanel();
    const input = panel.findAndDispatchInput(filterInputField, '2');
    options = getOptions();
    await dom.whenStable();
    checkOptions(options, [2]);

    // select '2'
    options[0].click();
    await dom.whenStable();
    await checkSelectValue(['2', '0'], ['0', '2']);

    // remove filter on options
    input.dispatchInput('');
    await dom.whenStable();
    options = getOptions();
    checkOptions(options, [0, 1, 2]);
    await checkSelectValue(['2', '0'], ['0', '2']);

    // select '1'
    options[1].click();
    await dom.whenStable();
    await checkSelectValue(['0', '1', '2']);
  });

  it('applies selection correctly', async () => {
    await dom.openMatSelect();
    const options = getOptions();

    options[0].click();
    await checkSelectValue(['0']);

    options[0].click();
    await checkSelectValue([]);
  });

  it('applies deselection from pinned selected options', async () => {
    await dom.openMatSelect();

    const options = getOptions();
    options[0].click();
    await checkSelectValue(['0']);

    const pinnedOptions = getPinnedOptions();
    expect(pinnedOptions.length).toBe(1);
    pinnedOptions[0].click();
    await checkSelectValue([]);
    expect(getPinnedOptions().length).toBe(0);
  });

  it('resets filter on close', async () => {
    await dom.openMatSelect();

    checkOptions(getOptions(), [0, 1, 2]);

    dom.getMatSelectPanel().findAndDispatchInput(filterInputField, 'A');
    checkOptions(getOptions(), []);

    dom.clickBackdrop();
    await dom.whenStable();
    await dom.whenRenderingDone();

    await dom.openMatSelect();
    checkOptions(getOptions(), [0, 1, 2]);
  });

  it('calls default select keydown handler', async () => {
    await dom.openMatSelect();
    await dom.detectChangesAndWaitStable();
    await dom.whenRenderingDone();
    dom.getMatSelectPanel().keydownSpace();
    await checkSelectValue(['0']);
  });

  it('toggles all with button', async () => {
    const toggle = () => {
      dom.getMatSelectPanel().findAndClick('.user-option');
    };
    await checkToggleAll(toggle);
  });

  it('toggles all with CTRL+A', async () => {
    await checkToggleAll(() => dom.keydownCtrlAToSelectPanel());
  });

  it('shows tooltip for all button', async () => {
    await dom.openMatSelect();
    await dom.whenRenderingDone();

    const button = dom.getMatSelectPanel().get('.user-option');
    await button.checkTooltip(component.allButtonTooltip);
  });

  it('does not emit second change after shift + click for adjacent options', async () => {
    await dom.openMatSelect();
    const options = getOptions();

    options[0].shiftAndClick();
    expect(selectChangeSpy).toHaveBeenCalledTimes(1);

    options[1].shiftAndClick();
    expect(selectChangeSpy).toHaveBeenCalledTimes(2);

    options[0].shiftAndClick();
    expect(selectChangeSpy).toHaveBeenCalledTimes(3);

    options[1].click();
    expect(selectChangeSpy).toHaveBeenCalledTimes(4);
  });

  it('emits second change after shift + click to toggle options in-between', async () => {
    await dom.openMatSelect();
    await dom.whenRenderingDone();
    const options = getOptions();

    options[0].click();
    selectChangeSpy.calls.reset();

    options[2].shiftAndClick();
    expect(selectChangeSpy).toHaveBeenCalledTimes(2);
    await checkSelectValue(['0', '2', '1'], ['0', '1', '2']);
    selectChangeSpy.calls.reset();

    options[0].shiftAndClick();
    expect(selectChangeSpy).toHaveBeenCalledTimes(2);
    await checkSelectValue([]);
  });

  it('sets in-between options to value of clicked option, regardless of current state', async () => {
    dom.setComponentInput('options', ['0', '1', '2', '3']);
    dom.detectChanges();
    await dom.openMatSelect();
    await dom.whenRenderingDone();
    const options = getOptions();

    options[2].click();
    options[3].click();
    await checkSelectValue(['2', '3']);
    selectChangeSpy.calls.reset();

    options[0].shiftAndClick();
    expect(selectChangeSpy).toHaveBeenCalledTimes(2);
    await checkSelectValue(['0', '2', '3', '1'], ['0', '1', '2', '3']);

    options[2].click();
    options[3].click();
    await checkSelectValue(['0', '1']);
    selectChangeSpy.calls.reset();

    options[0].shiftAndClick();
    expect(selectChangeSpy).toHaveBeenCalledTimes(2);
    await checkSelectValue([]);
  });

  it('only toggles non-hidden options between last and current clicks', async () => {
    dom.setComponentInput('options', ['0', '1', '2', '10']);
    dom.detectChanges();
    await dom.openMatSelect();
    dom.getMatSelectPanel().findAndDispatchInput(filterInputField, '1');

    const options = getOptions();
    options[0].click();
    selectChangeSpy.calls.reset();

    options[1].shiftAndClick();
    await checkSelectValue(['1', '10']);
    expect(selectChangeSpy).toHaveBeenCalledTimes(2);
  });

  it('updates select value based on component input "value"', async () => {
    dom.setComponentInput('value', ['0', '1']);
    dom.detectChanges();
    await checkSelectValue(['0', '1']);
    expect(selectChangeSpy).toHaveBeenCalledTimes(1);

    dom.setComponentInput('value', ['0']);
    dom.detectChanges();
    await checkSelectValue(['0']);
    expect(selectChangeSpy).toHaveBeenCalledTimes(2);

    getOptions()[2].click();
    await checkSelectValue(['0', '2']);
    expect(selectChangeSpy).toHaveBeenCalledTimes(3);

    dom.setComponentInput('value', ['1']);
    dom.detectChanges();
    await checkSelectValue(['1']);
    expect(selectChangeSpy).toHaveBeenCalledTimes(4);
  });

  it('disables select if multiple options not present', () => {
    checkSelectDisabled(false);

    dom.setComponentInput('options', ['0']);
    dom.detectChanges();
    checkSelectDisabled(true);

    dom.setComponentInput('options', []);
    dom.detectChanges();
    checkSelectDisabled(true);

    dom.setComponentInput('options', ['0', '1']);
    dom.detectChanges();
    checkSelectDisabled(false);
  });

  function getOptions(): Array<DOMTestHelper<SelectWithFilterComponent>> {
    return Array.from(dom.getMatSelectPanel().findAll('.option'));
  }

  function checkOptions(
    options: Array<DOMTestHelper<SelectWithFilterComponent>>,
    expectedIndexes: number[],
  ) {
    expect(options.length).toBe(3);
    options.forEach((option, index) => {
      const exp = expectedIndexes[index];
      if (exp !== undefined) {
        option.checkText(`${exp}`);
        option.checkClassName('hidden-option', false);
      } else {
        option.checkClassName('hidden-option', true);
      }
    });
  }

  function getPinnedOptions(): Array<DOMTestHelper<SelectWithFilterComponent>> {
    return dom
      .getMatSelectPanel()
      .findAll('.selected-options .selected-option');
  }

  async function checkSelectValue(expValues: string[], expOpts = expValues) {
    expect(selectChangeSpy).toHaveBeenCalled();
    expect(
      assertDefined(selectChangeSpy.calls.mostRecent().args[0]).value,
    ).toEqual(expValues);
    if (!dom.isMatSelectOpen()) {
      await dom.openMatSelect();
    }
    const pinnedOptions = getPinnedOptions();
    expect(pinnedOptions.length).toEqual(expOpts.length);
    pinnedOptions.forEach((option, index) => {
      option.checkTextExact(expOpts[index]);
    });
  }

  async function checkToggleAll(toggle: () => void) {
    await dom.openMatSelect();
    await dom.whenRenderingDone();

    toggle();
    await checkSelectValue(['0', '1', '2']);

    toggle();
    await checkSelectValue([]);

    toggle();
    // filters out '0' and '1' while all selected
    const inputEl = dom
      .getMatSelectPanel()
      .findAndDispatchInput(filterInputField, '2');

    toggle();
    await checkSelectValue(['0', '1']);

    toggle();
    await checkSelectValue(['0', '1', '2']);

    toggle();
    // removes filter while '0' and '1' selected
    inputEl.dispatchInput('');

    toggle();
    await checkSelectValue(['0', '1', '2']);
  }

  function checkSelectDisabled(isDisabled: boolean) {
    expect(component.select().disabled).toBe(isDisabled);
    expect(component.disabled()).toBe(isDisabled);
  }
});

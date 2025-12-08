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

import {ScrollingModule} from '@angular/cdk/scrolling';
import {CommonModule} from '@angular/common';
import {Component, ViewChild} from '@angular/core';
import {ComponentFixtureAutoDetect, TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatOptionModule, MatPseudoCheckboxModule} from '@angular/material/core';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {assertDefined} from 'common/assert';
import {KeyboardEventCode} from 'common/dom';
import {DOMTestHelper} from 'test/unit/dom_test_helpers';
import {SelectWithFilterComponent} from './select_with_filter_component';

describe('SelectWithFilterComponent', () => {
  const filterInputField = '.select-filter';
  let component: TestHostComponent;
  let dom: DOMTestHelper<TestHostComponent>;
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
        TestHostComponent,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.detectChanges();
    selectChangeSpy = spyOn(
      assertDefined(component.selectWithFilterComponent).selectChange,
      'emit',
    );
  });

  afterAll(() => {
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('applies filter correctly', () => {
    dom.openMatSelect();

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

    options[0].click();
    checkSelectValue(['0']);

    const panel = dom.getMatSelectPanel();
    const input = panel.findAndDispatchInput(filterInputField, '2');
    options = getOptions();
    checkOptions(options, [2]);

    options[0].click();
    checkSelectValue(['2', '0'], ['0', '2']);

    input.dispatchInput('');
    options = getOptions();
    checkOptions(options, [0, 1, 2]);
    checkSelectValue(['2', '0'], ['0', '2']);

    options[1].click();
    checkSelectValue(['0', '1', '2']);
  });

  it('applies selection correctly', () => {
    dom.openMatSelect();
    const options = getOptions();

    options[0].click();
    checkSelectValue(['0']);

    options[0].click();
    checkSelectValue([]);
  });

  it('applies deselection from pinned selected options', () => {
    dom.openMatSelect();

    const options = getOptions();
    options[0].click();
    checkSelectValue(['0']);

    const pinnedOptions = getPinnedOptions();
    expect(pinnedOptions.length).toBe(1);
    pinnedOptions[0].click();
    checkSelectValue([]);
    expect(getPinnedOptions().length).toBe(0);
  });

  it('resets filter on close', async () => {
    dom.openMatSelect();

    checkOptions(getOptions(), [0, 1, 2]);

    dom.getMatSelectPanel().findAndDispatchInput(filterInputField, 'A');
    checkOptions(getOptions(), []);

    dom.clickBackdrop();
    await dom.whenStable();
    await dom.whenRenderingDone();

    dom.openMatSelect();
    checkOptions(getOptions(), [0, 1, 2]);
  });

  it('calls default select keydown handler', async () => {
    dom.openMatSelect();
    await dom.detectChangesAndWaitStable();
    await dom.whenRenderingDone();
    dom.getMatSelectPanel().keydownSpace();
    checkSelectValue(['0']);
  });

  it('calls custom select keydown handler for CTRL+A', async () => {
    dom.openMatSelect();
    await dom.detectChangesAndWaitStable();
    await dom.whenRenderingDone();
    const keydownCtrlA = new KeyboardEvent('keydown', {
      code: KeyboardEventCode.A,
      ctrlKey: true,
    });
    const panel = dom.getMatSelectPanel();

    panel.dispatchEvent(keydownCtrlA);
    checkSelectValue(['0', '1', '2']);

    panel.dispatchEvent(keydownCtrlA);
    checkSelectValue([]);

    panel.dispatchEvent(keydownCtrlA);
    const inputEl = panel.findAndDispatchInput(filterInputField, '2'); // filters out '0' and '1' while all selected

    panel.dispatchEvent(keydownCtrlA);
    checkSelectValue(['0', '1']);

    panel.dispatchEvent(keydownCtrlA);
    checkSelectValue(['0', '1', '2']);

    panel.dispatchEvent(keydownCtrlA);
    inputEl.dispatchInput(''); // removes filter while '0' and '1' selected

    panel.dispatchEvent(keydownCtrlA);
    checkSelectValue(['0', '1', '2']);
  });

  it('does not emit second change after shift + click for adjacent options', () => {
    dom.openMatSelect();
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
    checkSelectValue(['0', '2', '1'], ['0', '1', '2']);
    selectChangeSpy.calls.reset();

    options[0].shiftAndClick();
    expect(selectChangeSpy).toHaveBeenCalledTimes(2);
    checkSelectValue([]);
  });

  it('sets in-between options to value of clicked option, regardless of current state', async () => {
    component.allOptions.push('3');
    await dom.openMatSelect();
    await dom.whenRenderingDone();
    const options = getOptions();

    options[2].click();
    options[3].click();
    checkSelectValue(['2', '3']);
    selectChangeSpy.calls.reset();

    options[0].shiftAndClick();
    expect(selectChangeSpy).toHaveBeenCalledTimes(2);
    checkSelectValue(['0', '2', '3', '1'], ['0', '1', '2', '3']);

    options[2].click();
    options[3].click();
    checkSelectValue(['0', '1']);
    selectChangeSpy.calls.reset();

    options[0].shiftAndClick();
    expect(selectChangeSpy).toHaveBeenCalledTimes(2);
    checkSelectValue([]);
  });

  it('only toggles non-hidden options between last and current clicks', async () => {
    component.allOptions.push('10');
    await dom.openMatSelect();
    dom.getMatSelectPanel().findAndDispatchInput(filterInputField, '1');

    const options = getOptions();
    options[0].click();
    selectChangeSpy.calls.reset();

    options[1].shiftAndClick();
    checkSelectValue(['1', '10']);
    expect(selectChangeSpy).toHaveBeenCalledTimes(2);
  });

  function getOptions(): Array<DOMTestHelper<TestHostComponent>> {
    return Array.from(dom.getMatSelectPanel().findAll('.option'));
  }

  function checkOptions(
    options: Array<DOMTestHelper<TestHostComponent>>,
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

  function getPinnedOptions(): Array<DOMTestHelper<TestHostComponent>> {
    return dom
      .getMatSelectPanel()
      .findAll('.selected-options .selected-option');
  }

  function checkSelectValue(expValues: string[], expOpts = expValues) {
    expect(selectChangeSpy).toHaveBeenCalled();
    expect(
      assertDefined(selectChangeSpy.calls.mostRecent().args[0]).value,
    ).toEqual(expValues);
    if (!dom.isMatSelectOpen()) {
      dom.openMatSelect();
    }
    const pinnedOptions = getPinnedOptions();
    expect(pinnedOptions.length).toEqual(expOpts.length);
    pinnedOptions.forEach((option, index) => {
      option.checkTextExact(expOpts[index]);
    });
  }

  @Component({
    imports: [SelectWithFilterComponent],
    selector: 'host-component',
    template: `
      <select-with-filter
        [label]="label"
        [options]="allOptions"></select-with-filter>
    `,
  })
  class TestHostComponent {
    label = 'TEST FILTER';
    allOptions = ['0', '1', '2'];

    @ViewChild(SelectWithFilterComponent)
    selectWithFilterComponent: SelectWithFilterComponent | undefined;
  }
});

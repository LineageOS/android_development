/*
 * Copyright(C) 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0(the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {TraceType} from '@trace_api/trace_type';
import {VISIBLE_CHIP} from '@ui/shared/user_input/chip';

import {UserOptionsComponent} from './user_options_component';

describe('UserOptionsComponent', () => {
  let component: UserOptionsComponent;
  let dom: DOMTestHelper<UserOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserOptionsComponent, MatButtonModule, MatIconModule],
    }).compileComponents();
    const fixture = TestBed.createComponent(UserOptionsComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    const userOptions = {
      option1: {
        name: 'option 1',
        enabled: false,
        isUnavailable: false,
      },
      optionWithChip: {
        name: 'option with chip',
        enabled: false,
        isUnavailable: false,
        chip: VISIBLE_CHIP,
      },
      optionWithIcon: {
        name: 'option with icon',
        enabled: false,
        isUnavailable: false,
        icon: 'visibility',
      },
    };
    dom.setComponentInput('userOptions', userOptions);
    dom.setComponentInput('traceType', TraceType.SURFACE_FLINGER);
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('displays options', () => {
    const options = dom.findAll('.user-option');
    expect(options.length).toBe(3);

    options[0].checkText('option 1');
    expect(options[0].find('.user-option-chip')).toBeUndefined();
    expect(options[0].find('.mat-icon')).toBeUndefined();

    options[1].checkText('option with chip');
    options[1].get('.user-option-chip').checkText('V');
    expect(options[1].find('.mat-icon')).toBeUndefined();

    options[2].checkText('option with icon');
    expect(options[2].find('.user-option-chip')).toBeUndefined();
    options[2].get('.mat-icon').checkTextExact('visibility');
  });

  it('disables option if unavailable', () => {
    const option = dom.get('.user-option');
    option.checkDisabled(false);
    const userOptions = component.userOptions();
    userOptions['option1'].isUnavailable = true;
    dom.setComponentInput('userOptions', userOptions);
    dom.detectChanges();
    option.checkDisabled(true);
  });

  it('emits event on user option change', () => {
    const emitSpy = spyOn(component.optionsChange, 'emit');
    const logSpy = jasmine.createSpy();
    dom.setComponentInput('logCallback', logSpy);
    dom.findAndClick('.user-option');
    expect(emitSpy).toHaveBeenCalledTimes(1);
    expect(emitSpy.calls.mostRecent().args[0]['option1'].enabled).toBeTrue();
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});

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
import {CommonModule} from '@angular/common';
import {TestBed} from '@angular/core/testing';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';

import {PropertiesTableComponent} from './properties_table_component';

describe('PropertiesTableComponent', () => {
  let component: PropertiesTableComponent;
  let dom: DOMTestHelper<PropertiesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertiesTableComponent, CommonModule],
    }).compileComponents();
  });

  beforeEach(() => {
    const fixture = TestBed.createComponent(PropertiesTableComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('renders defined table properties', () => {
    dom.setComponentInput('properties', {prop1: 'value1', prop2: 'value2'});
    dom.detectChanges();
    const rows = dom.findAll('tr');
    expect(rows.length).toEqual(2);
    rows[0].get('.table-cell-name').checkTextExact('prop1');
    rows[0].get('.table-cell-value').checkTextExact('value1');
    rows[1].get('.table-cell-name').checkTextExact('prop2');
    rows[1].get('.table-cell-value').checkTextExact('value2');
  });

  it('renders undefined table properties', () => {
    dom.setComponentInput('properties', {prop: undefined});
    dom.detectChanges();
    const rows = dom.findAll('tr');
    expect(rows.length).toEqual(1);
    rows[0].get('.table-cell-name').checkTextExact('prop');
    rows[0].get('.table-cell-value').checkTextExact('undefined');
  });
});

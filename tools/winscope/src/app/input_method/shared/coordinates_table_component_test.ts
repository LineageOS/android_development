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

import {TestBed} from '@angular/core/testing';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {DEFAULT_PROPERTY_FORMATTER} from '@trace/formatters';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';

import {CoordinatesTableComponent} from './coordinates_table_component';

describe('CoordinatesTableComponent', () => {
  let dom: DOMTestHelper<CoordinatesTableComponent>;
  let component: CoordinatesTableComponent;

  beforeAll(async () => {
    await TestBed.configureTestingModule({
      imports: [CoordinatesTableComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    const fixture = TestBed.createComponent(CoordinatesTableComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('shows null if no coordinates', () => {
    dom.detectChanges();
    expect(dom.getText()).toEqual('null');
  });

  it('shows coordinates', () => {
    const coordinates = new PropertyTreeBuilder()
      .setRootId('')
      .setName('coordinates')
      .setFormatter(DEFAULT_PROPERTY_FORMATTER)
      .setChildren([
        {name: 'left', value: 1, formatter: DEFAULT_PROPERTY_FORMATTER},
        {name: 'top', value: 2, formatter: DEFAULT_PROPERTY_FORMATTER},
        {name: 'right', value: 3, formatter: DEFAULT_PROPERTY_FORMATTER},
        {name: 'bottom', value: 4, formatter: DEFAULT_PROPERTY_FORMATTER},
      ])
      .build();
    dom.setComponentInput('coordinates', coordinates);
    dom.detectChanges();
    const headers = dom
      .get('.header-row')
      .findAll('td')
      .map((h) => h.getText());
    expect(headers).toEqual(['Left', 'Top', 'Right', 'Bottom']);

    const values = dom
      .get('.values-row')
      .findAll('td')
      .map((v) => v.getText());
    expect(values).toEqual(['1', '2', '3', '4']);
  });
});

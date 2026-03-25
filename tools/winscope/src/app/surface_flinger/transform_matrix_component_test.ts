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

import {TransformMatrixComponent} from './transform_matrix_component';

describe('TransformMatrixComponent', () => {
  let component: TransformMatrixComponent;
  let dom: DOMTestHelper<TransformMatrixComponent>;

  beforeAll(async () => {
    await TestBed.configureTestingModule({
      imports: [TransformMatrixComponent],
    }).compileComponents();
  });

  beforeEach(() => {
    const fixture = TestBed.createComponent(TransformMatrixComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('displays matrix', () => {
    const matrix = new PropertyTreeBuilder()
      .setRootId('')
      .setName('matrix')
      .setFormatter(DEFAULT_PROPERTY_FORMATTER)
      .setChildren([
        {name: 'dsdx', value: 1, formatter: DEFAULT_PROPERTY_FORMATTER},
        {name: 'dtdx', value: 2, formatter: DEFAULT_PROPERTY_FORMATTER},
        {name: 'dtdy', value: 3, formatter: DEFAULT_PROPERTY_FORMATTER},
        {name: 'dsdy', value: 4, formatter: DEFAULT_PROPERTY_FORMATTER},
      ])
      .build();
    dom.setComponentInput('matrix', matrix);
    dom.detectChanges();
    expect(dom.findAll('p').map((el) => el.getText())).toEqual([
      '1',
      '2',
      'null',
      '3',
      '4',
      'null',
      '0',
      '0',
      '1',
    ]);
  });
});

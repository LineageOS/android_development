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
import {MatButtonModule} from '@angular/material/button';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeRealTimestamp} from '@common/time/testing/test_helpers';
import {DEFAULT_PROPERTY_FORMATTER, FixedStringFormatter, HEX_FORMATTER, TIMESTAMP_NODE_FORMATTER,} from '@trace/formatters';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {DiffType} from '@ui/shared/tree/diff_type';
import {TimestampClickDetail} from '@ui/shared/viewers/viewer_event_details';

import {PropertyTreeNodeDataViewComponent} from './property_tree_node_data_view_component';

describe('PropertyTreeNodeDataViewComponent', () => {
  let component: PropertyTreeNodeDataViewComponent;
  let dom: DOMTestHelper<PropertyTreeNodeDataViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MatButtonModule,
        BrowserAnimationsModule,
        PropertyTreeNodeDataViewComponent,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PropertyTreeNodeDataViewComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('can emit timestamp', () => {
    const spy = spyOn(component.timestampClick, 'emit');
    const ts = makeRealTimestamp(1659126889102158832n);
    const node = UiPropertyTreeNode.from(
      new PropertyTreeBuilder()
        .setRootId('test node')
        .setName('timestamp')
        .setValue(ts)
        .setFormatter(TIMESTAMP_NODE_FORMATTER)
        .build(),
    );
    dom.setComponentInput('node', node);
    dom.detectChanges();

    dom.get('.time').findAndClick('.time-button');

    expect(spy).toHaveBeenCalledOnceWith(
      new TimestampClickDetail(undefined, ts),
    );
  });

  it('can emit propagatable node', () => {
    const spy = spyOn(component.propagatePropertyClick, 'emit');
    const node = UiPropertyTreeNode.from(
      new PropertyTreeBuilder()
        .setRootId('test node')
        .setName('property')
        .setValue(12345)
        .setFormatter(HEX_FORMATTER)
        .build(),
    );
    node.setCanPropagate(true);
    dom.setComponentInput('node', node);
    dom.detectChanges();

    const button = dom.get('.inline button');
    button.checkTextExact('0x3039');
    button.click();
    expect(spy).toHaveBeenCalledOnceWith(node);
  });

  it('renders diff values parts', () => {
    const node = UiPropertyTreeNode.from(
      new PropertyTreeBuilder()
        .setRootId('test node')
        .setName('property')
        .setValue(12345)
        .setFormatter(DEFAULT_PROPERTY_FORMATTER)
        .build(),
    );
    node.setDiffValueParts([
      {isOld: false, isNew: false, value: 'f1'},
      {isOld: false, isNew: true, value: 'f2'},
      {isOld: true, isNew: false, value: 'f3'},
    ]);
    dom.setComponentInput('node', node);
    dom.detectChanges();

    const diffValueParts = dom.get('.diff-value-parts');
    diffValueParts.checkTextExact('f1 | f2 | f3');
    diffValueParts.get('.unchanged-value').checkTextExact('f1');
    diffValueParts.get('.new-value').checkTextExact('f2');
    diffValueParts.get('s.old-value').checkTextExact('f3');
  });

  it('shows old value if diff parts not available', () => {
    const node = UiPropertyTreeNode.from(
      new PropertyTreeBuilder()
        .setRootId('test node')
        .setName('property')
        .setValue(12345)
        .setFormatter(DEFAULT_PROPERTY_FORMATTER)
        .build(),
    );
    node.setDiff(DiffType.MODIFIED);
    node.setOldValue('54321');
    dom.setComponentInput('node', node);
    dom.detectChanges();
    dom.get('.new-value').checkTextExact('12345');
    dom.get('s.old-value').checkTextExact('54321');
  });

  it('adds correct css class for property value', () => {
    checkValueClass('number', true, 12345);
    checkValueClass('null');
    checkValueClass('true');
    checkValueClass('false');
    checkValueClass('test', false);
  });

  function checkValueClass(
    valueClass: string,
    hasClass = true,
    value?: number,
  ) {
    const formatter = value
      ? DEFAULT_PROPERTY_FORMATTER
      : new FixedStringFormatter(valueClass);
    const propertyValue = value ?? valueClass;
    const node = new PropertyTreeBuilder()
      .setRootId('test node')
      .setName('property')
      .setValue(propertyValue)
      .setFormatter(formatter)
      .build();
    const uiNode = UiPropertyTreeNode.from(node);
    dom.setComponentInput('node', uiNode);
    dom.detectChanges();
    const valueElement = dom.get('.new-value');
    valueElement.checkTextExact(propertyValue.toString());
    ['null', 'true', 'false', 'number'].forEach((c) => {
      valueElement.checkClassName(c, c === valueClass && hasClass);
    });
  }
});

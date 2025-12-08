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
import {ComponentFixtureAutoDetect, TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {assertDefined} from 'common/assert';
import {Timestamp} from 'common/time/time';
import {DOMTestHelper} from 'test/unit/dom_test_helpers';
import {PropertyTreeBuilder} from 'test/unit/property_tree_builder';
import {makeRealTimestamp} from 'test/unit/time_test_helpers';
import {
  DEFAULT_PROPERTY_FORMATTER,
  FixedStringFormatter,
  HEX_FORMATTER,
  TIMESTAMP_NODE_FORMATTER,
} from 'trace/formatters';
import {DiffType} from 'viewers/common/diff_type';
import {UiPropertyTreeNode} from 'viewers/common/ui_property_tree_node';
import {ViewerEvents} from 'viewers/common/viewer_events';
import {PropertyTreeNodeDataViewComponent} from './property_tree_node_data_view_component';

describe('PropertyTreeNodeDataViewComponent', () => {
  let component: PropertyTreeNodeDataViewComponent;
  let dom: DOMTestHelper<PropertyTreeNodeDataViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [{provide: ComponentFixtureAutoDetect, useValue: true}],
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
    let timestamp: Timestamp | undefined;
    dom.addEventListener(ViewerEvents.TimestampClick, (event) => {
      timestamp = (event as CustomEvent).detail.timestamp;
    });
    const node = UiPropertyTreeNode.from(
      new PropertyTreeBuilder()
        .setRootId('test node')
        .setName('timestamp')
        .setValue(makeRealTimestamp(1659126889102158832n))
        .setFormatter(TIMESTAMP_NODE_FORMATTER)
        .build(),
    );
    component.node = node;
    dom.detectChanges();

    dom.get('.time').findAndClick('.time-button');
    expect(assertDefined(timestamp).format()).toEqual(
      '2022-07-29, 20:34:49.102',
    );
  });

  it('can emit propagatable node', () => {
    let clickedNode: UiPropertyTreeNode | undefined;
    dom.addEventListener(ViewerEvents.PropagatePropertyClick, (event) => {
      clickedNode = (event as CustomEvent).detail;
    });
    const node = UiPropertyTreeNode.from(
      new PropertyTreeBuilder()
        .setRootId('test node')
        .setName('property')
        .setValue(12345)
        .setFormatter(HEX_FORMATTER)
        .build(),
    );
    node.setCanPropagate(true);
    component.node = node;
    dom.detectChanges();

    const button = dom.get('.inline button');
    button.checkTextExact('0x3039');
    button.click();
    expect(clickedNode).toEqual(node);
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
    component.node = node;
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
    component.node = node;
    dom.detectChanges();
    dom.get('.new-value').checkTextExact('12345');
    dom.get('s.old-value').checkTextExact('54321');
  });

  it('adds correct css class for property value', () => {
    const node = UiPropertyTreeNode.from(
      new PropertyTreeBuilder()
        .setRootId('test node')
        .setName('property')
        .setValue(12345)
        .setFormatter(DEFAULT_PROPERTY_FORMATTER)
        .build(),
    );
    component.node = node;
    dom.detectChanges();
    const valueElement = dom.get('.new-value');
    valueElement.checkClassName('number');
    valueElement.checkTextExact('12345');

    checkValueClass(node, 'null');
    checkValueClass(node, 'true');
    checkValueClass(node, 'false');
    checkValueClass(node, 'test', false);
  });

  function checkValueClass(
    node: UiPropertyTreeNode,
    valueClass: string,
    hasClass = true,
  ) {
    node.setFormatter(new FixedStringFormatter(valueClass));
    dom.detectChanges();
    const valueElement = dom.get('.new-value');
    ['null', 'true', 'false', 'number'].forEach((c) => {
      valueElement.checkClassName(c, c === valueClass && hasClass);
    });
  }
});

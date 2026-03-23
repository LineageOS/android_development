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
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {assertDefined} from '@common/assert';
import {makeElapsedTimestamp} from '@common/time/test_helpers';
import {DOMTestHelper} from '@test/unit/common/dom_test_helpers';
import {HierarchyTreeBuilder} from '@test/unit/tree_node/hierarchy_tree_builder';
import {PropertyTreeBuilder} from '@test/unit/tree_node/property_tree_builder';
import {DEFAULT_PROPERTY_FORMATTER} from '@trace/formatters';
import {DiffType} from '@viewers/common/diff_type';
import {UiHierarchyTreeNode} from '@viewers/common/ui_hierarchy_tree_node';
import {UiPropertyTreeNode} from '@viewers/common/ui_property_tree_node';
import {UiTreeNode} from '@viewers/common/ui_tree_node';
import {TimestampClickDetail} from '@viewers/common/viewer_event_details';

import {HierarchyTreeNodeDataViewComponent} from './hierarchy_tree_node_data_view_component';
import {PropertyTreeNodeDataViewComponent} from './property_tree_node_data_view_component';
import {TreeNodeComponent} from './tree_node_component';

describe('TreeNodeComponent', () => {
  let fixture: ComponentFixture<TreeNodeComponent<UiTreeNode>>;
  let component: TreeNodeComponent<UiTreeNode>;
  let dom: DOMTestHelper<TreeNodeComponent<UiTreeNode>>;
  let mockCopyText: jasmine.Spy;

  const propertiesTree = UiPropertyTreeNode.from(
    new PropertyTreeBuilder()
      .setRootId('test')
      .setName('property tree')
      .setChildren([
        {name: 'key1', value: 'value1', formatter: DEFAULT_PROPERTY_FORMATTER},
        {name: 'key2', children: [{name: 'key3'}]},
      ])
      .build(),
  );
  propertiesTree.setIsRoot(true);

  beforeEach(async () => {
    mockCopyText = jasmine.createSpy();
    await TestBed.configureTestingModule({
      providers: [{provide: Clipboard, useValue: {copy: mockCopyText}}],
      imports: [
        MatIconModule,
        MatTooltipModule,
        ClipboardModule,
        TreeNodeComponent,
        HierarchyTreeNodeDataViewComponent,
        PropertyTreeNodeDataViewComponent,
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TreeNodeComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
  });

  it('can be created', () => {
    dom.setComponentInput('node', propertiesTree);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('can generate hierarchy data view component', () => {
    dom.setComponentInput(
      'node',
      UiHierarchyTreeNode.from(
        new HierarchyTreeBuilder()
          .setId('LayerTraceEntry')
          .setName('Root')
          .build(),
      ),
    );
    fixture.detectChanges();
    expect(dom.find('hierarchy-tree-node-data-view')).toBeDefined();
    expect(dom.find('property-tree-node-data-view')).toBeUndefined();
  });

  it('can generate property data view component', () => {
    dom.setComponentInput('node', propertiesTree);
    fixture.detectChanges();
    expect(dom.find('property-tree-node-data-view')).toBeDefined();
    expect(dom.find('hierarchy-tree-node-data-view')).toBeUndefined();
  });

  it('can trigger tree toggle on click of chevron', () => {
    dom.setComponentInput('node', propertiesTree);
    spyOn(component, 'showChevron').and.returnValue(true);
    fixture.detectChanges();

    const spy = spyOn(component.toggleTreeChange, 'emit');
    dom.findAndClick('.toggle-tree-btn');
    expect(spy).toHaveBeenCalled();
  });

  it('can trigger tree expansion on click of expand tree button', () => {
    dom.setComponentInput('node', propertiesTree);
    fixture.detectChanges();
    const spy = spyOn(component.expandTreeChange, 'emit');
    dom.findAndClick('.expand-tree-btn');
    expect(spy).toHaveBeenCalled();
  });

  it('can collapse a tree if node is selected', () => {
    dom.setComponentInput('node', propertiesTree);
    spyOn(component, 'showChevron').and.returnValue(true);
    fixture.detectChanges();
    dom.setComponentInput('isSelected', false);
    fixture.detectChanges();
    dom.setComponentInput('isSelected', true);
    fixture.detectChanges();
    const spy = spyOn(component.toggleTreeChange, 'emit');
    dom.findAndClick('.toggle-tree-btn');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('assigns diff css classes to expand tree button', () => {
    dom.setComponentInput('node', propertiesTree);
    fixture.detectChanges();
    const expandButton = dom.get('.expand-tree-btn');
    expandButton.checkClassName('icon-button expand-tree-btn');
    expandButton.checkClassName('added', false);
    expandButton.checkClassName('modified', false);

    dom.setComponentInput(
      'node',
      UiHierarchyTreeNode.from(
        new HierarchyTreeBuilder()
          .setId('LayerTraceEntry')
          .setName('Added Diff')
          .setChildren([
            {id: 1, name: 'Child 1', children: [{id: 2, name: 'Child 2'}]},
          ])
          .build(),
      ),
    );
    assertDefined(component.node().getChildByName('Child 1')).setDiff(
      DiffType.ADDED,
    );
    fixture.detectChanges();
    expandButton.checkClassName('added');
    expandButton.checkClassName('modified', false);

    const modifiedNode = UiHierarchyTreeNode.from(
      new HierarchyTreeBuilder()
        .setId('LayerTraceEntry')
        .setName('Added Diff')
        .setChildren([
          {id: 1, name: 'Child 1', children: [{id: 2, name: 'Child 2'}]},
        ])
        .build(),
    );
    dom.setComponentInput('node', modifiedNode);
    const child1 = assertDefined(component.node().getChildByName('Child 1'));
    child1.setDiff(DiffType.ADDED);
    assertDefined(child1.getChildByName('Child 2')).setDiff(DiffType.DELETED);
    fixture.detectChanges();
    expandButton.checkClassName('added', false);
    expandButton.checkClassName('modified');
  });

  it('pins node on click', () => {
    dom.setComponentInput('node', propertiesTree);
    spyOn(component, 'showPinNodeIcon').and.returnValue(true);
    fixture.detectChanges();

    const spy = spyOn(component.pinNodeChange, 'emit');
    dom.findAndClick('.pin-node-btn');
    expect(spy).toHaveBeenCalledWith(component.node() as UiHierarchyTreeNode);
  });

  it('can trigger rect show state toggle on click of icon', () => {
    dom.setComponentInput('node', propertiesTree);
    dom.setComponentInput('showStateIcon', 'visibility');
    fixture.detectChanges();

    const spy = spyOn(component.rectShowStateChange, 'emit');
    dom.findAndClick('.toggle-rect-show-state-btn');
    expect(spy).toHaveBeenCalled();
  });

  it('does not show copy button for hierarchy tree', () => {
    dom.setComponentInput(
      'node',
      UiHierarchyTreeNode.from(
        new HierarchyTreeBuilder()
          .setId('LayerTraceEntry')
          .setName('Root')
          .build(),
      ),
    );
    fixture.detectChanges();
    expect(dom.find('.icon-wrapper-copy')).toBeUndefined();
  });

  it('does not show copy button for property tree node that is not leaf or root', () => {
    dom.setComponentInput(
      'node',
      assertDefined(propertiesTree.getChildByName('key2')),
    );
    fixture.detectChanges();
    expect(dom.find('.icon-wrapper-copy')).toBeUndefined();
  });

  it('copies node name for root of property tree node', () => {
    dom.setComponentInput('node', propertiesTree);
    fixture.detectChanges();
    dom.findAndClick('.icon-wrapper-copy button');
    expect(mockCopyText).toHaveBeenCalledWith(propertiesTree.name);
  });

  it('copies property name and value for leaf node', () => {
    dom.setComponentInput(
      'node',
      assertDefined(propertiesTree.getChildByName('key1')),
    );
    dom.setComponentInput('isLeaf', true);
    fixture.detectChanges();
    dom.findAndClick('.icon-wrapper-copy button');
    expect(mockCopyText).toHaveBeenCalledWith('key1: value1');
  });

  it('binds property tree node data view outputs to tree node outputs', () => {
    dom.setComponentInput('node', propertiesTree);
    fixture.detectChanges();
    const dataView = assertDefined(
      dom.findByDirective(PropertyTreeNodeDataViewComponent),
    );

    const timestampSpy = spyOn(component.timestampClick, 'emit');
    const detail = new TimestampClickDetail(
      undefined,
      makeElapsedTimestamp(2n),
    );
    dataView.timestampClick.emit(detail);
    expect(timestampSpy).toHaveBeenCalledOnceWith(detail);

    const propagatePropertySpy = spyOn(
      component.propagatePropertyNodeClick,
      'emit',
    );
    dataView.propagatePropertyClick.emit(propertiesTree);
    expect(propagatePropertySpy).toHaveBeenCalledOnceWith(propertiesTree);
  });
});

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
import {Component, TemplateRef, viewChild} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {assertDefined} from '@common/assert';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {DiffType} from '@ui/shared/tree/diff_type';
import {MockUiTreeBuilder} from '@ui/shared/tree/testing/mock_ui_tree_builder';
import {UiTreeNode} from '@ui/shared/tree/ui_tree_node';

import {TreeNodeComponent} from './tree_node_component';

describe('TreeNodeComponent', () => {
  let fixture: ComponentFixture<TreeNodeComponent<UiTreeNode>>;
  let component: TreeNodeComponent<UiTreeNode>;
  let dom: DOMTestHelper<TreeNodeComponent<UiTreeNode>>;
  let mockCopyText: jasmine.Spy;

  const tree = new MockUiTreeBuilder()
    .setId('test')
    .setName('tree')
    .setChildren([
      {id: 'key1', name: 'value1'},
      {id: 'key2', name: 'value2', children: [{id: 'key3', name: 'value3'}]},
    ])
    .build();
  tree.setHasShowState(false);
  tree.setCanBePinned(false);

  beforeEach(async () => {
    mockCopyText = jasmine.createSpy();
    await TestBed.configureTestingModule({
      providers: [{provide: Clipboard, useValue: {copy: mockCopyText}}],
      imports: [
        MatIconModule,
        MatTooltipModule,
        ClipboardModule,
        TreeNodeComponent,
        TestTemplateComponent,
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TreeNodeComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
  });

  it('can be created', () => {
    dom.setComponentInput('node', tree);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('can trigger tree toggle on click of chevron', () => {
    dom.setComponentInput('node', tree);
    spyOn(component, 'showChevron').and.returnValue(true);
    fixture.detectChanges();

    const spy = spyOn(component.toggleTreeChange, 'emit');
    dom.findAndClick('.toggle-tree-btn');
    expect(spy).toHaveBeenCalled();
  });

  it('can trigger tree expansion on click of expand tree button', () => {
    dom.setComponentInput('node', tree);
    fixture.detectChanges();
    const spy = spyOn(component.expandTreeChange, 'emit');
    dom.findAndClick('.expand-tree-btn');
    expect(spy).toHaveBeenCalled();
  });

  it('can collapse a tree if node is selected', () => {
    dom.setComponentInput('node', tree);
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
    dom.setComponentInput('node', tree);
    fixture.detectChanges();
    const expandButton = dom.get('.expand-tree-btn');
    expandButton.checkClassName('icon-button expand-tree-btn');
    expandButton.checkClassName('added', false);
    expandButton.checkClassName('modified', false);

    dom.setComponentInput(
      'node',
      new MockUiTreeBuilder()
        .setId('LayerTraceEntry')
        .setName('Added Diff')
        .setChildren([
          {id: '1', name: 'Child 1', children: [{id: '2', name: 'Child 2'}]},
        ])
        .build(),
    );
    assertDefined(component.node().getChildByName('Child 1')).setDiff(
      DiffType.ADDED,
    );
    fixture.detectChanges();
    expandButton.checkClassName('added');
    expandButton.checkClassName('modified', false);

    const modifiedNode = new MockUiTreeBuilder()
      .setId('LayerTraceEntry')
      .setName('Added Diff')
      .setChildren([
        {id: '1', name: 'Child 1', children: [{id: '2', name: 'Child 2'}]},
      ])
      .build();
    dom.setComponentInput('node', modifiedNode);
    const child1 = assertDefined(component.node().getChildByName('Child 1'));
    child1.setDiff(DiffType.ADDED);
    assertDefined(child1.getChildByName('Child 2')).setDiff(DiffType.DELETED);
    fixture.detectChanges();
    expandButton.checkClassName('added', false);
    expandButton.checkClassName('modified');
  });

  it('pins node on click', () => {
    dom.setComponentInput('node', tree);
    spyOn(component, 'showPinNodeIcon').and.returnValue(true);
    fixture.detectChanges();

    const spy = spyOn(component.pinNodeChange, 'emit');
    dom.findAndClick('.pin-node-btn');
    expect(spy).toHaveBeenCalledWith(component.node());
  });

  it('can trigger rect show state toggle on click of icon', () => {
    dom.setComponentInput('node', tree);
    dom.setComponentInput('showStateIcon', 'visibility');
    fixture.detectChanges();

    const spy = spyOn(component.rectShowStateChange, 'emit');
    dom.findAndClick('.toggle-rect-show-state-btn');
    expect(spy).toHaveBeenCalled();
  });

  it('does not show copy button for tree', () => {
    dom.setComponentInput(
      'node',
      new MockUiTreeBuilder().setId('LayerTraceEntry').setName('Root').build(),
    );
    fixture.detectChanges();
    expect(dom.find('.icon-wrapper-copy')).toBeUndefined();
  });

  it('does not show copy button for tree node that is not leaf or root', () => {
    const root = new MockUiTreeBuilder()
      .setId('test')
      .setName('tree')
      .setChildren([
        {id: '1', name: 'child1', children: [{id: '2', name: 'child2'}]},
      ])
      .build();
    const node1 = assertDefined(root.getChildByName('child1'));
    assertDefined(node1).setCopyText('copiable');
    dom.setComponentInput('node', node1);
    fixture.detectChanges();
    expect(dom.find('.icon-wrapper-copy')).toBeUndefined();
  });

  it('copies root node', () => {
    const root = new MockUiTreeBuilder()
      .setId('test')
      .setName('tree')
      .setChildren([])
      .build();
    root.setCopyText('copiable');
    dom.setComponentInput('node', root);
    fixture.detectChanges();
    dom.findAndClick('.icon-wrapper-copy button');
    expect(mockCopyText).toHaveBeenCalledWith('copiable');
  });

  it('copies leaf node', () => {
    const root = new MockUiTreeBuilder()
      .setId('test')
      .setName('tree')
      .setChildren([{id: '1', name: 'child1'}])
      .build();
    const child1 = assertDefined(root.getChildByName('child1'));
    child1.setCopyText('copiable');
    dom.setComponentInput('node', child1);
    dom.setComponentInput('isLeaf', true);
    fixture.detectChanges();
    dom.findAndClick('.icon-wrapper-copy button');
    expect(mockCopyText).toHaveBeenCalledWith('copiable');
  });

  it('shows input template for node', () => {
    const templateFixture = TestBed.createComponent(TestTemplateComponent);
    const templateComponent = templateFixture.componentInstance;
    templateFixture.detectChanges();
    const testTemplate = templateComponent.template();

    dom.setComponentInput('node', tree);
    dom.setComponentInput('dataView', testTemplate);
    dom.detectChanges();

    const description = dom.get('.description');
    expect(description.get('.test-node-name').getText()).toEqual(tree.name);
    expect(description.get('.test-node-id').getText()).toEqual(tree.id);
  });
});

@Component({
  selector: 'test-component',
  template: `
    <ng-template #testTemplate let-node="node">
      <span class="test-node-id"> {{node.id}} </span>
      <span class="test-node-name"> {{node.name}} </span>
    </ng-template>
  `,
})
class TestTemplateComponent {
  template = viewChild.required<TemplateRef<unknown>>('testTemplate');
}

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
import {TestBed} from '@angular/core/testing';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {VirtualRow, VirtualScrollViewportComponent,} from '@app/shared/scroll/virtual_scroll_viewport_component';
import {assertDefined} from '@common/assert';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';
import {ChildTreeNode, MockUiTreeBuilder,} from '@ui/shared/tree/testing/mock_ui_tree_builder';
import {UiTreeNode} from '@ui/shared/tree/ui_tree_node';
import {flattenNodesToRows} from '@ui/shared/tree/ui_tree_node_helpers';

import {TreeComponent} from './tree_component';
import {TreeNodeComponent} from './tree_node_component';
import {TreeNodeHeightPredictor} from './tree_node_height_predictor';

describe('TreeComponent', () => {
  let component: TreeComponent<UiTreeNode>;
  let dom: DOMTestHelper<TreeComponent<UiTreeNode>>;
  let mockCopyText: jasmine.Spy;
  let scrollSpy: jasmine.Spy<() => Promise<void>> | undefined;

  beforeEach(async () => {
    mockCopyText = jasmine.createSpy();
    await TestBed.configureTestingModule({
      providers: [{provide: Clipboard, useValue: {copy: mockCopyText}}],
      imports: [
        MatTooltipModule,
        MatIconModule,
        ClipboardModule,
        VirtualRow,
        VirtualScrollViewportComponent,
        TreeComponent,
        TreeNodeComponent,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TreeComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('nodeRows', makeNodeRows(makeTree()));
    dom.setComponentInput(
      'heightPredictor',
      new MockHeightPredictor(component.elementRef, (index: number) => {
        return component.filteredRows.at(index);
      }),
    );
    spyOn(component.highlightedChange, 'emit').and.callFake(
      (node: UiTreeNode) => {
        dom.setComponentInput('highlightedItem', node.id);
        dom.detectChanges();
      },
    );
  });

  afterEach(() => {
    scrollSpy = undefined;
  });

  it('can be created', () => {
    dom.detectChanges();
    expect(component).toBeTruthy();
  });

  it('shows node', async () => {
    await waitForNodeStability();
    expect(dom.find('tree-node')).toBeDefined();
  });

  it('can identify if a parent node has a selected child', async () => {
    await waitForNodeStability();
    const treeNode = dom.get('tree-node');
    treeNode.checkClassName('child-selected', false);
    dom.setComponentInput('highlightedItem', '2 Child2');
    dom.detectChanges();
    treeNode.checkClassName('child-selected', true);
  });

  it('highlights node and inner node upon click', async () => {
    await waitForNodeStability();
    const treeNodes = dom.findAll('tree-node');
    treeNodes[0].click();
    expect(component.highlightedItem()).toBe(component.nodeRows()[0].node.id);
    treeNodes[1].click();
    expect(component.highlightedItem()).toBe(component.nodeRows()[1].node.id);
  });

  it('toggles tree upon node double click', async () => {
    await waitForNodeStability();
    const toggleButton = dom.get('.toggle-tree-btn');
    toggleButton.checkTextExact('arrow_drop_down');
    checkIsExpanded(true);
    doubleClickFirstNode();
    toggleButton.checkTextExact('chevron_right');
    checkIsExpanded(false);
  });

  it('toggles tree without recursively expanding children', async () => {
    await waitForNodeStability();
    expect(dom.find('#nodeChild1')).toBeDefined();

    const nestedNodeToggle = dom.get('tree-node#nodeChild0 .toggle-tree-btn');
    nestedNodeToggle.click();
    expect(dom.find('#nodeChild1')).toBeUndefined();

    const rootNodeToggle = dom.get('.toggle-tree-btn');
    rootNodeToggle.click();
    checkIsExpanded(false);

    rootNodeToggle.click();
    expect(dom.find('#nodeChild1')).toBeUndefined();
  });

  it('does not toggle tree in flat mode on double click', async () => {
    dom.setComponentInput('isFlattened', true);
    await waitForNodeStability();
    doubleClickFirstNode();
    checkIsExpanded(true);
  });

  it('pins node on click', async () => {
    await waitForNodeStability();
    const spy = spyOn(component.pinnedItemChange, 'emit');
    dom.findAndClick('.pin-node-btn');
    expect(spy).toHaveBeenCalled();
  });

  it('expands tree on expand tree button click', async () => {
    await waitForNodeStability();
    doubleClickFirstNode();
    checkIsExpanded(false);
    dom.findAndClick('.expand-tree-btn');
    checkIsExpanded(true);
  });

  it('expands tree recursively expanding children', async () => {
    await waitForNodeStability();
    expect(dom.find('#nodeChild1')).toBeDefined();

    dom.get('tree-node#nodeChild0 .toggle-tree-btn').click();
    expect(dom.find('#nodeChild1')).toBeUndefined();

    dom.get('.toggle-tree-btn').click();
    dom.get('.expand-tree-btn').click();
    expect(dom.find('#nodeChild1')).toBeDefined();
  });

  it('expands any hidden parents on node selection', async () => {
    await waitForNodeStability();
    doubleClickFirstNode();
    checkIsExpanded(false);
    dom.setComponentInput('highlightedItem', '79 Child79');
    await waitForNodeStability();
    checkIsExpanded(true);
  });

  it('scrolls selected node only if not in view', async () => {
    restrictElementHeight();
    await waitForNodeStability();
    await checkNodeScrolling();
  });

  it('scrolls selected node if not in view even if pinned', async () => {
    restrictElementHeight();

    const nodeRows = component.nodeRows();
    dom.setComponentInput('pinnedItems', [
      assertDefined(nodeRows.find((row) => row.node.name === 'Child78')).node,
      assertDefined(nodeRows.find((row) => row.node.name === 'Child79')).node,
    ]);
    await waitForNodeStability();
    await checkNodeScrolling();
  });

  it('sets initial expanded state to true by default for all nodes', async () => {
    await waitForNodeStability();
    checkIsExpanded(true);
    expect(
      component.nodeRows().every((row) => {
        return row.localExpandedState && !row.isHiddenByCollapsedParent;
      }),
    ).toBeTrue();
  });

  it('sets initial expanded state to false if collapse state exists in store', async () => {
    dom.setComponentInput('useStoredExpandedState', true);
    await waitForNodeStability();
    // tree expanded by default
    checkIsExpanded(true);

    // tree collapsed
    doubleClickFirstNode();
    checkIsExpanded(false);

    // tree collapsed state retained
    dom.setComponentInput('nodeRows', makeNodeRows(makeTree()));
    dom.detectChanges();
    checkIsExpanded(false);
  });

  it('renders show state button if applicable', async () => {
    await waitForNodeStability();
    expect(dom.find('.toggle-rect-show-state-btn')).toBeUndefined();

    const id = component.nodeRows()[0].node.id;
    dom.setComponentInput(
      'rectIdToShowState',
      new Map([[id, RectShowState.HIDE]]),
    );
    dom.detectChanges();
    dom.get('.toggle-rect-show-state-btn').checkTextExact('visibility_off');

    dom.setComponentInput(
      'rectIdToShowState',
      new Map([[id, RectShowState.SHOW]]),
    );
    dom.detectChanges();
    dom.get('.toggle-rect-show-state-btn').checkTextExact('visibility');
  });

  it('handles show state button click', async () => {
    const nodeRows = component.nodeRows();
    dom.setComponentInput(
      'rectIdToShowState',
      new Map([[nodeRows[0].node.id, RectShowState.HIDE]]),
    );
    await waitForNodeStability();
    const button = dom.get('.toggle-rect-show-state-btn');
    button.checkTextExact('visibility_off');

    let id = '';
    spyOn(component.rectShowStateChange, 'emit').and.callFake((detail) => {
      id = detail.rectId;
      component.rectIdToShowState()?.set(detail.rectId, detail.state);
    });
    button.click();
    expect(component.rectIdToShowState()?.get(id)).toEqual(RectShowState.SHOW);
    button.click();
    expect(component.rectIdToShowState()?.get(id)).toEqual(RectShowState.HIDE);
  });

  it('shows node at full opacity when applicable', async () => {
    await waitForNodeStability();
    expect(dom.find('.node.full-opacity')).toBeDefined();

    const node = component.nodeRows()[0].node;
    dom.setComponentInput(
      'rectIdToShowState',
      new Map([[node.id, RectShowState.SHOW]]),
    );
    dom.detectChanges();
    expect(dom.find('.node.full-opacity')).toBeDefined();

    const tree = new MockUiTreeBuilder()
      .setId(node.id)
      .setName(node.name)
      .build();
    tree.setHasShowState(false);
    dom.setComponentInput('nodeRows', makeNodeRows(tree));
    dom.detectChanges();
    expect(dom.find('.node.full-opacity')).toBeDefined();
  });

  it('shows node at non-full opacity when applicable', async () => {
    dom.setComponentInput('rectIdToShowState', new Map([]));
    await waitForNodeStability();
    expect(dom.find('.node.full-opacity')).toBeUndefined();

    dom.setComponentInput(
      'rectIdToShowState',
      new Map([[component.nodeRows()[0].node.id, RectShowState.HIDE]]),
    );
    dom.detectChanges();
    expect(dom.find('.node.full-opacity')).toBeUndefined();
  });

  it('copies text via copy button without selecting node', async () => {
    const node = component.nodeRows()[0].node;
    const tree = new MockUiTreeBuilder()
      .setId(node.id)
      .setName(node.name)
      .build();
    tree.setCopyText('copy text');
    dom.setComponentInput('nodeRows', makeNodeRows(tree));
    await waitForNodeStability();

    const spy = spyOn(component, 'onNodeClick');
    dom.findAndClick('.icon-wrapper-copy button');
    expect(mockCopyText).toHaveBeenCalledWith('copy text');
    expect(spy).not.toHaveBeenCalled();
  });

  it('handles arrow down press', async () => {
    dom.setComponentInput('handleArrowPress', true);
    dom.detectChanges();
    dom.keydownArrowDown(true);
    expect(component.highlightedItem()).toBe('RootNode Root node');
    dom.keydownArrowDown(true);
    expect(component.highlightedItem()).toBe('0 Child0');
    dom.keydownArrowDown(true);
    expect(component.highlightedItem()).toBe('1 Child1');
    dom.keydownArrowDown(true);
    expect(component.highlightedItem()).toBe('2 Child2');
  });

  it('handles arrow down press when on last row', async () => {
    dom.setComponentInput('handleArrowPress', true);
    dom.setComponentInput('highlightedItem', '79 Child79');
    dom.detectChanges();
    dom.keydownArrowDown(true);
    expect(component.highlightedItem()).toBe('79 Child79');
  });

  it('handles arrow up press', async () => {
    dom.setComponentInput('handleArrowPress', true);
    dom.detectChanges();
    dom.keydownArrowUp(true);
    expect(component.highlightedItem()).toBe('79 Child79');
    dom.keydownArrowUp(true);
    expect(component.highlightedItem()).toBe('78 Child78');
    dom.keydownArrowUp(true);
    expect(component.highlightedItem()).toBe('77 Child77');
  });

  it('handles arrow up press when on first row', async () => {
    dom.setComponentInput('handleArrowPress', true);
    dom.setComponentInput('highlightedItem', 'RootNode Root node');
    dom.detectChanges();
    dom.keydownArrowUp(true);
    expect(component.highlightedItem()).toBe('RootNode Root node');
  });

  it('arrow press robust to no current trees', () => {
    dom.setComponentInput('handleArrowPress', true);
    dom.setComponentInput('nodeRows', []);
    dom.detectChanges();
    dom.keydownArrowDown(true);
    expect(component.highlightedItem()).toBe('');
    dom.keydownArrowUp(true);
    expect(component.highlightedItem()).toBe('');
  });

  it('arrow press skips nodes hidden by collapsed parent', () => {
    dom.setComponentInput('handleArrowPress', true);
    dom.detectChanges();
    dom.get('#nodeChild0 .toggle-tree-btn').click();
    dom.keydownArrowDown(true);
    expect(component.highlightedItem()).toBe('RootNode Root node');
    dom.keydownArrowDown(true);
    expect(component.highlightedItem()).toBe('0 Child0');
    dom.keydownArrowDown(true);
    expect(component.highlightedItem()).toBe('2 Child2');
    dom.keydownArrowUp(true);
    expect(component.highlightedItem()).toBe('0 Child0');
  });

  it('passes input template for data view to tree node', () => {
    const templateFixture = TestBed.createComponent(TestTemplateComponent);
    const templateComponent = templateFixture.componentInstance;
    templateFixture.detectChanges();
    const testTemplate = templateComponent.template();

    dom.setComponentInput('dataView', testTemplate);
    dom.detectChanges();

    const nodes = dom.findAllByDirective(TreeNodeComponent);
    expect(nodes.length).toBeGreaterThan(0);
    nodes.forEach((node) => {
      expect(node.dataView()).toEqual(testTemplate);
    });
  });

  function makeNodeRows(tree: UiTreeNode) {
    return flattenNodesToRows([tree], true, false, '');
  }

  function makeTree() {
    const children: ChildTreeNode[] = [];
    for (let i = 0; i < 40; i++) {
      const parentId = i * 2;
      const childId = parentId + 1;
      children.push({
        id: parentId.toString(),
        name: `Child${parentId}`,
        children: [{id: childId.toString(), name: `Child${childId}`}],
      });
    }
    return new MockUiTreeBuilder()
      .setId('RootNode')
      .setName('Root node')
      .setChildren(children)
      .build();
  }

  function doubleClickFirstNode() {
    dom.get('tree-node').dispatchEvent(new MouseEvent('click', {detail: 2}));
    dom.detectChanges();
  }

  function checkIsExpanded(isExpanded: boolean) {
    const visibleNodes = dom.findAll('tree-node').length;
    if (isExpanded) {
      expect(visibleNodes).toBeGreaterThanOrEqual(20);
    } else {
      expect(visibleNodes).toBe(1);
    }
  }

  async function checkNodeScrolling() {
    dom.setComponentInput('highlightedItem', 'Root node');
    await waitForNodeStability();

    dom.setComponentInput('highlightedItem', '79 Child79');
    await waitForNodeStability();
    const spy = getScrollSpy();
    expect(spy).toHaveBeenCalledTimes(1);

    dom.setComponentInput('highlightedItem', '78 Child78');
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
  }

  function getScrollSpy(): jasmine.Spy<() => Promise<void>> {
    if (!scrollSpy) {
      scrollSpy = spyOn(
        component.virtualScrollViewport(),
        'scrollToIndex',
      ).and.callThrough();
    }
    return scrollSpy;
  }

  async function waitForNodeStability() {
    await dom.detectChangesAndWaitStable();
    await getScrollSpy().calls.mostRecent()?.returnValue;
  }

  function restrictElementHeight() {
    const htmlElement = dom.getHTMLElement();
    htmlElement.style.height = '500px';
    htmlElement.style.display = 'flex';
    htmlElement.style.flexDirection = 'column';
    dom.detectChanges();
  }
});

@Component({
  selector: 'test-component',
  template: `
    <ng-template #testTemplate let-node="node">
      <span class="test-node-name"> {{node.name}} </span>
      <span class="test-node-id"> {{node.id}} </span>
    </ng-template>
  `,
})
class TestTemplateComponent {
  template = viewChild.required<TemplateRef<unknown>>('testTemplate');
}

class MockHeightPredictor extends TreeNodeHeightPredictor<UiTreeNode> {
  protected override getRowWidth(
    _: FlattenedTreeRow<UiTreeNode>,
    fullWidth: number,
  ): number {
    return fullWidth;
  }

  protected override getTextWidths(node: UiTreeNode): number[] {
    return [node.getDisplayName().length * this.charWidth];
  }
}

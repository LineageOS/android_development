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
import {ClipboardModule} from '@angular/cdk/clipboard';
import {CommonModule} from '@angular/common';
import {TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {FilterFlag} from '@common/filter_flag';
import {PersistentStore} from '@common/store/persistent_store';
import {makeWarningDuplicateLayerIds, makeWarningMissingLayerIds,} from '@parsers/helpers/warnings';
import {checkTooltips, DOMTestHelper} from '@test/unit/common/dom_test_helpers';
import {HierarchyTreeBuilder} from '@test/unit/tree_node/hierarchy_tree_builder';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {TextFilter} from '@viewers/common/text_filter';
import {UiHierarchyTreeNode} from '@viewers/common/ui_hierarchy_tree_node';
import {flattenNodesToRows} from '@viewers/common/ui_tree_node_helpers';
import {ViewerEvents} from '@viewers/common/viewer_events';
import {HierarchyTreeNodeDataViewComponent} from '@viewers/components/hierarchy_tree_node_data_view_component';
import {TreeNodeComponent} from '@viewers/components/tree_node_component';

import {CollapsibleSectionTitleComponent} from './collapsible_section_title_component';
import {HierarchyComponent} from './hierarchy_component';
import {VirtualRow, VirtualScrollViewportComponent,} from './scroll/virtual_scroll_viewport_component';
import {SearchBoxComponent} from './search_box_component';
import {TreeComponent} from './tree_component';
import {UserOptionsComponent} from './user_options_component';

describe('HierarchyComponent', () => {
  let component: HierarchyComponent;
  let dom: DOMTestHelper<HierarchyComponent>;

  const nodeRows = flattenNodesToRows(
    [
      UiHierarchyTreeNode.from(
        new HierarchyTreeBuilder()
          .setId('RootNode1')
          .setName('Root node')
          .setChildren([{id: 'Child1', name: 'Child node'}])
          .build(),
      ),
    ],
    false,
    false,
    '',
  );

  const dependencies = [TraceType.SURFACE_FLINGER];
  const userOptions = {
    showDiff: {
      name: 'Show diff',
      enabled: false,
      isUnavailable: false,
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HierarchyComponent,
        HierarchyTreeNodeDataViewComponent,
        CollapsibleSectionTitleComponent,
        UserOptionsComponent,
        SearchBoxComponent,
        TreeNodeComponent,
        TreeComponent,
        VirtualScrollViewportComponent,
        VirtualRow,
        CommonModule,
        MatButtonModule,
        MatDividerModule,
        MatInputModule,
        MatFormFieldModule,
        BrowserAnimationsModule,
        FormsModule,
        MatIconModule,
        MatTooltipModule,
        ClipboardModule,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HierarchyComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);

    dom.setComponentInput('nodeRows', nodeRows);
    dom.setComponentInput('dependencies', dependencies);
    dom.setComponentInput('userOptions', userOptions);
    dom.setComponentInput('textFilter', new TextFilter());
    dom.setComponentInput('store', new PersistentStore());
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('renders title', () => {
    expect(dom.find('.hierarchy-title')).toBeDefined();
  });

  it('renders view controls', () => {
    expect(dom.find('.view-controls')).toBeDefined();
    // renders at least one view control option
    expect(dom.find('.view-controls .user-option')).toBeDefined();
  });

  it('renders initial tree elements', () => {
    expect(dom.findAll('tree-node').length).toBe(2);
    const treeView = dom.get('tree-view');
    treeView.checkText('Root node');
    treeView.checkText('Child node');
  });

  it('renders pinned nodes', () => {
    expect(dom.find('.pinned-items')).toBeUndefined();
    dom.setComponentInput('pinnedItems', [component.nodeRows()[0].node]);
    dom.detectChanges();
    expect(dom.find('.pinned-items tree-node')).toBeDefined();
  });

  it('renders placeholder text', () => {
    dom.setComponentInput('nodeRows', []);
    dom.setComponentInput('placeholderText', 'Placeholder text.');
    dom.detectChanges();

    const placeholderText = dom.get('.placeholder-text');
    placeholderText.checkTextExact(
      'Placeholder text.' +
        ` There may be no ${
          TRACE_INFO[component.dependencies()[0]].name
        } state associated with the current state in the active trace.` +
        ' Try changing timeline position.',
    );

    dom.setComponentInput('dependencies', []);
    dom.detectChanges();
    placeholderText.checkTextExact(
      'Placeholder text.' +
        ' There may be no state for this trace associated with the current state in the active trace.' +
        ' Try changing timeline position.',
    );
  });

  it('handles pinned node click', () => {
    const node = component.nodeRows()[0].node;
    dom.setComponentInput('pinnedItems', [node]);
    dom.detectChanges();

    let highlightedItem: UiHierarchyTreeNode | undefined;
    dom.addEventListener(ViewerEvents.HighlightedNodeChange, (event) => {
      highlightedItem = (event as CustomEvent).detail.node;
    });

    dom.findAndClick('.pinned-items tree-node');
    expect(highlightedItem).toEqual(node);
  });

  it('handles pinned item change from tree', () => {
    let pinnedItem: UiHierarchyTreeNode | undefined;
    dom.addEventListener(ViewerEvents.HierarchyPinnedChange, (event) => {
      pinnedItem = (event as CustomEvent).detail.pinnedItem;
    });
    const child = component.nodeRows()[1].node;
    dom.setComponentInput('pinnedItems', [child]);
    dom.detectChanges();

    dom.findAndClick('.pinned-items tree-node .pin-node-btn');
    expect(pinnedItem).toEqual(child);
  });

  it('handles change in filter', () => {
    let textFilter: TextFilter | undefined;
    dom.addEventListener(ViewerEvents.HierarchyFilterChange, (event) => {
      textFilter = (event as CustomEvent).detail;
    });
    dom.findAndClick('.search-box button');
    dom.findAndDispatchInput('.title-section', 'Root');
    expect(textFilter).toEqual(new TextFilter('Root', [FilterFlag.MATCH_CASE]));
  });

  it('handles collapse button click', () => {
    const spy = spyOn(component.collapseButtonClicked, 'emit');
    dom.findAndClick('collapsible-section-title button');
    expect(spy).toHaveBeenCalled();
  });

  it('shows warnings from all trees', () => {
    expect(dom.find('.warning')).toBeUndefined();

    const newRows = [
      component.nodeRows()[0],
      ...flattenNodesToRows(
        [
          UiHierarchyTreeNode.from(
            new HierarchyTreeBuilder()
              .setId('RootNode2')
              .setName('Root node')
              .setChildren([{id: 'Child2', name: 'Child node'}])
              .build(),
          ),
        ],
        false,
        false,
        '',
      ),
    ];
    dom.setComponentInput('nodeRows', newRows);
    dom.detectChanges();

    const warning1 = makeWarningDuplicateLayerIds([123]);
    const rows = component.nodeRows().slice();
    spyOn(rows[0].node, 'getWarnings').and.returnValue([warning1]);
    const warning2 = makeWarningMissingLayerIds();
    spyOn(rows[1].node, 'getWarnings').and.returnValue([warning2]);
    dom.setComponentInput('nodeRows', rows);
    dom.detectChanges();
    const warnings = dom.findAll('.warning');
    expect(warnings.length).toBe(2);
    warnings[0].checkTextExact('warning ' + warning1.message);
    warnings[1].checkTextExact('warning ' + warning2.message);
  });

  it('shows warning tooltip if text overflowing', async () => {
    const warning = makeWarningDuplicateLayerIds([123]);
    const rows = component.nodeRows().slice();
    spyOn(rows[0].node, 'getWarnings').and.returnValue([warning]);
    dom.setComponentInput('nodeRows', rows);
    dom.detectChanges();

    const warningEl = dom.get('.warning');
    const msgEl = dom.get('.warning-message').getHTMLElement();

    const spy = spyOnProperty(msgEl, 'scrollWidth').and.returnValue(
      msgEl.clientWidth,
    );
    await checkTooltips([warningEl], [undefined]);

    spy.and.returnValue(msgEl.clientWidth + 1);
    dom.detectChanges();
    await checkTooltips([warningEl], [warning.message]);
  });
});

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
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {assertDefined} from '@common/assert';
import {FilterFlag} from '@common/filter_flag';
import {PersistentStore} from '@common/store/persistent_store';
import {makeElapsedTimestamp} from '@common/time/test_helpers';
import {DOMTestHelper} from '@test/unit/common/dom_test_helpers';
import {PropertyTreeBuilder} from '@test/unit/tree_node/property_tree_builder';
import {makeUiPropertyNode} from '@test/unit/ui_tree_node_utils';
import {TraceType} from '@trace_api/trace_type';
import {TextFilter} from '@viewers/common/text_filter';
import {UiPropertyTreeNode} from '@viewers/common/ui_property_tree_node';
import {flattenNodesToRows} from '@viewers/common/ui_tree_node_helpers';
import {TimestampClickDetail} from '@viewers/common/viewer_event_details';

import {CollapsibleSectionTitleComponent} from './collapsible_section_title_component';
import {PropertiesComponent} from './properties_component';
import {PropertyTreeNodeDataViewComponent} from './property_tree_node_data_view_component';
import {VirtualRow, VirtualScrollViewportComponent,} from './scroll/virtual_scroll_viewport_component';
import {SearchBoxComponent} from './search_box_component';
import {SurfaceFlingerPropertyGroupsComponent} from './surface_flinger_property_groups_component';
import {TreeComponent} from './tree_component';
import {TreeNodeComponent} from './tree_node_component';
import {UserOptionsComponent} from './user_options_component';

describe('PropertiesComponent', () => {
  let component: PropertiesComponent;
  let dom: DOMTestHelper<PropertiesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        CommonModule,
        MatInputModule,
        MatFormFieldModule,
        MatButtonModule,
        MatDividerModule,
        BrowserAnimationsModule,
        FormsModule,
        ReactiveFormsModule,
        MatIconModule,
        MatTooltipModule,
        ClipboardModule,
        VirtualRow,
        VirtualScrollViewportComponent,
        TreeComponent,
        PropertyTreeNodeDataViewComponent,
        TreeNodeComponent,
        PropertiesComponent,
        SurfaceFlingerPropertyGroupsComponent,
        CollapsibleSectionTitleComponent,
        UserOptionsComponent,
        SearchBoxComponent,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PropertiesComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('store', new PersistentStore());
    dom.setComponentInput('userOptions', {
      showDiff: {
        name: 'Show diff',
        enabled: false,
        isUnavailable: false,
      },
    });
    dom.setComponentInput('textFilter', new TextFilter());
    dom.setComponentInput('traceType', TraceType.SURFACE_FLINGER);
    dom.setComponentInput('nodeRows', []);
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('creates title', () => {
    expect(dom.find('.properties-title')).toBeDefined();
  });

  it('renders view controls', () => {
    expect(dom.find('.view-controls')).toBeDefined();
    expect(dom.find('.view-controls .user-option')).toBeDefined(); //renders at least one view control option
  });

  it('renders tree in proto dump upon selected item', () => {
    makeAndSetTreeInput();
    expect(dom.find('tree-view')).toBeDefined();
  });

  it('renders placeholder text', () => {
    dom.setComponentInput('nodeRows', []);
    dom.setComponentInput('placeholderText', 'Placeholder text');
    dom.detectChanges();
    dom.get('.placeholder-text').checkTextExact('Placeholder text');
  });

  it('handles node click', async () => {
    const uiTree = makeAndSetTreeInput();
    await dom.whenStable();
    const spy = spyOn(component.highlightedPropertyChange, 'emit');
    dom.findAndClick('tree-node');
    expect(spy).toHaveBeenCalledOnceWith(uiTree.id);
  });

  it('handles change in filter', () => {
    const spy = spyOn(component.filterChange, 'emit');
    dom.findAndClick('.search-box button');
    dom.findAndDispatchInput('.title-section', 'Root');
    expect(spy).toHaveBeenCalledWith(
      new TextFilter('Root', [FilterFlag.MATCH_CASE]),
    );
  });

  it('handles change in user options', () => {
    const userOptions = assertDefined(
      dom.findByDirective(UserOptionsComponent),
    );
    const spy = spyOn(component.optionsChange, 'emit');
    const options = {opt: {name: 'opt', enabled: true}};
    userOptions.optionsChange.emit(options);
    expect(spy).toHaveBeenCalledOnceWith(options);
  });

  it('handles collapse button click', () => {
    const spy = spyOn(component.collapseButtonClicked, 'emit');
    dom.findAndClick('collapsible-section-title button');
    expect(spy).toHaveBeenCalled();
  });

  it('propagates timestamp click', () => {
    makeAndSetTreeInput();
    const tree = assertDefined(dom.findByDirective(TreeComponent));
    const tsSpy = spyOn(component.timestampClick, 'emit');
    const tsDetail = new TimestampClickDetail(
      undefined,
      makeElapsedTimestamp(2n),
    );
    tree.timestampClick.emit(tsDetail);
    expect(tsSpy).toHaveBeenCalledOnceWith(tsDetail);
  });

  it('propagates property', () => {
    makeAndSetTreeInput();
    const tree = assertDefined(dom.findByDirective(TreeComponent));
    const propSpy = spyOn(component.propagatePropertyClick, 'emit');
    const propDetail = makeUiPropertyNode('id', 'name', false);
    tree.propagatePropertyClick.emit(propDetail);
    expect(propSpy).toHaveBeenCalledOnceWith(propDetail);
  });

  function makeAndSetTreeInput(): UiPropertyTreeNode {
    const tree = new PropertyTreeBuilder()
      .setRootId('selectedItem')
      .setName('property')
      .setValue(undefined)
      .build();
    tree.setIsRoot(true);
    const uiTree = UiPropertyTreeNode.from(tree);
    dom.setComponentInput(
      'nodeRows',
      flattenNodesToRows([uiTree], false, false, ''),
    );
    dom.detectChanges();
    return uiTree;
  }
});

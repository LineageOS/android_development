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

import {Store} from '@common/store/store';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {AbstractHierarchyViewerPresenter, NotifyHierarchyViewCallbackType,} from '@ui/shared/hierarchy/abstract_hierarchy_viewer_presenter';
import {HierarchyPresenter} from '@ui/shared/hierarchy/hierarchy_presenter';
import {UiDataHierarchy} from '@ui/shared/hierarchy/ui_data_hierarchy';
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {PropertiesPresenter} from '@ui/shared/properties/properties_presenter';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {DisplayIdentifier} from '@ui/shared/rects/display_identifier';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {RectsPresenter} from '@ui/shared/rects/rects_presenter';
import {UiRect} from '@ui/shared/rects/ui_rect';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';

/**
 * Mock implementation of AbstractHierarchyViewerPresenter for tests.
 */
export class MockPresenter extends AbstractHierarchyViewerPresenter<UiDataHierarchy> {
  protected override hierarchyPresenter = new HierarchyPresenter(
    {opt: {name: '', enabled: false}},
    new TextFilter(),
    [],
    true,
    false,
    this.getEntryFormattedTimestamp,
  );
  protected override propertiesPresenter = new PropertiesPresenter(
    {opt: {name: '', enabled: false}},
    new TextFilter(),
    [],
  );
  uiRects: UiRect[] = [];
  displays: DisplayIdentifier[] = [];

  constructor(
    trace: Trace<HierarchyTreeNode>,
    traces: Traces,
    storage: Store,
    notifyViewCallback: NotifyHierarchyViewCallbackType<UiDataHierarchy>,
    protected readonly multiTraceType: TraceType | undefined,
  ) {
    super(trace, traces, storage, notifyViewCallback, new MockData());
  }

  initializeRectsPresenter() {
    this.rectsPresenter = new RectsPresenter(
      {opt: {name: 'Test opt', enabled: false}},
      () => this.uiRects,
      (rectsToDraw: UiRect[]) => (rectsToDraw.length > 0 ? this.displays : []),
    );
  }

  override async onHighlightedNodeChange(node: UiHierarchyTreeNode) {
    await this.applyHighlightedNodeChange(node);
    this.refreshHierarchyViewerUiData();
  }

  override async onHighlightedIdChange(id: string) {
    await this.applyHighlightedIdChange(id);
    this.refreshHierarchyViewerUiData();
  }

  protected override keepCalculated(): boolean {
    return false;
  }

  protected override getOverrideDisplayName(): string | undefined {
    return undefined;
  }

  protected override refreshUIData(): void {
    this.refreshHierarchyViewerUiData();
  }
}

/**
 * Mock implementation of UiDataHierarchy for tests.
 */
export class MockData implements UiDataHierarchy {
  highlightedItem = '';
  pinnedItems: UiHierarchyTreeNode[] = [];
  hierarchyUserOptions: UserOptions = {};
  hierarchyNodes: Array<FlattenedTreeRow<UiHierarchyTreeNode>> | undefined;
  propertiesUserOptions: UserOptions = {};
  propertyNodes: Array<FlattenedTreeRow<UiPropertyTreeNode>> | undefined;
  highlightedProperty = '';
  hierarchyFilter = new TextFilter();
  propertiesFilter = new TextFilter();
  isDarkMode?: boolean;
  rectsToDraw: UiRect[] = [];
  rectIdToShowState = new Map<string, RectShowState>();
  displays: DisplayIdentifier[] = [];
  rectsUserOptions: UserOptions = {};
}

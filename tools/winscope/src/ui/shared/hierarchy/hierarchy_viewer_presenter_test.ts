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

import {MockPresenter} from '@app/shared/testing/mock_hierarchy_viewer_presenter';
import {assertDefined} from '@common/assert';
import {TransformMatrix} from '@common/geometry/transform_matrix';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {makeElapsedTimestamp, makeRealTimestamp,} from '@common/time/testing/test_helpers';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {Trace} from '@trace_api/trace';
import {TracePositionUpdate} from '@trace_api/trace_events';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {DarkModeToggled, FilterPresetApplyRequest, FilterPresetSaveRequest,} from '@ui/shared/events/misc_events';
import {makeUiHierarchyNode, treeNodeEqualityTester,} from '@ui/shared/hierarchy/testing/ui_hierarchy_tree_node_test_helpers';
import {UiDataHierarchy} from '@ui/shared/hierarchy/ui_data_hierarchy';
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {UiRectBuilder} from '@ui/shared/rects/ui_rect_builder';
import {DiffType} from '@ui/shared/tree/diff_type';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';

describe('AbstractHierarchyViewerPresenter', () => {
  const timestamp2 = makeElapsedTimestamp(2n);
  const timestamp3 = makeElapsedTimestamp(3n);
  let uiData: UiDataHierarchy;
  let presenter: MockPresenter;
  let trace: Trace<HierarchyTreeNode>;
  let traces: Traces;
  let positionUpdate: TracePositionUpdate;
  let secondPositionUpdate: TracePositionUpdate;
  let selectedUiTree: UiHierarchyTreeNode;
  let storage: InMemoryStorage;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(treeNodeEqualityTester);
    trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.SURFACE_FLINGER)
      .setEntries([
        new HierarchyTreeBuilder()
          .setRootNodeFormatter(new SetFormatters())
          .setId('Test Trace')
          .setName('entry')
          .setChildren([
            {
              id: '1',
              name: 'p1',
              properties: {isComputedVisible: true, testProp: true},
              children: [
                {id: '3', name: 'c3', properties: {isComputedVisible: true}},
              ],
            },
            {id: '2', name: 'p2', properties: {isComputedVisible: false}},
          ])
          .build(),
        new HierarchyTreeBuilder()
          .setRootNodeFormatter(new SetFormatters())
          .setId('Test Trace')
          .setName('entry')
          .setChildren([
            {
              id: '1',
              name: 'p1',
              properties: {isComputedVisible: true, testProp: false},
            },
            {id: '2', name: 'p2'},
          ])
          .build(),
      ])
      .setTimestamps([timestamp2, timestamp3])
      .build();
    const selectedTree = assertDefined(
      (await trace.getEntry(0).getValue()).getChildByName('p1'),
    );
    selectedUiTree = UiHierarchyTreeNode.from(selectedTree);
    positionUpdate = TracePositionUpdate.fromTraceEntry(trace.getEntry(0));
    secondPositionUpdate = TracePositionUpdate.fromTraceEntry(
      trace.getEntry(1),
    );
    traces = new Traces();
    traces.addTrace(trace);
  });

  beforeEach(() => {
    storage = new InMemoryStorage();
    presenter = new MockPresenter(
      trace,
      traces,
      storage,
      (newData) => {
        uiData = newData;
      },
      undefined,
    );
  });

  it('clears ui data before throwing error on corrupted trace', async () => {
    const notifyViewCallback = (newData: UiDataHierarchy) => {
      uiData = newData;
    };
    const trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.SURFACE_FLINGER)
      .setEntries([
        new HierarchyTreeBuilder()
          .setRootNodeFormatter(new SetFormatters())
          .setId('Test Trace')
          .setName('entry')
          .setChildren([])
          .build(),
      ])
      .setTimestamps([timestamp2])
      .setIsCorrupted(true)
      .build();
    const traces = new Traces();
    traces.addTrace(trace);
    const presenter = new MockPresenter(
      trace,
      traces,
      new InMemoryStorage(),
      notifyViewCallback,
      undefined,
    );
    initializeRectsPresenter(presenter);

    try {
      await presenter.onAppEvent(
        TracePositionUpdate.fromTraceEntry(trace.getEntry(0)),
      );
      fail('error should be thrown for corrupted trace');
    } catch (_) {
      expect(Object.keys(uiData.hierarchyUserOptions).length).toBeGreaterThan(
        0,
      );
      expect(Object.keys(uiData.propertiesUserOptions).length).toBeGreaterThan(
        0,
      );
      expect(uiData.hierarchyNodes).toBeUndefined();
      expect(uiData.propertyNodes).toBeUndefined();
      expect(uiData.highlightedItem).toBe('');
      expect(uiData.highlightedProperty).toBe('');
      expect(uiData.pinnedItems.length).toBe(0);
      expect(
        Object.keys(assertDefined(uiData?.rectsUserOptions)).length,
      ).toBeGreaterThan(0);
      expect(uiData.rectsToDraw).toEqual([]);
    }
  });

  it('processes trace position updates', async () => {
    initializeRectsPresenter();
    pinNode(selectedUiTree);
    await presenter.onAppEvent(positionUpdate);

    expect(uiData.highlightedItem?.length).toBe(0);
    expect(Object.keys(uiData.hierarchyUserOptions).length).toBeGreaterThan(0);
    expect(Object.keys(uiData.propertiesUserOptions).length).toBeGreaterThan(0);
    expect(assertDefined(uiData.hierarchyNodes?.length)).toBe(4);
    expect(uiData.pinnedItems.length).toBeGreaterThan(0);
    expect(
      Object.keys(assertDefined(uiData.rectsUserOptions)).length,
    ).toBeGreaterThan(0);
    expect(uiData.rectsToDraw?.length).toBeGreaterThan(0);
    expect(uiData.displays?.length).toBeGreaterThan(0);

    await presenter.onHighlightedNodeChange(selectedUiTree);
    expect(uiData.propertyNodes?.length).toBeGreaterThan(0);

    await presenter.onAppEvent(
      TracePositionUpdate.fromTimestamp(makeElapsedTimestamp(1n)),
    );
    expect(uiData.hierarchyNodes).toBeUndefined();
    expect(uiData.pinnedItems.length).toBe(0);
    expect(uiData.rectsToDraw).toEqual([]);
    expect(uiData.displays).toEqual([]);
    expect(uiData.propertyNodes).toBeUndefined();
  });

  it('is robust to empty trace', async () => {
    const callback = (newData: UiDataHierarchy) => {
      uiData = newData;
    };
    const trace = makeEmptyTrace<HierarchyTreeNode>(TraceType.WINDOW_MANAGER);
    const traces = new Traces();
    traces.addTrace(trace);
    const presenter = new MockPresenter(
      trace,
      traces,
      new InMemoryStorage(),
      callback,
      undefined,
    );
    presenter.initializeRectsPresenter();

    const positionUpdateWithoutTraceEntry = TracePositionUpdate.fromTimestamp(
      makeRealTimestamp(0n),
    );
    await presenter.onAppEvent(positionUpdateWithoutTraceEntry);

    expect(Object.keys(uiData.hierarchyUserOptions).length).toBeGreaterThan(0);
    expect(Object.keys(uiData.propertiesUserOptions).length).toBeGreaterThan(0);
    expect(uiData.hierarchyNodes).toBeUndefined();
    expect(
      Object.keys(assertDefined(uiData?.rectsUserOptions)).length,
    ).toBeGreaterThan(0);
  });

  it('handles filter preset requests', async () => {
    initializeRectsPresenter();
    await presenter.onAppEvent(positionUpdate);
    const saveEvent = new FilterPresetSaveRequest(
      'TestPreset',
      TraceType.TEST_TRACE_STRING,
    );
    expect(storage.get(saveEvent.name)).toBeUndefined();
    await presenter.onAppEvent(saveEvent);
    expect(storage.get(saveEvent.name)).toBeDefined();

    await presenter.onHierarchyFilterChange(new TextFilter('Test Filter'));
    await presenter.onHierarchyUserOptionsChange({});
    await presenter.onPropertiesUserOptionsChange({});
    await presenter.onPropertiesFilterChange(new TextFilter('Test Filter'));
    presenter.onRectsUserOptionsChange({});
    await presenter.onRectShowStateChange(
      assertDefined(uiData.rectsToDraw)[0].id,
      RectShowState.HIDE,
    );
    const currentUiData = uiData;

    const applyEvent = new FilterPresetApplyRequest(
      saveEvent.name,
      TraceType.TEST_TRACE_STRING,
    );
    await presenter.onAppEvent(applyEvent);
    expect(uiData).not.toEqual(currentUiData);
  });

  it('updates dark mode', async () => {
    expect(uiData.isDarkMode).toBeFalse();
    await presenter.onAppEvent(new DarkModeToggled(true));
    expect(uiData.isDarkMode).toBeTrue();
  });

  it('disables show diff if no prev entry available', async () => {
    const userOptions: UserOptions = {
      showDiff: {name: '', enabled: false, isUnavailable: false},
    };
    await presenter.onHierarchyUserOptionsChange(userOptions);
    await presenter.onPropertiesUserOptionsChange(userOptions);
    await presenter.onAppEvent(positionUpdate);
    expect(uiData.hierarchyUserOptions['showDiff'].isUnavailable).toBeTrue();
    expect(uiData.propertiesUserOptions['showDiff'].isUnavailable).toBeTrue();
  });

  it('shows correct hierarchy tree name for entry', async () => {
    const spy = spyOn(
      assertDefined(positionUpdate.position.entry?.getFullTrace()),
      'isDumpWithoutTimestamp',
    );
    spy.and.returnValue(false);
    await presenter.onAppEvent(positionUpdate);
    const entryNode = assertDefined(uiData.hierarchyNodes?.at(0)).node;
    expect(entryNode.getDisplayName()).toContain(
      positionUpdate.position.timestamp.format(),
    );

    pinNode(entryNode);
    spy.and.returnValue(true);
    await presenter.onAppEvent(positionUpdate);
    const newEntryNode = assertDefined(uiData.hierarchyNodes?.at(0)).node;
    expect(newEntryNode.getDisplayName()).toContain('Dump');
    expect(uiData.pinnedItems).toEqual([newEntryNode]);
  });

  it('handles pinned item change', () => {
    expect(uiData.pinnedItems).toEqual([]);
    const item = makeUiHierarchyNode({id: '', name: ''});
    presenter.onPinnedItemChange(item);
    expect(uiData.pinnedItems).toEqual([item]);
    presenter.onPinnedItemChange(item);
    expect(uiData.pinnedItems).toEqual([]);
  });

  it('updates and applies hierarchy user options', async () => {
    await presenter.onAppEvent(positionUpdate);
    const userOptions: UserOptions = {flat: {name: '', enabled: true}};
    await presenter.onHierarchyUserOptionsChange(userOptions);
    expect(uiData.hierarchyUserOptions).toEqual(userOptions);
    expect(uiData.hierarchyNodes?.at(0)?.node.getAllChildren().length).toBe(3);
  });

  it('updates highlighted property', () => {
    const id = '4';
    presenter.onHighlightedPropertyChange(id);
    expect(uiData.highlightedProperty).toEqual(id);
    presenter.onHighlightedPropertyChange(id);
    expect(uiData.highlightedProperty).toBe('');
  });

  it('sets properties tree and associated ui data from tree node', async () => {
    await presenter.onAppEvent(positionUpdate);
    await presenter.onHighlightedNodeChange(selectedUiTree);
    const propertiesTree = assertDefined(uiData.propertyNodes?.at(0)?.node);
    expect(propertiesTree.id).toContain(selectedUiTree.id);
    expect(propertiesTree.getAllChildren().length).toBe(2);
  });

  it('updates and applies properties user options, calculating diffs from prev hierarchy tree', async () => {
    await presenter.onAppEvent(positionUpdate);
    await presenter.onHighlightedIdChange(selectedUiTree.id);
    await presenter.onAppEvent(secondPositionUpdate);
    expect(
      uiData.propertyNodes?.at(0)?.node?.getChildByName('testProp')?.getDiff(),
    ).toEqual(DiffType.NONE);

    const userOptions: UserOptions = {showDiff: {name: '', enabled: true}};
    await presenter.onPropertiesUserOptionsChange(userOptions);
    expect(uiData.propertiesUserOptions).toEqual(userOptions);
    expect(
      uiData.propertyNodes?.at(0)?.node?.getChildByName('testProp')?.getDiff(),
    ).toEqual(DiffType.MODIFIED);
  });

  it('is robust to attempts to change rect user data if no rects presenter', async () => {
    expect(() => presenter.onRectsUserOptionsChange({})).not.toThrowError();
    await expectAsync(
      presenter.onRectShowStateChange('', RectShowState.SHOW),
    ).not.toBeRejected();
  });

  it('creates input data for rects view', async () => {
    initializeRectsPresenter();
    await presenter.onAppEvent(positionUpdate);
    const rectsToDraw = assertDefined(uiData.rectsToDraw);
    const expectedFirstRect = presenter.uiRects[0];
    expect(rectsToDraw[0].x).toEqual(expectedFirstRect.x);
    expect(rectsToDraw[0].y).toEqual(expectedFirstRect.y);
    expect(rectsToDraw[0].w).toEqual(expectedFirstRect.w);
    expect(rectsToDraw[0].h).toEqual(expectedFirstRect.h);
    checkRectUiData(uiData, 3, 3, 3);
  });

  it('filters rects by visibility', async () => {
    initializeRectsPresenter();
    const userOptions: UserOptions = {
      showOnlyVisible: {name: '', enabled: false},
    };
    await presenter.onAppEvent(positionUpdate);
    presenter.onRectsUserOptionsChange(userOptions);
    expect(uiData.rectsUserOptions).toEqual(userOptions);
    checkRectUiData(uiData, 3, 3, 3);

    userOptions['showOnlyVisible'].enabled = true;
    presenter.onRectsUserOptionsChange(userOptions);
    checkRectUiData(uiData, 2, 3, 2);
  });

  it('filters rects by show/hide state', async () => {
    initializeRectsPresenter();
    const userOptions: UserOptions = {
      ignoreRectShowState: {
        name: 'Ignore',
        icon: 'visibility',
        enabled: true,
      },
    };
    await presenter.onAppEvent(positionUpdate);
    presenter.onRectsUserOptionsChange(userOptions);
    checkRectUiData(uiData, 3, 3, 3);

    await presenter.onRectShowStateChange(
      assertDefined(uiData.rectsToDraw)[0].id,
      RectShowState.HIDE,
    );
    checkRectUiData(uiData, 3, 3, 2);

    userOptions['ignoreRectShowState'].enabled = false;
    presenter.onRectsUserOptionsChange(userOptions);
    checkRectUiData(uiData, 2, 3, 2);
  });

  it('handles both visibility and show/hide state in rects', async () => {
    initializeRectsPresenter();
    const userOptions: UserOptions = {
      ignoreRectShowState: {name: '', enabled: true},
      showOnlyVisible: {name: '', enabled: false},
    };
    presenter.onRectsUserOptionsChange(userOptions);
    await presenter.onAppEvent(positionUpdate);
    checkRectUiData(uiData, 3, 3, 3);

    await presenter.onRectShowStateChange(
      assertDefined(uiData.rectsToDraw)[0].id,
      RectShowState.HIDE,
    );
    checkRectUiData(uiData, 3, 3, 2);

    userOptions['ignoreRectShowState'].enabled = false;
    presenter.onRectsUserOptionsChange(userOptions);
    checkRectUiData(uiData, 2, 3, 2);

    userOptions['showOnlyVisible'].enabled = true;
    presenter.onRectsUserOptionsChange(userOptions);
    checkRectUiData(uiData, 1, 3, 1);

    userOptions['ignoreRectShowState'].enabled = true;
    presenter.onRectsUserOptionsChange(userOptions);
    checkRectUiData(uiData, 2, 3, 1);
  });

  function pinNode(node: UiHierarchyTreeNode) {
    presenter.onPinnedItemChange(node);
    expect(uiData.pinnedItems).toEqual([node]);
  }

  function initializeRectsPresenter(p = presenter) {
    p.initializeRectsPresenter();
    p.uiRects = [
      new UiRectBuilder()
        .setX(0)
        .setY(0)
        .setWidth(1)
        .setHeight(1)
        .setLabel('test rect')
        .setTransform(TransformMatrix.IDENTITY)
        .setIsVisible(true)
        .setIsDisplay(false)
        .setIsActiveDisplay(true)
        .setId('1 p1')
        .setGroupId(0)
        .setIsClickable(true)
        .setDepth(0)
        .build(),
      new UiRectBuilder()
        .setX(0)
        .setY(0)
        .setWidth(1)
        .setHeight(1)
        .setLabel('test rect 2')
        .setTransform(TransformMatrix.IDENTITY)
        .setIsVisible(true)
        .setIsDisplay(false)
        .setIsActiveDisplay(true)
        .setId('3 c3')
        .setGroupId(0)
        .setIsClickable(true)
        .setDepth(1)
        .build(),
      new UiRectBuilder()
        .setX(0)
        .setY(0)
        .setWidth(1)
        .setHeight(1)
        .setLabel('test rect 3')
        .setTransform(TransformMatrix.IDENTITY)
        .setIsVisible(false)
        .setIsDisplay(false)
        .setIsActiveDisplay(true)
        .setId('2 p2')
        .setGroupId(0)
        .setIsClickable(true)
        .setDepth(2)
        .build(),
    ];
    p.displays = [{displayId: 0, groupId: 0, name: 'Display', isActive: true}];
  }

  function checkRectUiData(
    uiData: UiDataHierarchy,
    rectsToDraw: number,
    allRects: number,
    shownRects: number,
  ) {
    expect(assertDefined(uiData.rectsToDraw).length).toEqual(rectsToDraw);
    const showStates = Array.from(
      assertDefined(uiData.rectIdToShowState).values(),
    );
    expect(showStates.length).toEqual(allRects);
    expect(showStates.filter((s) => s === RectShowState.SHOW).length).toEqual(
      shownRects,
    );
  }
});

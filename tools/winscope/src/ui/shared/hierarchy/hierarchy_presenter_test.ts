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

import {assertDefined} from '@common/assert';
import {makeElapsedTimestamp} from '@common/time/testing/test_helpers';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {Operation} from '@tree_node/operation';
import {PropertySource} from '@tree_node/property_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {treeNodeEqualityTester} from '@ui/shared/hierarchy/testing/ui_hierarchy_tree_node_test_helpers';
import {DiffType} from '@ui/shared/tree/diff_type';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';

import {HierarchyPresenter} from './hierarchy_presenter';
import {SimplifyNames} from './simplify_names';
import {UiHierarchyTreeNode} from './ui_hierarchy_tree_node';

describe('HierarchyPresenter', () => {
  const timestamp1 = makeElapsedTimestamp(1n);
  const timestamp2 = makeElapsedTimestamp(2n);
  const tree1 = new HierarchyTreeBuilder()
    .setRootNodeFormatter(new SetFormatters())
    .setId('Test Trace')
    .setName('entry')
    .addChildProperty({name: 'setProp', value: true})
    .addChildProperty({
      name: 'defProp',
      value: false,
      source: PropertySource.DEFAULT,
    })
    .setChildren([
      {
        id: '1',
        name: 'Parent1',
        properties: {isComputedVisible: true, testProp: true},
        children: [
          {id: '3', name: 'Child3', properties: {isComputedVisible: true}},
        ],
      },
      {
        id: '2',
        name: 'Parent2',
        properties: {isComputedVisible: false, nested: {innerProp: 1}},
      },
    ])
    .build();
  const tree2 = new HierarchyTreeBuilder()
    .setRootNodeFormatter(new SetFormatters())
    .setId('Test Trace')
    .setName('entry')
    .setChildren([
      {
        id: '1',
        name: 'Parent1',
        properties: {
          isComputedVisible: true,
          testProp: false,
          newProp: true,
        },
      },
      {
        id: '2',
        name: 'Parent2',
        properties: {isComputedVisible: false, nested: {innerProp: 2}},
      },
    ])
    .build();
  const trace = new TraceBuilder<HierarchyTreeNode>()
    .setType(TraceType.SURFACE_FLINGER)
    .setEntries([tree1, tree2])
    .setTimestamps([timestamp1, timestamp2])
    .build();

  const tree3 = new HierarchyTreeBuilder()
    .setRootNodeFormatter(new SetFormatters())
    .setId('Test Trace 2')
    .setName('entry')
    .setChildren([
      {
        id: '2',
        name: 'Parent2',
        properties: {isComputedVisible: false},
        children: [
          {
            id: '3',
            name: 'Child3',
            properties: {isComputedVisible: true},
            children: [
              {id: '4', name: 'Child4', properties: {isComputedVisible: false}},
            ],
          },
        ],
      },
    ])
    .build();
  const secondTrace = new TraceBuilder<HierarchyTreeNode>()
    .setType(TraceType.SURFACE_FLINGER)
    .setEntries([tree3])
    .setTimestamps([timestamp1])
    .build();

  let presenter: HierarchyPresenter;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(treeNodeEqualityTester);
  });

  beforeEach(() => {
    presenter = new HierarchyPresenter({}, new TextFilter(), [], false, false);
  });

  it('exposes user options', async () => {
    expect(presenter.getUserOptions()).toEqual({});
    const testOptions = {test: {name: '', enabled: false}};
    await presenter.applyHierarchyUserOptionsChange(testOptions);
    expect(presenter.getUserOptions()).toEqual(testOptions);
  });

  it('updates current and previous entries for trace', async () => {
    expect(presenter.getAllCurrentHierarchyTrees()?.length).toBe(0);
    expect(presenter.getAllFormattedTrees()?.length).toBe(0);

    await presenter.applyTracePositionUpdate(
      [trace.getEntry(1), secondTrace.getEntry(0)],
      '',
    );
    expect(presenter.getCurrentEntryForTrace(trace)).toEqual(trace.getEntry(1));
    expect(presenter.getCurrentEntryForTrace(secondTrace)).toEqual(
      secondTrace.getEntry(0),
    );
    expect(presenter.getCurrentHierarchyTreesForTrace(trace)?.length).toBe(1);
    expect(presenter.getAllCurrentHierarchyTrees()?.length).toBe(2);
    expect(presenter.getAllFormattedTrees()?.length).toBe(2);
    expect(presenter.getFormattedTreesByTrace(trace)?.length).toBe(1);
    expect(presenter.getPreviousHierarchyTreeForTrace(trace)).toBeUndefined();
    expect(
      presenter.getPreviousHierarchyTreeForTrace(secondTrace),
    ).toBeUndefined();

    await presenter.applyHierarchyUserOptionsChange({
      showDiff: {name: '', enabled: true, isUnavailable: false},
    });
    expect(presenter.getPreviousHierarchyTreeForTrace(trace)).toBeDefined();
    expect(
      presenter.getPreviousHierarchyTreeForTrace(secondTrace),
    ).toBeUndefined();
  });

  it('explicitly sets selected tree', async () => {
    expect(presenter.getSelectedTree()).toBeUndefined();
    const selectedTree = {trace, tree: tree1, index: 0};
    presenter.setSelectedTree(selectedTree);
    expect(presenter.getSelectedTree()).toEqual(selectedTree);
    presenter.setSelectedTree(undefined);
    expect(presenter.getSelectedTree()).toBeUndefined();
  });

  it('adds current hierarchy trees', async () => {
    await presenter.addCurrentHierarchyTrees(
      {trace, trees: [tree1]},
      undefined,
    );
    expect(presenter.getCurrentEntryForTrace(trace)).toBeUndefined();
    expect(presenter.getCurrentHierarchyTreesForTrace(trace)?.length).toBe(1);
    expect(presenter.getAllCurrentHierarchyTrees()?.length).toBe(1);
    expect(presenter.getAllFormattedTrees()?.length).toBe(1);
    expect(presenter.getFormattedTreesByTrace(trace)?.length).toBe(1);

    const entry = secondTrace.getEntry(0);
    await presenter.addCurrentHierarchyTrees(
      {trace: secondTrace, trees: [tree3], entry},
      tree3.id,
    );
    expect(presenter.getSelectedTree()).toEqual({
      trace: secondTrace,
      tree: tree3,
      index: 1,
    });

    await presenter.addCurrentHierarchyTrees(
      {trace, trees: [tree2]},
      undefined,
    );
    expect(presenter.getCurrentHierarchyTreesForTrace(trace)?.length).toBe(2);
    const formattedTrees = assertDefined(presenter.getAllFormattedTrees());
    expect(presenter.getAllCurrentHierarchyTrees()).toEqual([
      {
        trace,
        trees: [tree1, tree2],
        formattedTrees: formattedTrees.slice(0, 2),
        entry: undefined,
      },
      {
        trace: secondTrace,
        trees: [tree3],
        formattedTrees: formattedTrees.slice(2),
        entry,
      },
    ]);
    expect(formattedTrees.length).toBe(3);
    expect(presenter.getFormattedTreesByTrace(trace)?.length).toBe(2);
  });

  it('updates previous hierarchy trees', async () => {
    await applyTracePositionUpdate(0);
    await presenter.updatePreviousHierarchyTrees();
    expect(presenter.getPreviousHierarchyTreeForTrace(trace)).toBeUndefined();

    await applyTracePositionUpdate(1);
    expect(presenter.getPreviousHierarchyTreeForTrace(trace)).toBeUndefined();
    await presenter.updatePreviousHierarchyTrees();
    expect(presenter.getPreviousHierarchyTreeForTrace(trace)).toBeDefined();
  });

  it('robust to empty trace position update', async () => {
    await applyTracePositionUpdate();
    presenter.applyPinnedItemChange(
      assertDefined(presenter.getAllFormattedTrees()?.at(0)),
    );

    expect(presenter.getCurrentEntryForTrace(trace)).toEqual(trace.getEntry(0));
    expect(presenter.getCurrentHierarchyTreesForTrace(trace)).toEqual([tree1]);
    expect(presenter.getPinnedItems().length).toBeGreaterThan(0);

    await presenter.applyTracePositionUpdate([], '');
    expect(presenter.getCurrentEntryForTrace(trace)).toBeUndefined();
    expect(presenter.getCurrentHierarchyTreesForTrace(trace)).toBeUndefined();
    expect(presenter.getPinnedItems()).toEqual([]);
  });

  it('adds diffs to hierarchy tree based on user option', async () => {
    await applyTracePositionUpdate(1);
    expect(
      getFormattedTree().findDfs((node) => node.name === 'Child3'),
    ).toBeUndefined();
    await presenter.applyHierarchyUserOptionsChange({
      showDiff: {name: '', enabled: true, isUnavailable: false},
    });
    expect(
      getFormattedTree()
        .findDfs((node) => node.name === 'Child3')
        ?.getDiff(),
    ).toEqual(DiffType.DELETED);
  });

  it('adds diffs based on modified properties', async () => {
    presenter = new HierarchyPresenter(
      {showDiff: {name: '', enabled: true, isUnavailable: false}},
      new TextFilter(),
      [],
      false,
      false,
    );
    await applyTracePositionUpdate(1);
    const tree = getFormattedTree();
    expect(tree.findDfs((node) => node.name === 'Parent1')?.getDiff()).toEqual(
      DiffType.MODIFIED,
    );
    expect(tree.findDfs((node) => node.name === 'Parent2')?.getDiff()).toEqual(
      DiffType.MODIFIED,
    );
  });

  it('applies deny list in add diffs operation', async () => {
    presenter = new HierarchyPresenter(
      {showDiff: {name: '', enabled: true, isUnavailable: false}},
      new TextFilter(),
      ['newProp', 'testProp'],
      false,
      false,
    );
    await applyTracePositionUpdate(1);
    expect(
      getFormattedTree()
        .findDfs((node) => node.name === 'Parent1')
        ?.getDiff(),
    ).toEqual(DiffType.NONE);
  });

  it('disables show diff and generates non-diff tree if no prev entry available', async () => {
    const opts = {showDiff: {name: '', enabled: false, isUnavailable: false}};
    presenter.applyHierarchyUserOptionsChange(opts);
    await applyTracePositionUpdate();
    expect(opts['showDiff'].isUnavailable).toBeTrue();
    const trees = assertDefined(presenter.getAllFormattedTrees());
    expect(trees.length).toBeGreaterThan(0);
    trees.forEach((tree) => {
      expect(tree.getAllChildren().length > 0).toBeTrue();
      tree.forEachNodeDfs((node) =>
        expect(node.getDiff()).toEqual(DiffType.NONE),
      );
    });
  });

  it('makes node display name by strategy', async () => {
    const testName = 'Test Name';
    presenter = new HierarchyPresenter(
      {},
      new TextFilter(),
      [],
      false,
      false,
      () => testName,
    );
    expect(presenter.getCurrentHierarchyTreeNames(trace)).toBeUndefined();
    await applyTracePositionUpdate();
    const node = assertDefined(presenter.getAllFormattedTrees()?.at(0));
    expect(node.name).toBe('entry');
    expect(node.getDisplayName()).toBe(testName);
    expect(presenter.getCurrentHierarchyTreeNames(trace)).toEqual([testName]);
  });

  it('disables headings based on showHeading', async () => {
    await applyTracePositionUpdate();
    let node = assertDefined(presenter.getAllFormattedTrees()?.at(0));
    expect(node.name).toBe('entry');
    expect(node.heading()).toBeUndefined();

    presenter = new HierarchyPresenter({}, new TextFilter(), [], true, false);
    await applyTracePositionUpdate();
    node = assertDefined(presenter.getAllFormattedTrees()?.at(0));
    expect(node.name).toBe('entry');
    expect(node.heading()).toBe('Test');
  });

  it('selects first node based on forceSelectFirstNode', async () => {
    await applyTracePositionUpdate();
    expect(presenter.getSelectedTree()).toBeUndefined();

    presenter = new HierarchyPresenter({}, new TextFilter(), [], false, true);
    await applyTracePositionUpdate();
    expect(presenter.getSelectedTree()).toBeDefined();
  });

  it('applies custom operations', async () => {
    const operation = jasmine.createSpyObj('operation', ['apply']);
    presenter = new HierarchyPresenter(
      {},
      new TextFilter(),
      [],
      false,
      false,
      undefined,
      [[TraceType.SURFACE_FLINGER, [operation]]],
    );
    await applyTracePositionUpdate();
    expect(operation.apply).toHaveBeenCalledTimes(1);
  });

  it('propagates item selection to new entry', async () => {
    await applyTracePositionUpdate(0, '1 Parent1');
    expect(presenter.getSelectedTree()).toEqual({
      trace,
      tree: assertDefined(tree1.getChildByName('Parent1')),
      index: 0,
    });
  });

  it('handles pinned item change', () => {
    expect(presenter.getPinnedItems()).toEqual([]);
    const item = UiHierarchyTreeNode.from(
      new HierarchyTreeBuilder()
        .setRootNodeFormatter(new SetFormatters())
        .setId('')
        .setName('')
        .build(),
    );
    presenter.applyPinnedItemChange(item);
    expect(presenter.getPinnedItems()).toEqual([item]);
    presenter.applyPinnedItemChange(item);
    expect(presenter.getPinnedItems()).toEqual([]);
  });

  it('flattens hierarchy tree based on user option', async () => {
    await applyTracePositionUpdate();
    expect(getTotalHierarchyChildren()).toBe(2);
    await presenter.applyHierarchyUserOptionsChange({
      flat: {name: '', enabled: true},
    });
    expect(getTotalHierarchyChildren()).toBe(3);
  });

  it('filters hierarchy tree by visibility based on user option', async () => {
    const userOptions: UserOptions = {
      showOnlyVisible: {name: '', enabled: false},
      flat: {name: '', enabled: true},
    };
    await presenter.applyHierarchyUserOptionsChange(userOptions);
    await applyTracePositionUpdate();
    expect(getTotalHierarchyChildren()).toBe(3);

    const nonVisibleNode = assertDefined(
      getFormattedTree()?.findDfs(
        (node) =>
          !node.isRoot() &&
          !node.getEagerPropertyByName('isComputedVisible')?.getValue(),
      ),
    );
    presenter.applyPinnedItemChange(nonVisibleNode);

    userOptions['showOnlyVisible'].enabled = true;
    await presenter.applyHierarchyUserOptionsChange(userOptions);
    expect(getTotalHierarchyChildren()).toBe(2);
    expect(presenter.getPinnedItems()).toEqual([nonVisibleNode]); // keeps pinned node

    presenter.clear(); // robust to no current entries
    await presenter.applyHierarchyUserOptionsChange(userOptions);
  });

  it('filters hierarchy tree by search string', async () => {
    const userOptions: UserOptions = {flat: {name: '', enabled: true}};
    await presenter.applyHierarchyUserOptionsChange(userOptions);
    await applyTracePositionUpdate();
    expect(getTotalHierarchyChildren()).toBe(3);

    const filterString = 'Parent';
    const nonMatchNode = assertDefined(
      getFormattedTree()?.findDfs(
        (node) => !node.isRoot() && !node.id.includes(filterString),
      ),
    );
    presenter.applyPinnedItemChange(nonMatchNode);

    const filter = new TextFilter(filterString);
    await presenter.applyHierarchyFilterChange(filter);
    expect(presenter.getTextFilter()).toEqual(filter);
    expect(getTotalHierarchyChildren()).toBe(2);
    expect(presenter.getPinnedItems()).toEqual([nonMatchNode]); // keeps pinned node

    presenter.clear(); // robust to no current entries
    await presenter.applyHierarchyFilterChange(filter);
  });

  it('simplifies names in hierarchy tree based on user option', async () => {
    const spy = spyOn(SimplifyNames.prototype, 'apply').and.callThrough();
    await applyTracePositionUpdate();
    expect(spy).not.toHaveBeenCalled();

    await presenter.applyHierarchyUserOptionsChange({
      simplifyNames: {name: '', enabled: true},
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('applies custom simplify names operation', async () => {
    const defaultOperationSpy = spyOn(
      SimplifyNames.prototype,
      'apply',
    ).and.callThrough();
    const customOperationSpy = jasmine.createSpyObj<
      Operation<UiHierarchyTreeNode>
    >('operation', ['apply']);

    presenter = new HierarchyPresenter(
      {},
      new TextFilter(),
      [],
      false,
      false,
      undefined,
      undefined,
      customOperationSpy,
    );
    await applyTracePositionUpdate();
    expect(customOperationSpy.apply).not.toHaveBeenCalled();
    expect(defaultOperationSpy).not.toHaveBeenCalled();

    await presenter.applyHierarchyUserOptionsChange({
      simplifyNames: {name: '', enabled: true},
    });
    expect(customOperationSpy.apply).toHaveBeenCalledTimes(1);
    expect(defaultOperationSpy).not.toHaveBeenCalled();
  });

  it('applies highlighted id change', async () => {
    await applyTracePositionUpdate();
    presenter.applyHighlightedIdChange('fake node');
    expect(presenter.getSelectedTree()).toBeUndefined();
    presenter.applyHighlightedIdChange('1 Parent1');
    expect(presenter.getSelectedTree()).toBeDefined();
    presenter.clear(); // robust to no current entries
    presenter.applyHighlightedIdChange('1 Parent1');
  });

  it('applies highlighted node change', async () => {
    await applyTracePositionUpdate();
    const tree = getFormattedTree();
    tree.setIsOldNode(true);
    presenter.applyHighlightedNodeChange(tree);
    expect(presenter.getSelectedTree()).toBeUndefined();

    tree.setDiff(DiffType.DELETED);
    presenter.applyHighlightedNodeChange(tree);
    expect(presenter.getSelectedTree()).toEqual({trace, tree, index: 0});

    const newNode = assertDefined(tree.getChildByName('Parent1'));
    presenter.applyHighlightedNodeChange(newNode);
    expect(presenter.getSelectedTree()).toEqual({
      trace,
      tree: newNode,
      index: 0,
    });

    presenter.clear(); // robust to no current entries
    presenter.applyHighlightedNodeChange(tree);
  });

  it('can be cleared and re-populated', async () => {
    const testName = 'Test Name';
    presenter = new HierarchyPresenter(
      {showDiff: {name: 'Show diff', enabled: true}},
      new TextFilter(),
      [],
      false,
      false,
      () => testName,
    );
    await applyTracePositionUpdate(1, '1 Parent1');
    expect(presenter.getAllCurrentHierarchyTrees()).toBeDefined();
    expect(presenter.getAllFormattedTrees()).toBeDefined();
    expect(presenter.getSelectedTree()).toBeDefined();
    expect(presenter.getPreviousHierarchyTreeForTrace(trace)).toBeDefined();
    expect(presenter.getCurrentEntryForTrace(trace)).toBeDefined();
    expect(presenter.getCurrentHierarchyTreeNames(trace)).toBeDefined();

    presenter.clear();
    expect(presenter.getAllCurrentHierarchyTrees()).toBeUndefined();
    expect(presenter.getAllFormattedTrees()).toBeUndefined();
    expect(presenter.getPreviousHierarchyTreeForTrace(trace)).toBeUndefined();
    expect(presenter.getCurrentEntryForTrace(trace)).toBeUndefined();
    expect(presenter.getSelectedTree()).toBeUndefined();
    expect(presenter.getCurrentHierarchyTreeNames(trace)).toBeUndefined();

    await presenter.addCurrentHierarchyTrees(
      {trace, trees: [tree1]},
      '1 Parent1',
    );
    expect(presenter.getAllCurrentHierarchyTrees()).toBeDefined();
    expect(presenter.getAllFormattedTrees()).toBeDefined();
    expect(presenter.getSelectedTree()).toBeDefined();
    expect(presenter.getPreviousHierarchyTreeForTrace(trace)).toBeUndefined();
    expect(presenter.getCurrentEntryForTrace(trace)).toBeUndefined();
    expect(presenter.getCurrentHierarchyTreeNames(trace)).toBeUndefined();
  });

  async function applyTracePositionUpdate(index = 0, item = '', t = trace) {
    await presenter.applyTracePositionUpdate([t.getEntry(index)], item);
  }

  function getFormattedTree(t = trace) {
    return assertDefined(presenter.getFormattedTreesByTrace(t))[0];
  }

  function getTotalHierarchyChildren() {
    return assertDefined(presenter.getAllFormattedTrees()).reduce(
      (tot, tree) => (tot += tree.getAllChildren().length),
      0,
    );
  }
});

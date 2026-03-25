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
import {Transform} from '@common/geometry/transform';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';
import {TraceRectBuilder} from '@tree_node/trace_rect_builder';
import {UiRect} from '@ui/shared/rects/ui_rect';
import {UiRectBuilder} from '@ui/shared/rects/ui_rect_builder';

import {makeInputRects, makeUiRects, makeVcUiRects} from './ui_rect_factory';

describe('ui_rect_factory', () => {
  let hierarchyRoot: HierarchyTreeNode;
  let node1: HierarchyTreeNode;
  let node2: HierarchyTreeNode;

  beforeEach(() => {
    hierarchyRoot = new HierarchyTreeBuilder()
      .setId('TreeEntry')
      .setName('root')
      .setChildren([
        {id: 1, name: 'node1'},
        {id: 2, name: 'node2'},
      ])
      .build();
    node1 = assertDefined(hierarchyRoot.getChildByName('node1'));
    node2 = assertDefined(hierarchyRoot.getChildByName('node2'));
  });

  it('extracts rects from hierarchy tree', () => {
    buildRectAndSetToNode(node1, 0);
    buildRectAndSetToNode(node2, 1);

    const expectedUiRect1 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('1 node1')
      .setLabel('node1')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(false)
      .setDepth(0)
      .setOpacity(0.5)
      .build();

    const expectedUiRect2 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('2 node2')
      .setLabel('node2')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(false)
      .setDepth(1)
      .setOpacity(0.5)
      .build();

    const expectedRects: UiRect[] = [expectedUiRect1, expectedUiRect2];

    expect(makeUiRects(hierarchyRoot)).toEqual(expectedRects);
  });

  it('makes rect with content', () => {
    const root = new HierarchyTreeBuilder()
      .setId('TreeEntry')
      .setName('root')
      .setChildren([
        {id: 1, name: 'VRI-package1/node1'},
        {id: 2, name: 'package1/node2'},
      ])
      .build();
    const [nodeVRI, node] = root.getAllChildren();
    buildRectAndSetToNode(nodeVRI, 0);
    buildRectAndSetToNode(node, 0);

    const expectedUiRect1 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('1 VRI-package1/node1')
      .setLabel('VRI-package1/node1')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(true)
      .setDepth(0)
      .setOpacity(0.5)
      .build();

    const expectedUiRect2 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('2 package1/node2')
      .setLabel('package1/node2')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(true)
      .setDepth(0)
      .setOpacity(0.5)
      .build();

    expect(makeUiRects(root, ['package1'])).toEqual([
      expectedUiRect1,
      expectedUiRect2,
    ]);
  });

  it('makes rects with data from trace rect', () => {
    buildRectAndSetToNode(node2, 1, 5, 10, true, true, false, true);

    const expectedUiRect2 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(5)
      .setHeight(10)
      .setId('2 node2')
      .setLabel('node2')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(true)
      .setIsActiveDisplay(true)
      .setIsClickable(false)
      .setHasContent(false)
      .setDepth(1)
      .setOpacity(0.5)
      .build();

    const expectedRects: UiRect[] = [expectedUiRect2];

    expect(makeUiRects(hierarchyRoot)).toEqual(expectedRects);
  });

  it('handles depth order different to dfs order', () => {
    buildRectAndSetToNode(node1, 1);
    buildRectAndSetToNode(node2, 0);

    const expectedUiRect1 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('1 node1')
      .setLabel('node1')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(false)
      .setDepth(1)
      .setOpacity(0.5)
      .build();

    const expectedUiRect2 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('2 node2')
      .setLabel('node2')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(false)
      .setDepth(0)
      .setOpacity(0.5)
      .build();

    const expectedRects: UiRect[] = [expectedUiRect1, expectedUiRect2];
    expect(makeUiRects(hierarchyRoot)).toEqual(expectedRects);
  });

  it('makes vc rects with groupId, content and empty label', () => {
    const groupId = 11;

    buildRectAndSetToNode(node1, 1);
    buildRectAndSetToNode(node2, 0);

    const expectedVcUiRect1 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('1 node1')
      .setLabel('')
      .setGroupId(groupId)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(true)
      .setDepth(1)
      .setOpacity(0.5)
      .build();

    const expectedVcUiRect2 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('2 node2')
      .setLabel('')
      .setGroupId(groupId)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(true)
      .setDepth(0)
      .setOpacity(0.5)
      .build();

    const expectedRects: UiRect[] = [expectedVcUiRect1, expectedVcUiRect2];
    expect(makeVcUiRects(hierarchyRoot, groupId)).toEqual(expectedRects);
  });

  it('makes input rects', () => {
    // The root of the hierarchy should contain the display info in the primary rects.
    buildRectAndSetToNode(hierarchyRoot, 0, 1, 1, true, true);
    // The rest of the nodes should contain input windows in the secondary rects.
    // The opacity is determined by whether the window is a spy and display.
    buildRectAndSetToNode(node1, 1, 1, 1, false, false, true);
    buildRectAndSetToNode(node2, 2, 1, 1, false, false, false);

    const expectedRootRect = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('TreeEntry root')
      .setLabel('root')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(true)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(false)
      .setDepth(0)
      .setOpacity(1)
      .build();

    const expectedInputRect1 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('1 node1')
      .setLabel('node1')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(true)
      .setDepth(1)
      .setOpacity(0.25)
      .build();

    const expectedInputRect2 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('2 node2')
      .setLabel('node2')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(false)
      .setDepth(2)
      .setOpacity(0.9)
      .build();

    const expectedRects: UiRect[] = [
      expectedRootRect,
      expectedInputRect1,
      expectedInputRect2,
    ];
    expect(makeInputRects(hierarchyRoot, hasContent)).toEqual(expectedRects);
  });

  it('adds pointer and ray locations for input rects', () => {
    const root = new HierarchyTreeBuilder()
      .setId('TreeEntry')
      .setName('root')
      .setChildren([
        {id: 11, name: 'node11'},
        {id: 3, name: 'node3'},
      ])
      .build();
    const node11 = assertDefined(root.getChildByName('node11'));
    const node3 = assertDefined(root.getChildByName('node3'));
    buildRectAndSetToNode(node11, 1, 1, 1, false, false, false);
    buildRectAndSetToNode(node3, 1, 1, 1, false, false, false);

    const dispatchedPointer1 = {
      name: 'dispatchedPointer',
      children: [
        {
          name: 'pointer0',
          children: [
            {name: 'xInDisplay', value: 100},
            {name: 'yInDisplay', value: 100},
          ],
        },
      ],
    };

    const dispatchedPointer2 = {
      name: 'dispatchedPointer',
      children: [
        {
          name: 'pointer0',
          children: [
            {name: 'xInDisplay', value: 5.25},
            {name: 'yInDisplay', value: 10.5},
            {
              name: 'axisValueInWindow',
              children: [{name: 'axis2', children: [{name: 'axis', value: 1}]}],
            },
          ],
        },
        {name: 'pointer1', children: [{name: 'xInDisplay', value: 5.25}]},
        {name: 'pointer2', children: [{name: 'yInDisplay', value: 10.5}]},
        {
          name: 'pointer3',
          children: [
            {name: 'xInDisplay', value: 20},
            {name: 'yInDisplay', value: 40},
            {
              name: 'axisValueInWindow',
              children: [{name: 'axis1', children: [{name: 'axis', value: 0}]}],
            },
          ],
        },
      ],
    };

    const dispatchedPointer3 = {
      name: 'dispatchedPointer',
      children: [
        {
          name: 'pointer0',
          children: [
            {name: 'xInDisplay', value: 15},
            {name: 'yInDisplay', value: 15},
            {
              name: 'axisValueInWindow',
              children: [
                {
                  name: 'axis1',
                  children: [
                    {name: 'axis', value: 0},
                    {name: 'value', value: 123},
                  ],
                },
                {
                  name: 'axis2',
                  children: [
                    {name: 'axis', value: 1},
                    {name: 'value', value: 321.321},
                  ],
                },
              ],
            },
          ],
        },
        {
          name: 'pointer1',
          children: [
            {
              name: 'axisValueInWindow',
              children: [
                {
                  name: 'axis2',
                  children: [
                    {name: 'axis', value: 1},
                    {name: 'value', value: 123.123},
                  ],
                },
                {
                  name: 'axis1',
                  children: [
                    {name: 'axis', value: 0},
                    {name: 'value', value: 321},
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const dispatchProperties = new PropertyTreeBuilder()
      .setRootId('')
      .setName('')
      .setChildren([
        {
          name: 'window1',
          children: [
            {name: 'windowId', value: 1}, // ignored as node1 name does not end in 1
            dispatchedPointer1,
          ],
        },
        {
          name: 'window11',
          children: [{name: 'windowId', value: 11}, dispatchedPointer2],
        },
        {
          name: 'window2',
          children: [
            {name: 'windowId', value: 2}, // ignored as hierarchyRoot does not contain node2
            dispatchedPointer1,
          ],
        },
        {
          name: 'window3',
          children: [{name: 'windowId', value: 3}, dispatchedPointer3],
        },
      ])
      .build();

    const expectedInputRect1 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('11 node11')
      .setLabel('node11')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(false)
      .setDepth(1)
      .setOpacity(0.9)
      .setPointerLocationsInRect([])
      .setRayLocationsInDisplay([
        {x: 5.25, y: 10.5},
        {x: 20, y: 40},
      ])
      .build();

    const expectedInputRect2 = new UiRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(1)
      .setHeight(1)
      .setId('3 node3')
      .setLabel('node3')
      .setGroupId(0)
      .setTransform(Transform.EMPTY.matrix)
      .setIsVisible(true)
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setIsClickable(true)
      .setHasContent(false)
      .setDepth(1)
      .setOpacity(0.9)
      .setPointerLocationsInRect([
        {x: 123, y: 321.321},
        {x: 321, y: 123.123},
      ])
      .setRayLocationsInDisplay([{x: 15, y: 15}])
      .build();

    const expectedRects: UiRect[] = [expectedInputRect1, expectedInputRect2];
    expect(makeInputRects(root, hasContent, dispatchProperties)).toEqual(
      expectedRects,
    );
  });

  it('discards trace rects with zero height or width', () => {
    buildRectAndSetToNode(node1, 1, 0, 1);
    buildRectAndSetToNode(node2, 0, 1, 0);
    buildRectAndSetToNode(node1, 1, 0, 1, false);
    buildRectAndSetToNode(node2, 0, 1, 0, false);

    expect(makeUiRects(hierarchyRoot)).toEqual([]);
    expect(makeVcUiRects(hierarchyRoot, 0)).toEqual([]);
    expect(makeInputRects(hierarchyRoot, hasContent)).toEqual([]);
  });

  function hasContent(id: string) {
    return id === node1.id;
  }

  function buildRectAndSetToNode(
    node: HierarchyTreeNode,
    depth: number,
    width = 1,
    height = 1,
    isPrimary = true,
    isDisplay = false,
    isSpy = false,
    isActiveDisplay = false,
  ) {
    const rect = new TraceRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(width)
      .setHeight(height)
      .setId(node.id)
      .setName(node.name)
      .setTransform(Transform.EMPTY.matrix)
      .setDepth(depth)
      .setGroupId(0)
      .setIsVisible(true)
      .setIsDisplay(isDisplay)
      .setIsActiveDisplay(isActiveDisplay)
      .setOpacity(0.5)
      .setIsSpy(isSpy)
      .build();

    if (isPrimary) {
      node.setRects([rect]);
    } else {
      node.setSecondaryRects([rect]);
    }
  }
});

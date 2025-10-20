/*
 * Copyright (C) 2025 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {DuplicateLayerIds} from 'messaging/user_warnings';
import {makeHierarchyNode} from 'test/unit/tree_node_test_helpers';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {TraceRectBuilder} from 'tree_node/trace_rect_builder';
import {UiHierarchyTreeNode} from './ui_hierarchy_tree_node';

describe('UiHierarchyTreeNode', () => {
  let node: HierarchyTreeNode;

  beforeEach(() => {
    node = makeHierarchyNode({id: '1', name: 'node1', prop: true}, [
      {id: '2', name: 'node2'},
    ]);
  });

  it('transfers id, name and properties', () => {
    const uiNode = UiHierarchyTreeNode.from(node);
    expect(uiNode.id).toEqual(node.id);
    expect(uiNode.name).toEqual(node.name);
    expect(uiNode.getEagerPropertyByName('prop')?.getValue()).toEqual(true);
  });

  it('transfers rects', () => {
    const nodeNoRects = UiHierarchyTreeNode.from(node);
    expect(nodeNoRects.getRects()).toBeUndefined();
    const rects = [
      new TraceRectBuilder()
        .setX(0)
        .setY(0)
        .setWidth(5)
        .setHeight(10)
        .setId('1')
        .setName('rect1')
        .setDepth(1)
        .setGroupId(0)
        .setIsVisible(false)
        .setIsDisplay(true)
        .setIsSpy(false)
        .build(),
    ];
    node.setRects(rects);
    const nodeWithRects = UiHierarchyTreeNode.from(node);
    expect(nodeWithRects.getRects()).toEqual(rects);
  });

  it('transfers parent-child relationships', () => {
    const uiNode = UiHierarchyTreeNode.from(node);
    expect(uiNode.getParent()).toBeUndefined();
    const childUiNode = uiNode.getChildByName('node2');
    expect(childUiNode).toBeInstanceOf(UiHierarchyTreeNode);
    expect(childUiNode?.getParent()).toEqual(uiNode);
  });

  it('transfers warnings', () => {
    expect(UiHierarchyTreeNode.from(node).getWarnings()).toEqual([]);
    const warning = new DuplicateLayerIds([]);
    node.addWarning(warning);
    expect(UiHierarchyTreeNode.from(node).getWarnings()).toEqual([warning]);
  });

  it('formats id as heading', () => {
    const uiNode = UiHierarchyTreeNode.from(node);
    expect(uiNode.heading()).toBe('1');
    uiNode.setShowHeading(false);
    expect(uiNode.heading()).toBeUndefined();
  });
});

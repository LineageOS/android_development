/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {TreeNode} from './tree_node';

class TestTreeNode extends TreeNode {
  constructor(
    id: string,
    name: string,
    private readonly root = false,
  ) {
    super(id, name);
  }

  override isRoot(): boolean {
    return this.root;
  }
}

describe('TreeNode', () => {
  let root: TestTreeNode;
  let child1: TestTreeNode;
  let child2: TestTreeNode;
  let grandchild1: TestTreeNode;

  beforeEach(() => {
    root = new TestTreeNode('root', 'root', true);
    child1 = new TestTreeNode('child1', 'child1');
    child2 = new TestTreeNode('child2', 'child2');
    grandchild1 = new TestTreeNode('grandchild1', 'grandchild1');

    root.addOrReplaceChild(child1);
    root.addOrReplaceChild(child2);
    child1.addOrReplaceChild(grandchild1);
  });

  it('initializes correctly', () => {
    const node = new TestTreeNode('id', 'name');
    expect(node.id).toBe('id');
    expect(node.name).toBe('name');
    expect(node.getAllChildren().length).toBe(0);
  });

  it('adds a new child', () => {
    const newChild = new TestTreeNode('newChild', 'newChild');
    root.addOrReplaceChild(newChild);
    expect(root.getAllChildren()).toContain(newChild);
    expect(root.getAllChildren().length).toBe(3);
  });

  it('replaces an existing child', () => {
    const newChild1 = new TestTreeNode('child1', 'newChild1Name');
    root.addOrReplaceChild(newChild1);
    expect(root.getAllChildren()).toContain(newChild1);
    expect(root.getAllChildren()).not.toContain(child1);
    expect(root.getAllChildren().length).toBe(2);
    expect(root.getChildByName('child1')).toBeUndefined();
    expect(root.getChildByName('newChild1Name')).toBe(newChild1);
  });

  it('removes a child', () => {
    root.removeChild('child1');
    expect(root.getAllChildren()).not.toContain(child1);
    expect(root.getAllChildren().length).toBe(1);
  });

  it('removes all children', () => {
    root.removeAllChildren();
    expect(root.getAllChildren().length).toBe(0);
  });

  it('gets child by name', () => {
    expect(root.getChildByName('child1')).toBe(child1);
    expect(root.getChildByName('nonexistent')).toBeUndefined();
  });

  it('gets all children', () => {
    expect(root.getAllChildren()).toEqual([child1, child2]);
  });

  it('performs DFS traversal', () => {
    const visited: string[] = [];
    root.forEachNodeDfs((node) => {
      visited.push(node.id);
    });
    expect(visited).toEqual(['root', 'child1', 'grandchild1', 'child2']);
  });

  it('performs DFS traversal with reverse children', () => {
    const visited: string[] = [];
    root.forEachNodeDfs((node) => {
      visited.push(node.id);
    }, true);
    expect(visited).toEqual(['root', 'child2', 'child1', 'grandchild1']);
  });

  it('finds a node with DFS', () => {
    const found = root.findDfs((node) => node.id === 'grandchild1');
    expect(found).toBe(grandchild1);
  });

  it('returns undefined when node not found with DFS', () => {
    const found = root.findDfs((node) => node.id === 'nonexistent');
    expect(found).toBeUndefined();
  });

  it('filters nodes with DFS', () => {
    const filtered = root.filterDfs((node) => node.id.startsWith('child'));
    expect(filtered).toEqual([child1, child2]);
  });

  it('filters nodes with DFS and reverse children', () => {
    const filtered = root.filterDfs(
      (node) => node.id.startsWith('child'),
      true,
    );
    expect(filtered).toEqual([child2, child1]);
  });
});

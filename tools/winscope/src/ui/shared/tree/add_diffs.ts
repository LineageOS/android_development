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
import {getLogger, Logger} from '@compat/logging';
import {TreeNode} from '@tree_node/tree_node';
import {UiTreeNode} from '@ui/shared/tree/ui_tree_node';

import {DiffType} from './diff_type';

export abstract class AddDiffs<T extends UiTreeNode> {
  private newIdNodeMap = new Map<string, T>();
  private oldIdNodeMap = new Map<string, T>();
  protected abstract addDiffsToNewRoot: boolean;
  protected abstract processModifiedNodes(newNode: T, oldNode: T): void;
  protected abstract processOldNode(oldNode: T): void;

  constructor(
    private isModified: IsModifiedCallbackType,
    private denylistProperties: string[],
    private readonly logger: Logger = getLogger('AddDiffs'),
  ) {}

  async executeInPlace(newRoot: T, oldRoot?: T): Promise<void> {
    this.newIdNodeMap = this.updateIdNodeMap(newRoot);
    this.oldIdNodeMap = this.updateIdNodeMap(oldRoot);
    await this.generateDiffNodes(newRoot, oldRoot, [], []);
  }

  private updateIdNodeMap(root: T | undefined): Map<string, T> {
    const idNodeMap = new Map<string, T>();

    root?.forEachNodeDfs((node: T) => {
      idNodeMap.set(node.id, node);
    });

    return idNodeMap;
  }

  private async generateDiffNodes(
    newNode: T | undefined,
    oldNode: T | undefined,
    newNodeSiblingIds: string[],
    oldNodeSiblingIds: string[],
  ): Promise<T[]> {
    if (newNode === undefined && oldNode === undefined) {
      this.logger.error('both new and old trees undefined');
      return [];
    }

    if (newNode === undefined && oldNode !== undefined) {
      if (newNodeSiblingIds.includes(oldNode.id)) {
        // node still at same hierarchy level - no diffs
        return [];
      }
      await this.processDeletedOrMovedNode(oldNode);
      return [oldNode];
    }

    newNode = assertDefined(newNode);

    if (!newNode.isRoot()) {
      const diffNodes = await this.generateDiffNodesForNonRoot(
        newNode,
        oldNode,
        newNodeSiblingIds,
        oldNodeSiblingIds,
      );
      return diffNodes;
    }

    await this.processNewNodeChildren(newNode, oldNode);

    return [newNode];
  }

  private async processNewNodeChildren(newNode: T, oldNode: T | undefined) {
    const newChildren = await this.visitChildren(newNode, oldNode);
    newNode.removeAllChildren();
    newChildren.forEach((child) =>
      assertDefined(newNode).addOrReplaceChild(child),
    );
  }

  private async generateDiffNodesForNonRoot(
    newNode: T,
    oldNode: T | undefined,
    newNodeSiblingIds: string[],
    oldNodeSiblingIds: string[],
  ) {
    const diffNodes: T[] = [];
    let nextOldNode = oldNode;

    if (newNode.id !== oldNode?.id) {
      if (!oldNodeSiblingIds.includes(newNode.id)) {
        // newNode not in oldNode at same level
        nextOldNode = this.processAddedOrMovedNode(newNode);
      }

      if (oldNode !== undefined && !newNodeSiblingIds.includes(oldNode.id)) {
        // oldNode not in newNode at same level
        await this.processDeletedOrMovedNode(oldNode);
        diffNodes.push(oldNode);
      }

      if (oldNodeSiblingIds.includes(newNode.id)) {
        // oldNode is in newNode at same level
        nextOldNode = assertDefined(this.oldIdNodeMap.get(newNode.id));
      }
    }

    if (
      newNode.id === nextOldNode?.id &&
      (await this.isModified(newNode, nextOldNode, this.denylistProperties))
    ) {
      this.processModifiedNodes(newNode, nextOldNode);
    }

    await this.processNewNodeChildren(newNode, nextOldNode);
    diffNodes.push(newNode);
    return diffNodes;
  }

  private processAddedOrMovedNode(newNode: T): T | undefined {
    if (this.oldIdNodeMap.get(newNode.id) && this.addDiffsToNewRoot) {
      newNode.setDiff(DiffType.ADDED_MOVE);
      return this.oldIdNodeMap.get(newNode.id);
    }
    newNode.setDiff(DiffType.ADDED);
    return undefined;
  }

  private async processDeletedOrMovedNode(oldNode: T): Promise<void> {
    if (this.newIdNodeMap.get(oldNode.id)) {
      oldNode.setDiff(DiffType.DELETED_MOVE);
    } else {
      oldNode.setDiff(DiffType.DELETED);
    }
    const newChildren = await this.visitChildren(undefined, oldNode);
    oldNode.removeAllChildren();
    newChildren.forEach((child) => {
      assertDefined(oldNode).addOrReplaceChild(child);
    });
    this.processOldNode(oldNode);
  }

  private async visitChildren(
    newNode: T | undefined,
    oldNode: T | undefined,
  ): Promise<T[]> {
    const diffChildren: T[] = [];

    const newNodeChildren = newNode?.getAllChildren() ?? [];
    const oldNodeChildren = oldNode?.getAllChildren() ?? [];

    const numOfChildren = Math.max(
      newNodeChildren.length,
      oldNodeChildren.length,
    );
    for (let i = 0; i < numOfChildren; i++) {
      const newChild = newNodeChildren[i];
      let oldChild: T | undefined = oldNodeChildren[i];

      if (!oldChild && newChild) {
        oldChild = oldNodeChildren.find(
          (node: T) => node.name === newChild.name,
        );
      }

      const childDiffTrees = await this.generateDiffNodes(
        newChild,
        oldChild,
        newNodeChildren.map((child: T) => child.id),
        oldNodeChildren.map((child: T) => child.id),
      );
      childDiffTrees.forEach((child) => diffChildren.push(child));
    }

    return diffChildren;
  }
}

export type IsModifiedCallbackType = (
  newTree: TreeNode,
  oldTree: TreeNode,
  denylistProperties: string[],
) => Promise<boolean>;

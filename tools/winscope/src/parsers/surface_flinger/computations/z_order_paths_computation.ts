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
import {Computation} from '@tree_node/computation';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

export class ZOrderPathsComputation implements Computation {
  private root: HierarchyTreeNode | undefined;

  setRoot(value: HierarchyTreeNode): ZOrderPathsComputation {
    this.root = value;
    return this;
  }

  executeInPlace(): void {
    if (!this.root) {
      throw new Error('root not set in SF z-order paths computation');
    }
    const layerIdToTreeNode = this.makeMapOfIdToNode();
    this.updateZOrderParents(layerIdToTreeNode);
  }

  private makeMapOfIdToNode(): Map<number, HierarchyTreeNode> {
    const layerIdToTreeNode = new Map<number, HierarchyTreeNode>();
    assertDefined(this.root).forEachNodeDfs((node) => {
      if (node.isRoot()) return;
      layerIdToTreeNode.set(
        assertDefined(
          node.getEagerPropertyByName('layerId')?.getValue<number>(),
        ),
        node,
      );
    });
    return layerIdToTreeNode;
  }

  private updateZOrderParents(
    layerIdToTreeNode: Map<number, HierarchyTreeNode>,
  ) {
    assertDefined(this.root).forEachNodeDfs((node) => {
      const zOrderRelativeOf = node
        .getEagerPropertyByName('zOrderRelativeOf')
        ?.getValue<number>();
      if (zOrderRelativeOf && zOrderRelativeOf > 0) {
        const zParent = layerIdToTreeNode.get(zOrderRelativeOf);
        if (!zParent) {
          return;
        }
        node.setZParent(zParent);
        zParent.addRelativeChild(node);
      }
    });
  }
}

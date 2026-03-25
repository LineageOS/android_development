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

import {assertNumberOrUndefined} from '@common/assert';
import {LayerCompositionType} from '@trace/surface_flinger/layer_composition_type';
import {Operation} from '@tree_node/operation';
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {DUPLICATE_CHIP, GPU_CHIP, HIDDEN_BY_POLICY_CHIP, HWC_CHIP, MISSING_Z_PARENT_CHIP, RELATIVE_Z_CHIP, RELATIVE_Z_PARENT_CHIP, VISIBLE_CHIP,} from '@ui/shared/user_input/chip';

import {isVisible} from './ui_hierarchy_tree_node_helpers';

export class AddChips implements Operation<UiHierarchyTreeNode> {
  private relZParentIds: bigint[] = [];

  apply(node: UiHierarchyTreeNode): void {
    this.addAllChipsExceptRelZParent(node);
    this.addRelZParentChips(node);
  }

  private addAllChipsExceptRelZParent(node: UiHierarchyTreeNode) {
    if (!node.isRoot()) {
      const compositionType = assertNumberOrUndefined(
        node.getEagerPropertyByName('compositionType')?.getValue<number>(),
      );
      if (compositionType === LayerCompositionType.GPU) {
        node.addChip(GPU_CHIP);
      } else if (compositionType === LayerCompositionType.HWC) {
        node.addChip(HWC_CHIP);
      }

      if (isVisible(node)) {
        node.addChip(VISIBLE_CHIP);
      }

      if (node.getEagerPropertyByName('isDuplicate')?.getValue<boolean>()) {
        node.addChip(DUPLICATE_CHIP);
      }

      if (
        node.getEagerPropertyByName('isHiddenByPolicy')?.getValue<boolean>()
      ) {
        node.addChip(HIDDEN_BY_POLICY_CHIP);
      }

      const zOrderRelativeOf = node
        .getEagerPropertyByName('zOrderRelativeOf')
        ?.getValue<bigint>();
      if (zOrderRelativeOf && Number(zOrderRelativeOf) !== -1) {
        node.addChip(RELATIVE_Z_CHIP);
        this.relZParentIds.push(zOrderRelativeOf);

        if (
          node.getEagerPropertyByName('isMissingZParent')?.getValue<boolean>()
        ) {
          node.addChip(MISSING_Z_PARENT_CHIP);
        }
      }
    }

    node
      .getAllChildren()
      .forEach((child) => this.addAllChipsExceptRelZParent(child));
  }

  private addRelZParentChips(node: UiHierarchyTreeNode) {
    const treeLayerId = node
      .getEagerPropertyByName('layerId')
      ?.getValue<bigint>();
    if (treeLayerId && this.relZParentIds.includes(treeLayerId)) {
      node.addChip(RELATIVE_Z_PARENT_CHIP);
    }

    node.getAllChildren().forEach((child) => this.addRelZParentChips(child));
  }
}

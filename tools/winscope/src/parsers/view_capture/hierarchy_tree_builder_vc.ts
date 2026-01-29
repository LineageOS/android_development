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
import {HierarchyTreeBuilder} from '@parsers/helpers/hierarchy_tree_builder';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertiesProvider} from '@tree_node/properties_provider';

/**
 * Builder for a VC hierarchy tree.
 *
 * The builder is not reusable, it should only be used to build one tree.
 */
export class HierarchyTreeBuilderVc extends HierarchyTreeBuilder<bigint> {
  protected override buildIdentifierToChildrenMap(
    views: PropertiesProvider[],
  ): Map<bigint, readonly HierarchyTreeNode[]> {
    const map = views.reduce((map, view) => {
      const viewProperties = view.getEagerProperties();
      const viewNode = this.makeNode(
        viewProperties.id,
        viewProperties.name,
        view,
      );
      const id = assertDefined(
        viewProperties.getChildByName('nodeId')?.getValue<bigint>(),
      );
      map.set(id, [viewNode]);
      return map;
    }, new Map<bigint, HierarchyTreeNode[]>());
    return map;
  }

  protected override assignParentChildRelationships(
    root: HierarchyTreeNode,
    identifierToChildren: Map<bigint, HierarchyTreeNode[]>,
  ): void {
    const rootId = assertDefined(
      root.getEagerPropertyByName('nodeId')?.getValue<bigint>(),
    );

    for (const nodes of identifierToChildren.values()) {
      nodes.forEach((node) => {
        const parentId = assertDefined(
          node.getEagerPropertyByName('parentId')?.getValue<bigint>(),
        );
        const parentIsRoot = parentId === rootId;
        const parent = parentIsRoot
          ? root
          : assertDefined(identifierToChildren.get(parentId))[0];
        this.setParentChildRelationship(parent, node);
      });
    }
  }
}

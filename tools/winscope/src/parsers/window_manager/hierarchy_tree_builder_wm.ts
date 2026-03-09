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
import {PropertyTreeNode} from '@tree_node/property_tree_node';

import {ContainerType} from './container_type';

/**
 * Builder for a WM hierarchy tree.
 *
 * The builder is not reusable, it should only be used to build one tree.
 */
export class HierarchyTreeBuilderWm extends HierarchyTreeBuilder<number> {
  protected override buildIdentifierToChildrenMap(
    containers: PropertiesProvider[],
  ): Map<number, readonly HierarchyTreeNode[]> {
    const map = containers.reduce((map, container) => {
      const containerProperties = container.getEagerProperties();
      const containerNode = this.makeNode(
        containerProperties.id,
        this.getSubtreeName(containerProperties.name),
        container,
      );
      const token = assertDefined(
        this.getIdentifierValue(
          assertDefined(containerProperties.getChildByName('token')),
        ),
      );
      map.set(token, [containerNode]);
      return map;
    }, new Map<number, HierarchyTreeNode[]>());
    return map;
  }

  protected override assignParentChildRelationships(
    root: HierarchyTreeNode,
    identifierToChildren: Map<number, HierarchyTreeNode[]>,
  ): void {
    let rootWindowContainerToken: number | undefined;
    for (const [identifier, children] of identifierToChildren) {
      children.forEach((child) => {
        if (
          child.getEagerPropertyByName('containerType')?.getValue<string>() ===
          ContainerType.RootWindowContainer
        ) {
          rootWindowContainerToken = identifier;
          return;
        }

        const parentToken = child.getEagerPropertyByName('parentToken');

        let parent: HierarchyTreeNode | undefined;
        if (parentToken) {
          const parentId = this.getIdentifierValue(parentToken);
          if (parentId !== undefined && parentId !== rootWindowContainerToken) {
            const parents = identifierToChildren.get(parentId);
            if (parents) {
              parent = parents[0];
            }
          }
        }

        if (parent) {
          this.setParentChildRelationship(parent, child);
        } else {
          this.setParentChildRelationship(root, child);
        }
      });
    }
  }

  private getSubtreeName(tokenAndName: string): string {
    const splitId = tokenAndName.split(' ');
    return splitId.slice(1, splitId.length).join(' ');
  }

  private getIdentifierValue(identifier: PropertyTreeNode): number | undefined {
    return identifier.getValue<number>();
  }
}

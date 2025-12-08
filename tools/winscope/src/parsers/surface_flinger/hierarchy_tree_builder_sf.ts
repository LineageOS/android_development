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

import {assertDefined, assertNumber} from 'common/assert';
import {HierarchyTreeBuilder} from 'parsers/hierarchy_tree_builder';
import {PropertyTreeBuilderFromProto} from 'parsers/property_tree_builder_from_proto';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {PropertiesProvider} from 'tree_node/properties_provider';
import {PropertiesProviderBuilder} from 'tree_node/properties_provider_builder';
import {PropertySource, PropertyTreeNode} from 'tree_node/property_tree_node';
import {DEFAULT_PROPERTY_TREE_NODE_FACTORY} from 'tree_node/property_tree_node_factory';
import {SetFormatters} from 'viewers/operations/set_formatters';

export class HierarchyTreeBuilderSf extends HierarchyTreeBuilder {
  protected override buildIdentifierToChildrenMap(
    layers: PropertiesProvider[],
  ): Map<string | number, readonly HierarchyTreeNode[]> {
    const map = layers.reduce((map, layer) => {
      const layerProperties = layer.getEagerProperties();
      const layerNode = this.makeNode(
        layerProperties.id,
        layerProperties.name,
        layer,
      );
      const layerId = this.getIdentifierValue(
        assertDefined(layerProperties.getChildByName('layerId')),
      );

      const curr = map.get(layerId);
      if (curr) {
        curr.push(layerNode);
        const formatter = new SetFormatters();
        const property =
          DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeCalculatedProperty(
            layerProperties.id,
            'isDuplicate',
            true,
          );
        formatter.apply(property);
        layer.addEagerProperty(property);
      } else {
        map.set(layerId, [layerNode]);
      }
      return map;
    }, new Map<string | number, HierarchyTreeNode[]>());
    return map;
  }

  protected override assignParentChildRelationships(
    root: HierarchyTreeNode,
    identifierToChildren: Map<string | number, HierarchyTreeNode[]>,
    isRoot?: boolean,
  ): void {
    let recurLayerRoot: HierarchyTreeNode | undefined;

    for (const [identifier, children] of identifierToChildren) {
      children.forEach((child) => {
        const parentIdNode = child.getEagerPropertyByName('parent');
        const isDefault = parentIdNode?.source === PropertySource.DEFAULT;

        let parent: HierarchyTreeNode | undefined;
        if (parentIdNode) {
          const parentId = this.getIdentifierValue(parentIdNode);
          if (parentId === identifier) {
            // recursive id
            if (!recurLayerRoot) {
              recurLayerRoot = this.makeRecurParentRoot(identifierToChildren);
            }
            parent = recurLayerRoot;
          } else {
            parent = identifierToChildren.get(parentId)?.at(0);
          }
        }

        if (!isDefault && parent) {
          this.setParentChildRelationship(parent, child);
        } else {
          this.setParentChildRelationship(root, child);
        }
      });
    }

    if (recurLayerRoot) {
      this.setParentChildRelationship(root, recurLayerRoot);
    }
  }

  private makeRecurParentRoot(
    identifierToChildren: Map<string | number, HierarchyTreeNode[]>,
  ): HierarchyTreeNode {
    let uniqueLayerId = 1;
    const layerIds = Array.from(identifierToChildren.keys()).sort();
    for (const id of layerIds) {
      if (uniqueLayerId === id) {
        uniqueLayerId++;
      } else if (assertNumber(id) > uniqueLayerId) {
        break;
      }
    }

    const props = new PropertyTreeBuilderFromProto()
      .setData({
        layerId: BigInt(uniqueLayerId),
        detail:
          'This node was artificially created by Winscope as a parent for all recursive layers',
      })
      .setRootId(uniqueLayerId)
      .setRootName('WinscopeRecursiveLayerRoot')
      .build();
    const provider = new PropertiesProviderBuilder()
      .setEagerProperties(props)
      .setEagerOperations([new SetFormatters()])
      .build();

    return this.makeNode(props.id, props.name, provider);
  }

  private getIdentifierValue(identifier: PropertyTreeNode): number {
    return Number(identifier.getValue());
  }
}

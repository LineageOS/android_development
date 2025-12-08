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

import {assertDefined} from 'common/assert';
import {
  ChildProperty,
  PropertyTreeBuilder,
} from 'test/unit/property_tree_builder';
import {treeNodeEqualityTester} from 'test/unit/ui_tree_node_utils';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {OperationChain} from 'tree_node/operation_chain';
import {PropertiesProvider} from 'tree_node/properties_provider';
import {PropertySource, PropertyTreeNode} from 'tree_node/property_tree_node';
import {HierarchyTreeBuilderSf} from './hierarchy_tree_builder_sf';

describe('HierarchyTreeBuilderSf', () => {
  let builder: HierarchyTreeBuilderSf;
  let entry: PropertiesProvider;
  let expectedRoot: HierarchyTreeNode;

  beforeEach(() => {
    jasmine.addCustomEqualityTester(treeNodeEqualityTester);
    builder = new HierarchyTreeBuilderSf();
    const propertiesTree = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('LayerTraceEntry')
      .setName('root')
      .build();
    entry = makePropertiesProvider(propertiesTree);
    expectedRoot = new HierarchyTreeNode('LayerTraceEntry root', 'root', entry);
  });

  it('throws error if entry not set', () => {
    const noEntryError = new Error('root not set');
    expect(() => builder.setChildren([]).build()).toThrow(noEntryError);
  });

  it('throws error if layers not set', () => {
    const noLayersError = new Error('children not set');
    expect(() => builder.setRoot(entry).build()).toThrow(noLayersError);
  });

  it('builds root with no children correctly', () => {
    const root = builder.setRoot(entry).setChildren([]).build();
    expect(root).toEqual(expectedRoot);
  });

  it('builds root with children correctly', () => {
    const layer1Provider = makeLayerProperties(1, -1);
    const root = builder.setRoot(entry).setChildren([layer1Provider]).build();
    expectedRoot.addOrReplaceChild(makeHierarchyNode(layer1Provider));
    expect(root).toEqual(expectedRoot);
  });

  it('builds root with nested children correctly', () => {
    const layer1Provider = makeLayerProperties(1, -1, [{name: '0', value: 2}]);
    const layer2Provider = makeLayerProperties(2, 1, [{name: '1', value: 1}]);

    const root = builder
      .setRoot(entry)
      .setChildren([layer1Provider, layer2Provider])
      .build();

    const expectedRootLayer = makeHierarchyNode(layer1Provider);
    const expectedNestedLayer = makeHierarchyNode(layer2Provider);

    expectedRootLayer.addOrReplaceChild(expectedNestedLayer);
    expectedRoot.addOrReplaceChild(expectedRootLayer);

    expect(root).toEqual(expectedRoot);
  });

  it('builds root with duplicate id layers', () => {
    const layer1Provider = makeLayerProperties(1, -1);
    const layer2Provider = makeLayerProperties(2, 1);
    const layer2Provider2 = makeLayerProperties(2, 1, undefined, true);

    const root = builder
      .setRoot(entry)
      .setChildren([layer1Provider, layer2Provider, layer2Provider2])
      .build();

    const expectedRootLayer = makeHierarchyNode(layer1Provider);
    const expectedNestedLayer = makeHierarchyNode(layer2Provider);
    const expectedDupNestedLayer = makeHierarchyNode(layer2Provider2);

    expectedRootLayer.addOrReplaceChild(expectedNestedLayer);
    expectedRootLayer.addOrReplaceChild(expectedDupNestedLayer);
    expectedRoot.addOrReplaceChild(expectedRootLayer);

    expect(root).toEqual(expectedRoot);
  });

  it('builds root with default parent values correctly', () => {
    const layer1Provider = makeLayerProperties(1, -1);

    const layer2Props = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('2')
      .setName('layer2')
      .setChildren([
        {name: 'layerId', value: 2},
        {name: 'name', value: 'layer2'},
        {name: 'parent', value: 1, source: PropertySource.DEFAULT},
      ])
      .build();
    const layer2Provider = makePropertiesProvider(layer2Props);

    const root = builder
      .setRoot(entry)
      .setChildren([layer1Provider, layer2Provider])
      .build();

    const expectedLayer1 = makeHierarchyNode(layer1Provider);
    const expectedLayer2 = makeHierarchyNode(layer2Provider);

    expectedRoot.addOrReplaceChild(expectedLayer1);
    expectedRoot.addOrReplaceChild(expectedLayer2);

    expect(root).toEqual(expectedRoot);
  });

  it('handles missing parent values', () => {
    const layer1Provider = makeLayerProperties(1);
    const root = builder.setRoot(entry).setChildren([layer1Provider]).build();
    expectedRoot.addOrReplaceChild(makeHierarchyNode(layer1Provider));
    expect(root).toEqual(expectedRoot);
  });

  it('builds separate root layer with unique id for recursive layers', async () => {
    const layer1Provider = makeLayerProperties(1, 1);
    const layer3Provider = makeLayerProperties(3, 3);
    const layer4Provider = makeLayerProperties(4, -1);

    const root = builder
      .setRoot(entry)
      .setChildren([layer1Provider, layer3Provider, layer4Provider])
      .build();

    const expectedRootLayer = makeHierarchyNode(layer4Provider);
    expectedRoot.addOrReplaceChild(expectedRootLayer);

    const expRecurRootProps = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('2')
      .setName('WinscopeRecursiveLayerRoot')
      .setChildren([])
      .build();
    const expRecurRootProvider = makePropertiesProvider(expRecurRootProps);
    const expectedRecursiveRoot = makeHierarchyNode(expRecurRootProvider);
    expectedRoot.addOrReplaceChild(expectedRecursiveRoot);

    const expectedRecursiveLayer1 = makeHierarchyNode(layer1Provider);
    expectedRecursiveRoot.addOrReplaceChild(expectedRecursiveLayer1);

    const expectedRecursiveLayer3 = makeHierarchyNode(layer3Provider);
    expectedRecursiveRoot.addOrReplaceChild(expectedRecursiveLayer3);

    expect(root).toEqual(expectedRoot);

    const recursiveRootProps = assertDefined(
      await root.getChildByName(expRecurRootProps.name)?.getAllProperties(),
    );
    expect(recursiveRootProps.getAllChildren().length).toBe(2);

    const recursiveRootId = assertDefined(
      recursiveRootProps.getChildByName('layerId'),
    );
    expect(recursiveRootId.getValue()).toBe(2n);
    expect(recursiveRootId.formattedValue()).toBe('2');
    expect(recursiveRootProps.getChildByName('detail')?.getValue()).toBe(
      'This node was artificially created by Winscope as a parent for all recursive layers',
    );
  });

  function makeLayerProperties(
    id: number,
    parent?: number,
    children?: ChildProperty[],
    isDuplicate = false,
  ): PropertiesProvider {
    const name = 'layer' + id;
    const properties: ChildProperty[] = [
      {name: 'layerId', value: id},
      {name: 'name', value: name},
    ];
    if (parent !== undefined) {
      properties.push({name: 'parent', value: parent});
    }
    if (children) {
      properties.push({name: 'children', children});
    }
    const props = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId(id.toString())
      .setName(name + (isDuplicate ? ' duplicate(1)' : ''))
      .setChildren(properties)
      .build();
    return makePropertiesProvider(props);
  }

  function makePropertiesProvider(node: PropertyTreeNode): PropertiesProvider {
    return new PropertiesProvider(
      node,
      async () => node,
      OperationChain.emptyChain<PropertyTreeNode>(),
      OperationChain.emptyChain<PropertyTreeNode>(),
      OperationChain.emptyChain<PropertyTreeNode>(),
    );
  }

  function makeHierarchyNode(provider: PropertiesProvider): HierarchyTreeNode {
    const props = provider.getEagerProperties();
    return new HierarchyTreeNode(props.id, props.name, provider);
  }
});

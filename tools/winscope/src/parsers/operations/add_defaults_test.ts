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
import {getFakeProtoDescriptors} from '@compat/test/protobuf';
import {DEFAULT_PROPERTY_FORMATTER} from '@trace/formatters';
import {Registry, TamperedMessageType, TamperedProtoField,} from '@trace/proto_utils/tampered_message_type';
import {PropertySource, PropertyTreeNode} from '@tree_node/property_tree_node';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';

import {AddDefaults} from './add_defaults';

describe('AddDefaults', () => {
  let propertyRoot: PropertyTreeNode;
  let operation: AddDefaults;
  let rootField: TamperedProtoField;

  beforeAll(async () => {
    Registry.getInstance().parseDescriptors(await getFakeProtoDescriptors());
  });
  beforeEach(() => {
    rootField = (
      Registry.getInstance().getType(
        'winscope.test.RootMessage',
      ) as TamperedMessageType
    ).fields['entry'];
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .build();
  });

  it('adds only defaults from allowlist', () => {
    operation = new AddDefaults(rootField, ['number_32bit']);
    operation.apply(propertyRoot);
    expect(propertyRoot.getAllChildren().length).toBe(1);
    const defaultNode = assertDefined(
      propertyRoot.getChildByName('number_32bit'),
    );
    expect(defaultNode.getValue<number>()).toBe(0);
    checkAllNodesAreDefault(propertyRoot);
  });

  it('adds all defaults from prototype definition in absence of allowlist', () => {
    operation = new AddDefaults(rootField);
    operation.apply(propertyRoot);
    expect(propertyRoot.getAllChildren().length).toBe(24);
    checkAllNodesAreDefault(propertyRoot);
    expect(
      assertDefined(propertyRoot.getChildByName('array')).getValue<number[]>(),
    ).toEqual([]);
    expect(
      assertDefined(
        propertyRoot.getChildByName('number_32bit'),
      ).getValue<number>(),
    ).toBe(0);
    expect(
      assertDefined(propertyRoot.getChildByName('number_64bit'))
        .getValue()
        ?.toString(),
    ).toBe('0');
    expect(
      assertDefined(propertyRoot.getChildByName('boolValue')).getValue(),
    ).toBeFalse();
  });

  it('does not add defaults in denylist', () => {
    operation = new AddDefaults(rootField, undefined, [
      'number_32bit',
      'number_64bit',
    ]);
    operation.apply(propertyRoot);
    expect(propertyRoot.getAllChildren().length).toBe(22);
    checkAllNodesAreDefault(propertyRoot);
    expect(propertyRoot.getChildByName('number_32bit')).toBeUndefined();
    expect(propertyRoot.getChildByName('number_64bit')).toBeUndefined();
  });

  it('replaces undefined proto node with default node', () => {
    operation = new AddDefaults(rootField, ['number_32bit']);
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([{name: 'number_32bit', value: undefined}])
      .build();
    operation.apply(propertyRoot);

    expect(propertyRoot.getAllChildren().length).toBe(1);
    const defaultNode = assertDefined(
      propertyRoot.getChildByName('number_32bit'),
    );
    expect(defaultNode.getValue<number>()).toBe(0);
    checkAllNodesAreDefault(propertyRoot);
  });

  it('does not replace node that is already default', () => {
    operation = new AddDefaults(rootField);
    operation.apply(propertyRoot);
    const existingChildren = [...propertyRoot.getAllChildren()];
    existingChildren.forEach((c) => c.setFormatter(DEFAULT_PROPERTY_FORMATTER));

    operation.apply(propertyRoot);
    const newChildren = [...propertyRoot.getAllChildren()];
    expect(newChildren.length).toBe(existingChildren.length);
    newChildren.forEach((c, i) => {
      expect(c === existingChildren[i]).toBeTrue();
    });
  });

  function checkAllNodesAreDefault(root: PropertyTreeNode) {
    root.getAllChildren().forEach((child) => {
      expect(child.source).toEqual(PropertySource.DEFAULT);
    });
  }
});

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
import {TransformTypeFlags} from '@common/geometry/transform';
import {makeElapsedTimestamp} from '@common/time/testing/test_helpers';
import {getFakeProtoDescriptors} from '@compat/test/protobuf';
import {EMPTY_OBJ_STRING, LAYER_ID_FORMATTER} from '@trace/formatters';
import {Registry, TamperedMessageType, TamperedProtoField,} from '@trace/proto_utils/tampered_message_type';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';
import {makeBufferNode, makeColorNode, makePositionNode, makeRectNode, makeSizeNode, makeTransformNode,} from '@tree_node/testing/tree_node_test_helpers';

import {SetFormatters} from './set_formatters';

describe('SetFormatters', () => {
  let propertyRoot: PropertyTreeNode;
  let operation: SetFormatters;
  let field: TamperedProtoField;

  beforeAll(async () => {
    Registry.getInstance().parseDescriptors(await getFakeProtoDescriptors());
  });

  beforeEach(() => {
    field = (
      Registry.getInstance().getType(
        'winscope.test.RootMessage',
      ) as TamperedMessageType
    ).fields['entry'];
    operation = new SetFormatters();
  });

  it('adds correct formatter for enum node', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([{name: 'enum0', value: 0}])
      .build();
    operation = new SetFormatters(field);
    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    expect(propertyRoot.getChildByName('enum0')?.formattedValue()).toEqual('0');
  });

  it('adds correct formatter for color node', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .build();
    propertyRoot.addOrReplaceChild(makeColorNode(-1, -1, -1, 1));
    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    expect(
      assertDefined(propertyRoot.getChildByName('color')).formattedValue(),
    ).toEqual(`${EMPTY_OBJ_STRING}, alpha: 1`);
  });

  it('adds correct formatter for color3 node', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .build();
    propertyRoot.addOrReplaceChild(makeColorNode(0, 0, 0, undefined));
    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    expect(
      assertDefined(propertyRoot.getChildByName('color')).formattedValue(),
    ).toEqual(`(0, 0, 0)`);
  });

  it('adds correct formatter for rect node', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .build();
    propertyRoot.addOrReplaceChild(makeRectNode(0, 0, 1, 1));
    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    expect(
      assertDefined(propertyRoot.getChildByName('rect')).formattedValue(),
    ).toBe('(0, 0) - (1, 1)');
  });

  it('adds correct formatter for buffer node', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .build();
    propertyRoot.addOrReplaceChild(makeBufferNode());
    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    expect(
      assertDefined(propertyRoot.getChildByName('buffer')).formattedValue(),
    ).toBe('w: 1, h: 0, stride: 0, format: 1');
  });

  it('adds correct formatter for size node', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .build();
    propertyRoot.addOrReplaceChild(makeSizeNode(1, 2));
    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    expect(
      assertDefined(propertyRoot.getChildByName('size')).formattedValue(),
    ).toBe('1 x 2');
  });

  it('adds correct formatter for region node', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([
        {
          name: 'region',
          value: undefined,
          children: [
            {
              name: 'rect',
              value: undefined,
              children: [
                {
                  name: '0',
                  value: undefined,
                  children: [
                    {name: 'left', value: 0},
                    {name: 'top', value: 0},
                    {name: 'right', value: 1},
                    {name: 'bottom', value: 1},
                  ],
                },
              ],
            },
          ],
        },
      ])
      .build();
    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    expect(
      assertDefined(propertyRoot.getChildByName('region')).formattedValue(),
    ).toBe('SkRegion((0, 0, 1, 1))');
  });

  it('adds correct formatter for position node', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .build();
    propertyRoot.addOrReplaceChild(makePositionNode(1, 2));
    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    expect(
      assertDefined(propertyRoot.getChildByName('pos')).formattedValue(),
    ).toBe('x: 1, y: 2');
  });

  it('adds correct formatter for transform node', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .build();
    propertyRoot.addOrReplaceChild(makeTransformNode(TransformTypeFlags.EMPTY));
    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    expect(
      assertDefined(propertyRoot.getChildByName('transform')).formattedValue(),
    ).toBe('IDENTITY');
  });

  it('does not add formatter to unrecognised nested property', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([
        {name: 'nestedProperty', children: [{name: 'val', value: 1}]},
      ])
      .build();

    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    const propertyWithFormatters = assertDefined(
      propertyRoot.getChildByName('nestedProperty'),
    );
    expect(propertyWithFormatters.formattedValue()).toBe('');
    expect(
      assertDefined(
        propertyWithFormatters.getChildByName('val'),
      ).formattedValue(),
    ).toBe('1');
  });

  it('adds correct formatter for simple leaf property', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([{name: 'val', value: 1}])
      .build();

    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    expect(
      assertDefined(propertyRoot.getChildByName('val')).formattedValue(),
    ).toBe('1');
  });

  it('adds custom formatter', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([{name: 'layerId', value: -1}])
      .build();
    operation = new SetFormatters(
      undefined,
      new Map([['layerId', LAYER_ID_FORMATTER]]),
    );
    operation.apply(propertyRoot);

    expect(propertyRoot.formattedValue()).toBe('');
    expect(
      assertDefined(propertyRoot.getChildByName('layerId')).formattedValue(),
    ).toBe('none');
  });

  it('adds correct formatter for timestamp node', () => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([
        {
          name: 'ts',
          value: makeElapsedTimestamp(10n),
        },
      ])
      .build();
    operation.apply(propertyRoot);
    expect(propertyRoot.getChildByName('ts')?.formattedValue()).toBe('10ns');
  });
});

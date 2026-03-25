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

import {assertDefined} from '@common/assert';
import {convertSnakeToCamelCase} from '@common/string_helpers';
import {getFakeProtoDescriptors} from '@compat/test/protobuf';
import {ColumnType, RowIterator} from '@trace_processor/query_result';
import {makeSpyRowIterator} from '@trace_processor/test_utils';
import {Registry} from '@trace/proto_utils/tampered_message_type';
import {TamperedMessageType} from '@trace/proto_utils/tampered_message_type';
import {PropertySource, PropertyValue} from '@tree_node/property_tree_node';
import {ChildProperty, PropertyTreeBuilder,} from '@tree_node/testing/property_tree_builder';

import {PropertyTreeBuilderFromArgs} from './property_tree_builder_from_args';

describe('PropertyTreeBuilderFromArgs', () => {
  let messageType: TamperedMessageType;
  const keyCol = 'key';
  const valueTypeCol = 'value_type';
  const realValueCol = 'real_value';
  const stringValueCol = 'string_value';
  const intValueCol = 'int_value';

  beforeAll(async () => {
    const registry = Registry.getInstance();
    registry.parseDescriptors(await getFakeProtoDescriptors());
    messageType = assertDefined(registry.getType('winscope.test.Entry'));
  });
  describe('without transformation', () => {
    it('makes bool properties', () => {
      checkBoolValueReceived(1n, true);
      checkBoolValueReceived(0n, false);
    });

    it('makes int properties', () => {
      checkIntValuesReceived('int');
    });

    it('makes uint properties', () => {
      checkIntValuesReceived('uint');
    });

    it('makes null properties', () => {
      const iter = makeSpyRowForNullProperty();
      checkValueReceived(iter, null);
    });

    it('makes real properties', () => {
      checkRealValueReceived(123.456);
      checkRealValueReceived(0);
      checkRealValueReceived(null);
    });

    it('makes string properties', () => {
      checkStringValueReceived('value123');
      checkStringValueReceived('');
      checkStringValueReceived(null);
    });

    it('makes nested properties', () => {
      const iter = setUpIterator('string', 'parent_prop.child_prop');
      iter.get.withArgs(stringValueCol).and.returnValue('first');

      iter.next.and.callFake(() => {
        iter.get.withArgs(stringValueCol).and.returnValue('second');
        iter.get
          .withArgs(keyCol)
          .and.returnValue('parent_prop.child_prop_other');
        iter.next.and.callFake(() => iter.valid.and.returnValue(false));
      });

      const expectedTree = makeExpTree([
        {
          name: 'parentProp',
          children: [
            {name: 'childProp', value: 'first'},
            {name: 'childPropOther', value: 'second'},
          ],
        },
      ]);
      const tree = getBuilder().setData(iter).build();
      expect(tree).toEqual(expectedTree);
    });

    it('makes array properties', () => {
      const iter = setUpIterator('string', 'prop[0]');
      iter.get.withArgs(stringValueCol).and.returnValue('first');

      iter.next.and.callFake(() => {
        iter.get.withArgs(keyCol).and.returnValue('prop[1]');
        iter.get.withArgs(stringValueCol).and.returnValue('second');
        iter.next.and.callFake(() => iter.valid.and.returnValue(false));
      });

      const expectedTree = makeExpTree([
        {
          name: 'prop',
          children: [
            {name: '0', value: 'first'},
            {name: '1', value: 'second'},
          ],
        },
      ]);
      const tree = getBuilder().setData(iter).build();
      expect(tree).toEqual(expectedTree);
    });

    it('makes nested array properties', () => {
      const iter = setUpIterator('int', 'parent[0].child[0]');
      iter.get.withArgs(intValueCol).and.returnValue(0n);

      const expectedTree = makeExpTree([
        {
          name: 'parent',
          children: [
            {
              name: '0',
              children: [{name: 'child', children: [{name: '0', value: 0n}]}],
            },
          ],
        },
      ]);
      const tree = getBuilder().setData(iter).build();
      expect(tree).toEqual(expectedTree);
    });

    it('builds new root using provided root node id', () => {
      const iter = makeSpyRowForNullProperty();
      const expectedTree = makeExpTree([{name: 'testProp', value: undefined}]);
      const tree = getBuilder()
        .setRootId('1 rootName')
        .setData(iter)
        .setUseRootIdWithoutChange(true)
        .build();
      expect(tree).toEqual(expectedTree);
    });

    it('ends iteration if row validity check fails', () => {
      const iter = makeSpyRowForNullProperty();
      const expectedTree = makeExpTree([]);
      const tree = getBuilder()
        .setData(iter)
        .setRowValidityCheck(() => false)
        .build();
      expect(tree).toEqual(expectedTree);
    });

    it('skips row that contains property in denylist', () => {
      const iter = makeSpyRowForNullProperty();
      const expectedTree = makeExpTree([]);
      const tree = getBuilder().setData(iter).setDenyList(['testProp']).build();
      expect(tree).toEqual(expectedTree);
    });

    it('skips row if parent contains property in denylist', () => {
      const iter = makeSpyRowForNullProperty(true);
      const expectedTree = makeExpTree([]);
      const tree = getBuilder().setData(iter).setDenyList(['testProp']).build();
      expect(tree).toEqual(expectedTree);
    });

    function makeSpyRowForNullProperty(nested = false) {
      const key = nested ? 'parent.test_prop' : 'test_prop';
      const iter = setUpIterator('null', key);
      iter.get.withArgs(keyCol).and.returnValue(key);
      return iter;
    }

    function checkIntValuesReceived(valueType: string) {
      checkIntValueReceived(valueType, 10n);
      checkIntValueReceived(valueType, 0n);
      checkIntValueReceived(valueType, null);
    }

    function checkIntValueReceived(
      valueType: string,
      colValue: ColumnType | null,
    ) {
      const iter = setUpIterator(valueType);
      iter.get.withArgs(intValueCol).and.returnValue(colValue);
      checkValueReceived(iter, colValue);
    }

    function checkBoolValueReceived(colValue: bigint, expValue: boolean) {
      const iter = setUpIterator('bool');
      iter.get.withArgs(intValueCol).and.returnValue(colValue);
      checkValueReceived(iter, expValue);
    }

    function checkRealValueReceived(colValue: number | null) {
      const iter = setUpIterator('real');
      iter.get.withArgs(realValueCol).and.returnValue(colValue);
      checkValueReceived(iter, colValue);
    }

    function checkStringValueReceived(colValue: string | null) {
      const iter = setUpIterator('string');
      iter.get.withArgs(stringValueCol).and.returnValue(colValue);
      checkValueReceived(iter, colValue);
    }
  });

  describe('transforms values based on field type', () => {
    it('transforms double type to number', () => {
      checkBigIntTransformedToNumber('double_value');
    });

    it('transforms float type to number', () => {
      checkBigIntTransformedToNumber('float_value');
    });

    it('transforms int32 type to number', () => {
      checkBigIntTransformedToNumber('number_32bit');
    });

    it('transforms uint32 type to number', () => {
      checkBigIntTransformedToNumber('uint32_value');
    });

    it('transforms sint32 type to number', () => {
      checkBigIntTransformedToNumber('sint32_value');
    });

    it('transforms fixed32 type to number', () => {
      checkBigIntTransformedToNumber('fixed32_value');
    });

    it('transforms sfixed32 type to number', () => {
      checkBigIntTransformedToNumber('sfixed32_value');
    });

    it('transforms int64 type to bigint', () => {
      checkNumberTransformedToBigInt('number_64bit');
    });

    it('transforms uint64 type to bigint', () => {
      checkNumberTransformedToBigInt('uint64_value');
    });

    it('transforms sint64 type to bigint', () => {
      checkNumberTransformedToBigInt('sint64_value');
    });

    it('transforms fixed64 type to bigint', () => {
      checkNumberTransformedToBigInt('fixed64_value');
    });

    it('transforms sfixed64 type to bigint', () => {
      checkNumberTransformedToBigInt('sfixed64_value');
    });

    it('leaves string value unchanged', () => {
      checkValueRemainsString('string_value');
    });

    it('leaves bytes value unchanged', () => {
      checkValueRemainsString('bytes_value');
    });

    it('leaves string enum value unchanged', () => {
      checkValueRemainsString('enum0');
    });

    it('transforms enum value to number if bigint', () => {
      checkBigIntTransformedToNumber('enum0');
    });

    it('transforms bool type to boolean', () => {
      const iter = setUpIterator('int', 'bool_value');
      iter.get.withArgs(intValueCol).and.returnValue(1n);
      checkValueReceived(iter, true, convertSnakeToCamelCase('bool_value'));
    });

    it('transforms repeated field to empty array if null', () => {
      const iter = setUpIterator('int', 'array');
      checkValueReceived(iter, [], 'array');
    });

    it('finds corresponding nested field', () => {
      const iter = setUpIterator('int', 'nested_message.property');
      iter.get.withArgs(intValueCol).and.returnValue(10n);

      const expectedTree = makeExpTree([
        {name: 'nestedMessage', children: [{name: 'property', value: 10}]},
      ]);
      const tree = getBuilder().setData(iter).build();
      expect(tree).toEqual(expectedTree);
    });

    function checkBigIntTransformedToNumber(key: string) {
      const iter = setUpIterator('int', key);
      iter.get.withArgs(intValueCol).and.returnValue(10n);
      checkValueReceived(iter, 10, convertSnakeToCamelCase(key));
    }

    function checkNumberTransformedToBigInt(key: string) {
      const iter = setUpIterator('real', key);
      iter.get.withArgs(realValueCol).and.returnValue(10);
      checkValueReceived(iter, 10n, convertSnakeToCamelCase(key));
    }

    function checkValueRemainsString(key: string) {
      const iter = setUpIterator('string', key);
      iter.get.withArgs(stringValueCol).and.returnValue('123');
      checkValueReceived(iter, '123', convertSnakeToCamelCase(key));
    }
  });

  describe('adds property as default', () => {
    it('double type', () => {
      checkAddedAsDefaultNumberValue('double_value');
    });

    it('float type', () => {
      checkAddedAsDefaultNumberValue('float_value');
    });

    it('int32 type', () => {
      checkAddedAsDefaultNumberValue('number_32bit');
    });

    it('uint32 type', () => {
      checkAddedAsDefaultNumberValue('uint32_value');
    });

    it('sint32 type', () => {
      checkAddedAsDefaultNumberValue('sint32_value');
    });

    it('fixed32 type', () => {
      checkAddedAsDefaultNumberValue('fixed32_value');
    });

    it('sfixed32 type', () => {
      checkAddedAsDefaultNumberValue('sfixed32_value');
    });

    it('int64 type', () => {
      checkAddedAsDefaultBigIntValue('number_64bit');
    });

    it('uint64 type', () => {
      checkAddedAsDefaultBigIntValue('uint64_value');
    });

    it('sint64 type', () => {
      checkAddedAsDefaultBigIntValue('sint64_value');
    });

    it('fixed64 type', () => {
      checkAddedAsDefaultBigIntValue('fixed64_value');
    });

    it('sfixed64 type', () => {
      checkAddedAsDefaultBigIntValue('sfixed64_value');
    });

    it('bool type', () => {
      const iter = setUpIterator('bool', 'bool_value');
      checkDefaultValueReceived(iter, false, 'boolValue');
    });

    it('string type', () => {
      const iter = setUpIterator('string', 'string_value');
      checkDefaultValueReceived(iter, null, 'stringValue');
    });

    it('enum type', () => {
      const iter = setUpIterator('int', 'enum0');
      checkDefaultValueReceived(iter, 'ZERO', 'enum0');
    });

    function checkAddedAsDefaultNumberValue(key: string) {
      intAddedAsDefault(key, 0n);
      intAddedAsDefault(key, null);
    }

    function checkAddedAsDefaultBigIntValue(key: string) {
      realAddedAsDefault(key, 0);
      realAddedAsDefault(key, null);
    }

    function intAddedAsDefault(key: string, value: bigint | null) {
      const iter = setUpIterator('int', key);
      iter.get.withArgs(intValueCol).and.returnValue(value);
      checkDefaultValueReceived(iter, 0, convertSnakeToCamelCase(key));
    }

    function realAddedAsDefault(key: string, value: number | null) {
      const iter = setUpIterator('real', key);
      iter.get.withArgs(realValueCol).and.returnValue(value);
      checkDefaultValueReceived(iter, 0n, convertSnakeToCamelCase(key));
    }

    function checkDefaultValueReceived(
      iter: RowIterator,
      exp: PropertyValue | null,
      prop: string,
    ) {
      const expectedTree = makeExpTree([
        {name: prop, value: exp ?? undefined, source: PropertySource.DEFAULT},
      ]);
      const tree = getBuilder().setData(iter).build();
      expect(tree).toEqual(expectedTree);
    }
  });

  function makeExpTree(properties: ChildProperty[]) {
    return new PropertyTreeBuilder()
      .setRootId('1')
      .setName('rootName')
      .setIsRoot(true)
      .setSource(PropertySource.PROTO)
      .setChildren(properties)
      .build();
  }

  function checkValueReceived(
    iter: RowIterator,
    exp: PropertyValue | null,
    prop = 'testProp',
  ) {
    const expectedTree = makeExpTree([{name: prop, value: exp ?? undefined}]);
    const tree = getBuilder().setData(iter).build();
    expect(tree).toEqual(expectedTree);
  }

  function setUpIterator(valueType: string, key?: string) {
    const iter = makeSpyRowIterator();
    iter.get.and.returnValue(null);
    iter.get.withArgs(valueTypeCol).and.returnValue(valueType);
    iter.get.withArgs(keyCol).and.returnValue(key ?? 'test_prop');
    return iter;
  }

  function getBuilder() {
    return new PropertyTreeBuilderFromArgs()
      .setRootId(1)
      .setRootName('rootName')
      .setRootMessageType(messageType);
  }
});

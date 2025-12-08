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

import {PropertyTreeBuilder} from 'test/unit/property_tree_builder';
import {makeSpyRowIterator} from 'trace_processor/test_utils';
import {PropertySource} from 'tree_node/property_tree_node';
import {PropertyTreeBuilderFromQueryRow} from './property_tree_builder_from_query_row';

describe('PropertyTreeBuilderFromQueryRow', () => {
  const columns = ['test_prop', 'other_prop'];
  const spyRow = makeSpyRowIterator();
  spyRow.get.withArgs(columns[0]).and.returnValue(1);
  spyRow.get.withArgs(columns[1]).and.returnValue('test_value');
  let builder: PropertyTreeBuilderFromQueryRow;

  beforeEach(() => {
    builder = new PropertyTreeBuilderFromQueryRow()
      .setRootId(1)
      .setRootName('rootName');
  });

  it('throws error if columns not set', () => {
    expect(builder.setData(makeSpyRowIterator()).build).toThrowError();
  });

  it('converts column name from snake to camel case', () => {
    const expectedRoot = new PropertyTreeBuilder()
      .setRootId('1')
      .setName('rootName')
      .setIsRoot(true)
      .setSource(PropertySource.TP)
      .setChildren([
        {name: 'testProp', value: 1},
        {name: 'otherProp', value: 'test_value'},
      ])
      .build();

    const tree = builder.setColumns(columns).setData(spyRow).build();
    expect(tree).toEqual(expectedRoot);
  });

  it('converts column to boolean value', () => {
    const expectedRoot = new PropertyTreeBuilder()
      .setRootId('1')
      .setName('rootName')
      .setIsRoot(true)
      .setSource(PropertySource.TP)
      .setChildren([
        {name: 'testProp', value: true},
        {name: 'otherProp', value: 'test_value'},
      ])
      .build();

    const tree = builder
      .setColumns(columns)
      .setConvertColumnToBoolean(columns[0])
      .setData(spyRow)
      .build();
    expect(tree).toEqual(expectedRoot);
  });
});

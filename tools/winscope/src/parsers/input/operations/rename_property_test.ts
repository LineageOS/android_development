/*
 * Copyright (C) 2026 The Android Open Source Project
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
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';

import {RenameProperty} from './rename_property';

describe('RenameProperty', () => {
  const timestamp = 517482680619000n;
  let propertyRoot: PropertyTreeNode;

  beforeEach(() => {
    propertyRoot = new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('test')
      .setName('node')
      .setChildren([
        {name: 'field1OldName', value: timestamp},
        {name: 'field2', value: timestamp},
      ])
      .build();
  });

  it('renames only the desired field', () => {
    const operation = new RenameProperty('field1OldName', 'field1NewName');
    operation.apply(propertyRoot);
    expect(propertyRoot.getChildByName('field1OldName')).toBeUndefined();
    expect(
      assertDefined(propertyRoot.getChildByName('field1NewName')).getValue(),
    ).toEqual(timestamp);
    expect(propertyRoot.getChildByName('field2')).toBeDefined();
  });
});

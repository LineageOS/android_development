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
import {PropertyTreeNode} from 'tree_node/property_tree_node';
import {UpdateTransitionTargets} from './update_transition_targets';

describe('UpdateTransitionTargets', () => {
  let operation: UpdateTransitionTargets;

  beforeEach(() => {
    const layerIdToName = new Map<number, string>([[2, 'testLayer']]);
    const windowTokenToTitle = new Map<string, string>([
      ['97b5518', 'testTitle'],
    ]);
    operation = new UpdateTransitionTargets(layerIdToName, windowTokenToTitle);
  });

  it('updates layerId and windowToken display names if in maps', () => {
    const propertyRoot = makeRoot(2, 159077656n);
    operation.apply(propertyRoot);
    checkLayerId(propertyRoot, '2 (testLayer)');
    checkWindowId(propertyRoot, '0x97b5518 (testTitle)');
  });

  it('updates only windowId display name if neither layer id nor token in maps', () => {
    const propertyRoot = makeRoot(1, 193491296n);
    operation.apply(propertyRoot);
    checkLayerId(propertyRoot, '');
    checkWindowId(propertyRoot, '0xb887160');
  });

  it('handles null id values', () => {
    const propertyRoot = makeRoot(undefined, undefined);
    operation.apply(propertyRoot);
    checkLayerId(propertyRoot, '');
    checkWindowId(propertyRoot, '');
  });

  function makeRoot(
    layer: number | undefined,
    window: bigint | undefined,
  ): PropertyTreeNode {
    return new PropertyTreeBuilder()
      .setIsRoot(true)
      .setRootId('TransitionsTraceEntry')
      .setName('transition')
      .setChildren([
        {
          name: 'targets',
          children: [
            {
              name: '0',
              children: [
                {name: 'layerId', value: layer},
                {name: 'windowId', value: window},
              ],
            },
          ],
        },
      ])
      .build();
  }

  function checkLayerId(root: PropertyTreeNode, value: string) {
    expect(
      root
        ?.getChildByName('targets')
        ?.getChildByName('0')
        ?.getChildByName('layerId')
        ?.formattedValue(),
    ).toEqual(value);
  }

  function checkWindowId(root: PropertyTreeNode, value: string) {
    expect(
      root
        ?.getChildByName('targets')
        ?.getChildByName('0')
        ?.getChildByName('windowId')
        ?.formattedValue(),
    ).toEqual(value);
  }
});

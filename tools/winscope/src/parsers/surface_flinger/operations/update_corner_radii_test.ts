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

import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {DEFAULT_PROPERTY_TREE_NODE_FACTORY} from '@tree_node/property_tree_node_factory';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';
import {makePropertyNode} from '@tree_node/testing/tree_node_test_helpers';

import {UpdateCornerRadii} from './update_corner_radii';

describe('UpdateCornerRadii', () => {
  const defaultRadii: object = {tl: 0, tr: 0, bl: 0, br: 0};
  let propertyRoot: PropertyTreeNode;
  let operation: UpdateCornerRadii;

  beforeEach(() => {
    operation = new UpdateCornerRadii();
    propertyRoot = new PropertyTreeBuilder()
      .setRootId('test')
      .setName('node')
      .setIsRoot(true)
      .build();
  });

  it('strips cornerRadii node', () => {
    checkRadiiNodeStripped('cornerRadii');
  });

  it('strips requestedCornerRadii node', () => {
    checkRadiiNodeStripped('requestedCornerRadii');
  });

  it('strips clientDrawnCornerRadii node', () => {
    checkRadiiNodeStripped('clientDrawnCornerRadii');
  });

  it('strips node with only some fields present', () => {
    checkRadiiNodeStripped('cornerRadii', {tl: 0});
  });

  it('ignores node with unrecognised name', () => {
    checkRadiiNodeNotStripped('cornerRadius');
  });

  it('ignores node with some valid fields', () => {
    checkRadiiNodeNotStripped('cornerRadii', {tl: 0, tr: 0, br: 0.5});
  });

  function checkRadiiNodeStripped(radiiName: string, radii = defaultRadii) {
    propertyRoot.addOrReplaceChild(
      makePropertyNode(propertyRoot.id, radiiName, radii),
    );
    const expectedRoot = makeExpectedNode(radiiName);
    operation.apply(propertyRoot);
    expect(propertyRoot.getChildByName(radiiName)).toEqual(expectedRoot);
  }

  function checkRadiiNodeNotStripped(radiiName: string, radii = defaultRadii) {
    const originalNode = makePropertyNode(propertyRoot.id, radiiName, radii);
    propertyRoot.addOrReplaceChild(originalNode);
    operation.apply(propertyRoot);
    expect(propertyRoot.getChildByName(radiiName)).toEqual(originalNode);
  }

  function makeExpectedNode(radiiName: string): PropertyTreeNode {
    return DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeDefaultProperty(
      propertyRoot.id,
      radiiName,
      undefined,
    );
  }
});

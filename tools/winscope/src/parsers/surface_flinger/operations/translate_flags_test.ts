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

import {FixedStringFormatter} from '@trace/formatters';
import {PropertySource, PropertyTreeNode} from '@tree_node/property_tree_node';
import {makePropertyNode} from '@tree_node/testing/tree_node_test_helpers';

import {TranslateFlags} from './translate_flags';

describe('TranslateFlags', () => {
  let propertyRoot: PropertyTreeNode;
  let expectedRoot: PropertyTreeNode;
  let operation: TranslateFlags;

  beforeEach(() => {
    operation = new TranslateFlags();
    propertyRoot = new PropertyTreeNode(
      'test node',
      'node',
      PropertySource.PROTO,
      undefined,
    );
    expectedRoot = new PropertyTreeNode(
      'test node',
      'node',
      PropertySource.PROTO,
      undefined,
    );
  });

  it('handles zero flags', () => {
    checkFlagsTranslated(0x0);
  });

  it('adds HIDDEN', () => {
    checkFlagsTranslated(0x1, 'HIDDEN (0x1)');
  });

  it('adds OPAQUE', () => {
    checkFlagsTranslated(0x2, 'OPAQUE (0x2)');
  });

  it('adds SKIP_SCREENSHOT', () => {
    checkFlagsTranslated(0x40, 'SKIP_SCREENSHOT (0x40)');
  });

  it('adds SECURE', () => {
    checkFlagsTranslated(0x80, 'SECURE (0x80)');
  });

  it('adds ENABLE_BACKPRESSURE', () => {
    checkFlagsTranslated(0x100, 'ENABLE_BACKPRESSURE (0x100)');
  });

  it('adds DISPLAY_DECORATION', () => {
    checkFlagsTranslated(0x200, 'DISPLAY_DECORATION (0x200)');
  });

  it('adds IGNORE_DESTINATION_FRAME', () => {
    checkFlagsTranslated(0x400, 'IGNORE_DESTINATION_FRAME (0x400)');
  });

  it('adds multiple flags depending on bits set', () => {
    checkFlagsTranslated(0x101, 'HIDDEN | ENABLE_BACKPRESSURE (0x101)');
  });

  it('handles no flags', () => {
    operation.apply(propertyRoot);
    expect(propertyRoot).toEqual(expectedRoot);
  });

  function checkFlagsTranslated(value: number, translation?: string) {
    const flags = makeFlagsNode(value);
    propertyRoot.addOrReplaceChild(flags);

    const expectedFlags = makeFlagsNode(value);
    if (translation) {
      expectedFlags.setFormatter(new FixedStringFormatter(translation));
    }
    expectedRoot.addOrReplaceChild(expectedFlags);

    operation.apply(propertyRoot);
    expect(propertyRoot).toEqual(expectedRoot);
  }

  function makeFlagsNode(value: number): PropertyTreeNode {
    return makePropertyNode(propertyRoot.id, 'flags', value);
  }
});

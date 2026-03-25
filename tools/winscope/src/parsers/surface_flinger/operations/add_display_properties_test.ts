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
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {makePropertyNode} from '@tree_node/testing/tree_node_test_helpers';

import {AddDisplayProperties} from './add_display_properties';

describe('AddDisplayProperties', () => {
  let propertyRoot: PropertyTreeNode;
  let operation: AddDisplayProperties;

  beforeEach(() => {
    operation = new AddDisplayProperties();
    propertyRoot = makePropertyNode('LayerTraceEntry', 'root', undefined);
  });

  it('adds isLargeScreen true', () => {
    const displays = makePropertyNode(propertyRoot.id, 'displays', [
      {
        dpiX: 0,
        dpiY: 0,
        size: {w: 1080, h: 2340},
        layerStack: 0,
      },
    ]);
    propertyRoot.addOrReplaceChild(displays);

    operation.apply(propertyRoot);
    checkIsLargeScreen(true);
  });

  it('adds isLargeScreen false', () => {
    const displays = makePropertyNode(propertyRoot.id, 'displays', [
      {
        dpiX: 0,
        dpiY: 0,
        size: {w: 0, h: 0},
        layerStack: 0,
      },
    ]);
    propertyRoot.addOrReplaceChild(displays);

    operation.apply(propertyRoot);
    checkIsLargeScreen(false);
  });

  it('adds isOn true', () => {
    const displays = makePropertyNode(propertyRoot.id, 'displays', [
      {
        dpiX: 0,
        dpiY: 0,
        size: {w: 1080, h: 2340},
        layerStack: 0,
      },
    ]);
    propertyRoot.addOrReplaceChild(displays);

    operation.apply(propertyRoot);
    checkIsOn(true);
  });

  it('adds isOn false', () => {
    const displays = makePropertyNode(propertyRoot.id, 'displays', [
      {
        dpiX: 0,
        dpiY: 0,
        size: {w: 1080, h: 2340},
        layerStack: 4294967295,
      },
    ]);
    propertyRoot.addOrReplaceChild(displays);

    operation.apply(propertyRoot);
    checkIsOn(false);
  });

  it('handles missing size properties', () => {
    expect(() => operation.apply(propertyRoot)).not.toThrowError();

    const displays = makePropertyNode(propertyRoot.id, 'displays', [
      {
        dpiX: 0,
        layerStack: 4294967295,
      },
    ]);
    propertyRoot.addOrReplaceChild(displays);

    operation.apply(propertyRoot);
    checkIsLargeScreen(false);
    checkIsOn(false);
  });

  it('handles missing dpi and layer stack properties', () => {
    expect(() => operation.apply(propertyRoot)).not.toThrowError();

    const displays = makePropertyNode(propertyRoot.id, 'displays', [
      {
        size: {w: 1080, h: 2340},
      },
    ]);
    propertyRoot.addOrReplaceChild(displays);

    operation.apply(propertyRoot);
    checkIsLargeScreen(true);
    checkIsOn(true);
  });

  function checkIsLargeScreen(isLargeScreen: boolean) {
    const display = assertDefined(
      propertyRoot.getChildByName('displays'),
    ).getAllChildren()[0];
    expect(display.getChildByName('isLargeScreen')?.getValue()).toEqual(
      isLargeScreen,
    );
  }

  function checkIsOn(isOn: boolean) {
    const display = assertDefined(
      propertyRoot.getChildByName('displays'),
    ).getAllChildren()[0];
    expect(display.getChildByName('isOn')?.getValue()).toEqual(isOn);
  }
});

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
import {PropertyTreeBuilder} from 'test/unit/property_tree_builder';
import {
  makeBufferNode,
  makeColorNode,
  makePositionNode,
  makeRectNode,
  makeSizeNode,
} from 'test/unit/tree_node_test_helpers';

describe('property_tree_node', () => {
  it('identifies color', () => {
    const color = makeColorNode(0, 0, 0, 1);
    expect(color.isColor()).toBeTrue();

    const colorOnlyA = makeColorNode(undefined, undefined, undefined, 1);
    expect(colorOnlyA.isColor()).toBeTrue();
  });

  it('identifies rect', () => {
    const rect = makeRectNode(0, 0, 1, 1);
    expect(rect.isRect()).toBeTrue();

    const rectLeftTop = makeRectNode(0, 0, undefined, undefined);
    expect(rectLeftTop.isRect()).toBeTrue();

    const rectRightBottom = makeRectNode(undefined, undefined, 1, 1);
    expect(rectRightBottom.isRect()).toBeTrue();
  });

  it('identifies buffer', () => {
    const buffer = makeBufferNode();
    expect(buffer.isBuffer()).toBeTrue();
  });

  it('identifies size', () => {
    const size = makeSizeNode(0, 0);
    expect(size.isSize()).toBeTrue();
    expect(size.isBuffer()).toBeFalse();

    const sizeOnlyW = makeSizeNode(0, undefined);
    expect(sizeOnlyW.isSize()).toBeTrue();

    const sizeOnlyH = makeSizeNode(undefined, 0);
    expect(sizeOnlyH.isSize()).toBeTrue();

    const notSize = new PropertyTreeBuilder()
      .setRootId('test node')
      .setName('size')
      .setChildren([
        {name: 'w', value: 0},
        {name: 'h', value: 0},
        {name: 'x', value: 0},
        {name: 'y', value: 0},
      ])
      .build();

    expect(notSize.isSize()).toBeFalse();
  });

  it('identifies position', () => {
    const pos = makePositionNode(0, 0);
    expect(pos.isPosition()).toBeTrue();
    expect(pos.isRect()).toBeFalse();

    const posOnlyX = makePositionNode(0, undefined);
    expect(posOnlyX.isPosition()).toBeTrue();

    const posOnlyY = makePositionNode(undefined, 0);
    expect(posOnlyY.isPosition()).toBeTrue();

    const notPos = new PropertyTreeBuilder()
      .setRootId('test node')
      .setName('pos')
      .setChildren([
        {name: 'w', value: 0},
        {name: 'h', value: 0},
        {name: 'x', value: 0},
        {name: 'y', value: 0},
      ])
      .build();

    expect(notPos.isPosition()).toBeFalse();
  });

  it('identifies region', () => {
    const region = new PropertyTreeBuilder()
      .setRootId('test node')
      .setName('region')
      .setChildren([{name: 'rect', value: []}])
      .build();
    expect(region.isRegion()).toBeTrue();

    const rectNode = assertDefined(region.getChildByName('rect'));
    rectNode.addOrReplaceChild(makeRectNode(0, 0, 1, 1, rectNode.id));
    rectNode.addOrReplaceChild(
      makeRectNode(0, 0, undefined, undefined, rectNode.id),
    );
    rectNode.addOrReplaceChild(
      makeRectNode(undefined, undefined, 1, 1, rectNode.id),
    );
    expect(region.isRegion()).toBeTrue();

    rectNode.addOrReplaceChild(makeColorNode(0, 0, 0, 0));
    expect(region.isRegion()).toBeFalse();
  });

  describe('identifies empty object', () => {
    it('rect', () => {
      const rectWithUndefinedValues = makeRectNode(0, 0, undefined, undefined);
      expect(rectWithUndefinedValues.isEmptyObj()).toBeTrue();

      const rectAllZeroValues = makeRectNode(0, 0, 0, 0);
      expect(rectAllZeroValues.isEmptyObj()).toBeTrue();

      const rectWithMinusOneValues = makeRectNode(0, 0, -1, -1);
      expect(rectWithMinusOneValues.isEmptyObj()).toBeTrue();
    });

    it('color', () => {
      const bMinusOne = makeColorNode(153, 23, -1, 1);
      expect(bMinusOne.isEmptyObj()).toBeTrue();

      const rgbMinusOne = makeColorNode(-1, -1, -1, 0.9);
      expect(rgbMinusOne.isEmptyObj()).toBeTrue();

      const alphaZero = makeColorNode(1, 1, 1, 0);
      expect(alphaZero.isEmptyObj()).toBeTrue();
    });
  });

  describe('identifies non-empty object', () => {
    it('rect', () => {
      const rect = makeRectNode(0, 0, 1, 1);
      expect(rect.isEmptyObj()).toBeFalse();
    });

    it('color', () => {
      const color = makeColorNode(0, 8, 0, 1);
      expect(color.isEmptyObj()).toBeFalse();

      const missingB = makeColorNode(153, 23, undefined, 1);
      expect(missingB.isEmptyObj()).toBeFalse();

      const rgbZeroAlphaNonZero = makeColorNode(0, 0, 0, 0.7);
      expect(rgbZeroAlphaNonZero.isEmptyObj()).toBeFalse();

      const rgbZeroAlphaOne = makeColorNode(0, 0, 0, 1);
      expect(rgbZeroAlphaOne.isEmptyObj()).toBeFalse();
    });
  });
});

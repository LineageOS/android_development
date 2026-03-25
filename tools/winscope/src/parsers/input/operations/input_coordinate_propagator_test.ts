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
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';

import {InputCoordinatePropagator} from './input_coordinate_propagator';

describe('InputCoordinatePropagator', () => {
  let operation: InputCoordinatePropagator;

  let root: PropertyTreeNode;

  beforeEach(() => {
    operation = new InputCoordinatePropagator();

    // prettier-ignore
    root = new PropertyTreeBuilder()
        .setRootId('entries')
        .setName('dispatchEntries')
        .setChildren([
          {name: 'event', children: [
              {name: 'pointer', children: [
                  {name: '0', children: [
                      {name: 'pointerId', value: 0},
                      {name: 'axisValue', children: [
                          {name: '0', children: [
                              {name: 'axis', value: 0},
                              {name: 'value', value: 1.23},
                            ]},
                          {name: '1', children: [
                              {name: 'axis', value: 1},
                              {name: 'value', value: 9.87},
                            ]},
                        ]},
                    ]},
                ]},
            ]},
          {name: 'dispatchEvents', children: [
              {name: '0', children: [
                  {name: 'dispatchedPointer', children: [
                      {name: '0', children: [
                          {name: 'pointerId', value: 0},
                        ]},
                    ]},
                ]},
           ]},
        ]).build();
  });

  it('propagates coordinates successfully', () => {
    operation.apply(root);

    const axisValueInWindow = root
      .getChildByName('dispatchEvents')
      ?.getChildByName('0')
      ?.getChildByName('dispatchedPointer')
      ?.getChildByName('0')
      ?.getChildByName('axisValueInWindow');
    expect(axisValueInWindow).toBeDefined();
    expect(
      axisValueInWindow
        ?.getChildByName('x')
        ?.getChildByName('axis')
        ?.getValue(),
    ).toBe(0);
    expect(
      axisValueInWindow
        ?.getChildByName('x')
        ?.getChildByName('value')
        ?.getValue(),
    ).toBe(1.23);
    expect(
      axisValueInWindow
        ?.getChildByName('y')
        ?.getChildByName('axis')
        ?.getValue(),
    ).toBe(1);
    expect(
      axisValueInWindow
        ?.getChildByName('y')
        ?.getChildByName('value')
        ?.getValue(),
    ).toBe(9.87);
    expect(
      root
        .getChildByName('dispatchEvents')
        ?.getChildByName('0')
        ?.getChildByName('dispatchedPointer')
        ?.getChildByName('0')
        ?.getChildByName('xInDisplay')
        ?.getValue(),
    ).toBe(1.23);
    expect(
      root
        .getChildByName('dispatchEvents')
        ?.getChildByName('0')
        ?.getChildByName('dispatchedPointer')
        ?.getChildByName('0')
        ?.getChildByName('yInDisplay')
        ?.getValue(),
    ).toBe(9.87);
  });

  it('does not propagate when pointer ids do not match', () => {
    // prettier-ignore
    const windowDispatchEntries = new PropertyTreeBuilder()
        .setRootId(root.id)
        .setName('dispatchEvents')
        .setChildren([
          {name: '0', children: [
              {name: 'dispatchedPointer', children: [
                  {name: '0', children: [
                      {name: 'pointerId', value: 4},
                    ]},
                ]},
            ]},
        ]).build();
    root.addOrReplaceChild(windowDispatchEntries);

    operation.apply(root);

    expect(
      root
        .getChildByName('dispatchEvents')
        ?.getChildByName('0')
        ?.getChildByName('dispatchedPointer')
        ?.getChildByName('0')
        ?.getChildByName('axisValueInWindow'),
    ).toBeUndefined();
    expect(
      root
        .getChildByName('dispatchEvents')
        ?.getChildByName('0')
        ?.getChildByName('dispatchedPointer')
        ?.getChildByName('0')
        ?.getChildByName('xInDisplay'),
    ).toBeUndefined();
    expect(
      root
        .getChildByName('dispatchEvents')
        ?.getChildByName('0')
        ?.getChildByName('dispatchedPointer')
        ?.getChildByName('0')
        ?.getChildByName('yInDisplay'),
    ).toBeUndefined();
  });

  it('only propagates when value is not present', () => {
    // prettier-ignore
    const windowDispatchEntries = new PropertyTreeBuilder()
        .setRootId(root.id)
        .setName('dispatchEvents')
        .setChildren([
              {name: '0', children: [
                  {name: 'dispatchedPointer', children: [
                      {name: '0', children: [
                          {name: 'pointerId', value: 0},
                          {name: 'axisValueInWindow', children: [
                              {name: '0', children: [
                                  {name: 'axis', value: 0},
                                  {name: 'value', value: 5},
                                ]},
                              {name: '1', children: [
                                  {name: 'axis', value: 1},
                                ]},
                            ]},
                          {name: 'xInDisplay', value: 0.98},
                          {name: 'yInDisplay', value: undefined},
                        ]},
                    ]},
                ]},
            ]).build();
    root.addOrReplaceChild(windowDispatchEntries);

    operation.apply(root);

    const axisValueInWindow = root
      .getChildByName('dispatchEvents')
      ?.getChildByName('0')
      ?.getChildByName('dispatchedPointer')
      ?.getChildByName('0')
      ?.getChildByName('axisValueInWindow');
    expect(axisValueInWindow).toBeDefined();
    expect(axisValueInWindow?.getChildByName('x')).toBeUndefined();
    expect(
      axisValueInWindow
        ?.getChildByName('0')
        ?.getChildByName('axis')
        ?.getValue(),
    ).toBe(0);
    expect(
      axisValueInWindow
        ?.getChildByName('0')
        ?.getChildByName('value')
        ?.getValue(),
    ).toBe(5);
    expect(axisValueInWindow?.getChildByName('1')).toBeUndefined();
    expect(
      axisValueInWindow
        ?.getChildByName('y')
        ?.getChildByName('axis')
        ?.getValue(),
    ).toBe(1);
    expect(
      axisValueInWindow
        ?.getChildByName('y')
        ?.getChildByName('value')
        ?.getValue(),
    ).toBe(9.87);
    expect(
      root
        .getChildByName('dispatchEvents')
        ?.getChildByName('0')
        ?.getChildByName('dispatchedPointer')
        ?.getChildByName('0')
        ?.getChildByName('xInDisplay')
        ?.getValue(),
    ).toBe(0.98);
    expect(
      root
        .getChildByName('dispatchEvents')
        ?.getChildByName('0')
        ?.getChildByName('dispatchedPointer')
        ?.getChildByName('0')
        ?.getChildByName('yInDisplay')
        ?.getValue(),
    ).toBe(9.87);
  });

  it('does not propagate when XY not present in event', () => {
    // prettier-ignore
    const motionEventNode = new PropertyTreeBuilder()
        .setRootId(root.id)
        .setName('event')
        .setChildren([
          {name: 'pointer', children: [
              {name: '0', children: [
                  {name: 'pointerId', value: 0},
                  {name: 'axisValue', children: [
                      {name: '0', children: [
                          {name: 'axis', value: 0},
                          {name: 'value', value: undefined},
                        ]},
                      {name: '1', children: [
                          {name: 'axis', value: 1},
                          {name: 'value', value: 9.87},
                        ]},
                    ]},
                ]},
            ]},
        ]).build();
    root.addOrReplaceChild(motionEventNode);

    operation.apply(root);

    expect(
      root
        .getChildByName('dispatchEvents')
        ?.getChildByName('0')
        ?.getChildByName('dispatchedPointer')
        ?.getChildByName('0')
        ?.getChildByName('axisValueInWindow'),
    ).toBeUndefined();
    expect(
      root
        .getChildByName('dispatchEvents')
        ?.getChildByName('0')
        ?.getChildByName('dispatchedPointer')
        ?.getChildByName('0')
        ?.getChildByName('xInDisplay'),
    ).toBeUndefined();
    expect(
      root
        .getChildByName('dispatchEvents')
        ?.getChildByName('0')
        ?.getChildByName('dispatchedPointer')
        ?.getChildByName('0')
        ?.getChildByName('yInDisplay'),
    ).toBeUndefined();
  });
});

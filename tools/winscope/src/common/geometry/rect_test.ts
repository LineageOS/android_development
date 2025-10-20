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
import {Point} from './point';
import {Rect} from './rect';

describe('Rect', () => {
  it('should initialize with the correct values', () => {
    const rect = new Rect(1, 2, 3, 4);
    expect(rect.x).toBe(1);
    expect(rect.y).toBe(2);
    expect(rect.w).toBe(3);
    expect(rect.h).toBe(4);
  });

  it('containsPoint should return true for a point inside the rect', () => {
    const rect = new Rect(0, 0, 10, 10);
    const point: Point = {x: 5, y: 5};
    expect(rect.containsPoint(point)).toBeTrue();
  });

  it('containsPoint should return false for a point outside the rect', () => {
    const rect = new Rect(0, 0, 10, 10);
    const point: Point = {x: 15, y: 15};
    expect(rect.containsPoint(point)).toBeFalse();
  });

  it('isEmpty should return true for an empty rect', () => {
    const rect = new Rect(-1, -1, 0, 0);
    expect(rect.isEmpty()).toBeTrue();
  });

  it('isEmpty should return false for a non-empty rect', () => {
    const rect = new Rect(0, 0, 10, 10);
    expect(rect.isEmpty()).toBeFalse();
  });
});

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
import {Point3D} from './point3d';

describe('Point3D', () => {
  it('should initialize with the correct values', () => {
    const point = new Point3D(1, 2, 3);
    expect(point.x).toBe(1);
    expect(point.y).toBe(2);
    expect(point.z).toBe(3);
  });

  it('isEqual should return true for equal points', () => {
    const point1 = new Point3D(1, 2, 3);
    const point2 = new Point3D(1, 2, 3);
    expect(point1.isEqual(point2)).toBeTrue();
  });

  it('isEqual should return false for unequal points', () => {
    const point1 = new Point3D(1, 2, 3);
    const point2 = new Point3D(4, 5, 6);
    expect(point1.isEqual(point2)).toBeFalse();
  });
});

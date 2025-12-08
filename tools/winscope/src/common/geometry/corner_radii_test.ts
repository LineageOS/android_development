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
import {CornerRadii} from './corner_radii';

describe('CornerRadii', () => {
  it('should initialize with the correct values', () => {
    const radii = new CornerRadii(1, 2, 3, 4);
    expect(radii.tl).toBe(1);
    expect(radii.tr).toBe(2);
    expect(radii.bl).toBe(3);
    expect(radii.br).toBe(4);
  });

  it('isEmpty should return true for all zero radii', () => {
    const radii = new CornerRadii(0, 0, 0, 0);
    expect(radii.isEmpty()).toBeTrue();
  });

  it('isEmpty should return false for non-zero radii', () => {
    const radii = new CornerRadii(1, 0, 0, 0);
    expect(radii.isEmpty()).toBeFalse();
  });

  it('isEqual should return true for equal radii', () => {
    const radii1 = new CornerRadii(1, 2, 3, 4);
    const radii2 = new CornerRadii(1, 2, 3, 4);
    expect(radii1.isEqual(radii2)).toBeTrue();
  });

  it('isEqual should return false for unequal radii', () => {
    const radii1 = new CornerRadii(1, 2, 3, 4);
    const radii2 = new CornerRadii(5, 6, 7, 8);
    expect(radii1.isEqual(radii2)).toBeFalse();
  });
});

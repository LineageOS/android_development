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
import {Rect} from './rect';
import {Region} from './region';

describe('Region', () => {
  it('should initialize with the correct rects', () => {
    const rects = [new Rect(0, 0, 10, 10), new Rect(20, 20, 30, 30)];
    const region = new Region(rects);
    expect(region.rects).toEqual(rects);
  });

  it('createEmpty should create a region with no rects', () => {
    const region = Region.createEmpty();
    expect(region.rects).toEqual([]);
  });
});

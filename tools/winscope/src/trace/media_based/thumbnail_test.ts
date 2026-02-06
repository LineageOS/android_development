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

import {Thumbnail} from './thumbnail';

describe('Thumbnail', () => {
  let thumbnail: Thumbnail;

  beforeEach(() => {
    thumbnail = new Thumbnail(
      10,
      2,
      4,
      new Blob([], {type: 'video/mp4'}),
      8,
      16,
    );
  });

  afterEach(() => {
    thumbnail.onDestroy();
  });

  it('updates thumb dimensions keeping aspect ratio', () => {
    expect(thumbnail.getThumbWidth()).toEqual(150);
    expect(thumbnail.getThumbHeight()).toEqual(75);

    thumbnail.setThumbWidth(500);
    expect(thumbnail.getThumbWidth()).toEqual(500);
    expect(thumbnail.getThumbHeight()).toEqual(250);
  });

  it('provides background image css', () => {
    expect(thumbnail.getBackgroundImageUrl()).toMatch(/blob:.*/);
  });

  it('revokes object url on destroy', () => {
    const url = thumbnail.getBackgroundImageUrl();
    const spy = spyOn(URL, 'revokeObjectURL').and.callThrough();
    thumbnail.onDestroy();
    expect(spy).toHaveBeenCalledWith(url);
  });

  it('provides background size css', () => {
    expect(thumbnail.getBackgroundSize()).toEqual({width: 600, height: 300});
  });

  it('updates background size css based on thumb width', () => {
    thumbnail.setThumbWidth(500);
    expect(thumbnail.getBackgroundSize()).toEqual({width: 2000, height: 1000});
  });

  it('provides background position css', () => {
    expect(thumbnail.getBackgroundPosition(0)).toEqual({x: -0, y: -0});
    expect(thumbnail.getBackgroundPosition(0.25)).toEqual({x: -300, y: -0});
    expect(thumbnail.getBackgroundPosition(0.75)).toEqual({x: -450, y: -75});
    expect(thumbnail.getBackgroundPosition(1)).toEqual({x: -300, y: -150});
  });

  it('updates background position css based on thumb width', () => {
    thumbnail.setThumbWidth(500);
    expect(thumbnail.getBackgroundPosition(0)).toEqual({x: -0, y: -0});
    expect(thumbnail.getBackgroundPosition(0.25)).toEqual({x: -1000, y: -0});
    expect(thumbnail.getBackgroundPosition(0.75)).toEqual({x: -1500, y: -250});
    expect(thumbnail.getBackgroundPosition(1)).toEqual({x: -1000, y: -500});
  });
});

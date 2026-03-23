/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {convertHexToRgb} from './timeline_drawer_helpers';

describe('timeline_drawer_helpers', () => {
  describe('convertHexToRgb', () => {
    it('handles full regex', () => {
      expect(convertHexToRgb('0135AF')).toEqual({r: 1, g: 53, b: 175});
    });

    it('handles full regex with # prefix', () => {
      expect(convertHexToRgb('#0135AF')).toEqual({r: 1, g: 53, b: 175});
    });

    it('handles shorthand regex', () => {
      expect(convertHexToRgb('13F')).toEqual({r: 17, g: 51, b: 255});
    });

    it('handles shorthand regex with #', () => {
      expect(convertHexToRgb('#13F')).toEqual({r: 17, g: 51, b: 255});
    });

    it('robust to invalid hex string', () => {
      expect(convertHexToRgb('#1')).toBeUndefined();
    });
  });
});

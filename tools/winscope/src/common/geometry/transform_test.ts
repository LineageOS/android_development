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
import {TransformMatrix} from './transform_matrix';
import {
  getDefaultTransform,
  getTypeFlags,
  isSimpleTransform,
  Transform,
  TransformTypeFlags,
} from './transform';

describe('TransformUtils', () => {
  describe('getTypeFlags', () => {
    it('handles IDENTITY transform', () => {
      expect(getTypeFlags(TransformTypeFlags.EMPTY)).toBe('IDENTITY');
    });

    it('handles SCALE transform', () => {
      expect(getTypeFlags(TransformTypeFlags.SCALE_VAL)).toBe('SCALE');
    });

    it('handles TRANSLATE transform', () => {
      expect(getTypeFlags(TransformTypeFlags.TRANSLATE_VAL)).toBe('TRANSLATE');
    });

    it('handles combined SCALE and TRANSLATE transform', () => {
      expect(
        getTypeFlags(
          TransformTypeFlags.SCALE_VAL | TransformTypeFlags.TRANSLATE_VAL,
        ),
      ).toBe('SCALE|TRANSLATE');
    });

    it('handles ROT_90 transform', () => {
      expect(
        getTypeFlags(
          TransformTypeFlags.ROTATE_VAL | TransformTypeFlags.ROT_90_VAL,
        ),
      ).toBe('ROT_90');
    });

    it('handles ROT_180 transform', () => {
      expect(
        getTypeFlags(
          TransformTypeFlags.ROTATE_VAL |
            TransformTypeFlags.FLIP_V_VAL |
            TransformTypeFlags.FLIP_H_VAL,
        ),
      ).toBe('ROT_180');
    });

    it('handles ROT_270 transform', () => {
      expect(
        getTypeFlags(
          TransformTypeFlags.ROTATE_VAL |
            TransformTypeFlags.ROT_90_VAL |
            TransformTypeFlags.FLIP_V_VAL |
            TransformTypeFlags.FLIP_H_VAL,
        ),
      ).toBe('ROT_270');
    });

    it('handles invalid rotation', () => {
      expect(
        getTypeFlags(
          TransformTypeFlags.ROTATE_VAL | TransformTypeFlags.ROT_INVALID_VAL,
        ),
      ).toBe('ROT_INVALID');
    });
  });

  it('should get default transform for IDENTITY', () => {
    const transform = getDefaultTransform(TransformTypeFlags.EMPTY, 10, 20);
    const expectedMatrix = TransformMatrix.from({
      dsdx: 1,
      dtdx: 0,
      tx: 10,
      dtdy: 0,
      dsdy: 1,
      ty: 20,
    });
    expect(transform).toEqual(
      new Transform(TransformTypeFlags.EMPTY, expectedMatrix),
    );
  });

  it('should get default transform for ROT_90', () => {
    const transform = getDefaultTransform(
      TransformTypeFlags.ROT_90_VAL,
      10,
      20,
    );
    const expectedMatrix = TransformMatrix.from({
      dsdx: 0,
      dtdx: 1,
      tx: 10,
      dtdy: -1,
      dsdy: 0,
      ty: 20,
    });
    expect(transform).toEqual(
      new Transform(TransformTypeFlags.ROT_90_VAL, expectedMatrix),
    );
  });

  it('should get default transform for ROT_180', () => {
    const type = TransformTypeFlags.FLIP_V_VAL | TransformTypeFlags.FLIP_H_VAL;
    const transform = getDefaultTransform(type, 10, 20);
    const expectedMatrix = TransformMatrix.from({
      dsdx: -1,
      dtdx: 0,
      tx: 10,
      dtdy: 0,
      dsdy: -1,
      ty: 20,
    });
    expect(transform).toEqual(new Transform(type, expectedMatrix));
  });

  it('should get default transform for ROT_270', () => {
    const type =
      TransformTypeFlags.ROT_90_VAL |
      TransformTypeFlags.FLIP_V_VAL |
      TransformTypeFlags.FLIP_H_VAL;
    const transform = getDefaultTransform(type, 10, 20);
    const expectedMatrix = TransformMatrix.from({
      dsdx: 0,
      dtdx: -1,
      tx: 10,
      dtdy: 1,
      dsdy: 0,
      ty: 20,
    });
    expect(transform).toEqual(new Transform(type, expectedMatrix));
  });

  it('should throw error for unknown default transform', () => {
    const unknownType = TransformTypeFlags.SCALE_VAL;
    expect(() => getDefaultTransform(unknownType, 10, 20)).toThrow(
      new Error(
        `Unknown transform type ${unknownType} found in SF trace entry`,
      ),
    );
  });

  it('should check if transform is simple', () => {
    expect(isSimpleTransform(TransformTypeFlags.EMPTY)).toBeTrue();
    expect(isSimpleTransform(TransformTypeFlags.TRANSLATE_VAL)).toBeTrue();
    expect(isSimpleTransform(TransformTypeFlags.ROT_90_VAL)).toBeTrue();
    expect(isSimpleTransform(TransformTypeFlags.SCALE_VAL)).toBeFalse();
    expect(isSimpleTransform(TransformTypeFlags.ROT_INVALID_VAL)).toBeFalse();
  });
});

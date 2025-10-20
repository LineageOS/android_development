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

import {TransformMatrix} from './transform_matrix';

/**
 * Flags for transform types.
 */
export enum TransformTypeFlags {
  EMPTY = 0x0,
  TRANSLATE_VAL = 0x0001,
  ROTATE_VAL = 0x0002,
  SCALE_VAL = 0x0004,
  FLIP_H_VAL = 0x0100,
  FLIP_V_VAL = 0x0200,
  ROT_90_VAL = 0x0400,
  ROT_INVALID_VAL = 0x8000,
}

/**
 * A transform with a type and a matrix.
 */
export class Transform {
  static EMPTY = new Transform(
    TransformTypeFlags.EMPTY,
    TransformMatrix.IDENTITY,
  );

  constructor(
    public type: TransformTypeFlags,
    public matrix: TransformMatrix,
  ) {}
}

/**
 * Converts transform type flags into a human-readable string representation.
 *
 * @param type The transform type flags.
 * @return A string representing the transform type.
 */
export function getTypeFlags(type: TransformTypeFlags): string {
  const typeFlags: string[] = [];

  if (
    isFlagClear(
      type,
      TransformTypeFlags.SCALE_VAL |
        TransformTypeFlags.ROTATE_VAL |
        TransformTypeFlags.TRANSLATE_VAL,
    )
  ) {
    typeFlags.push('IDENTITY');
  }

  if (isFlagSet(type, TransformTypeFlags.SCALE_VAL)) {
    typeFlags.push('SCALE');
  }

  if (isFlagSet(type, TransformTypeFlags.TRANSLATE_VAL)) {
    typeFlags.push('TRANSLATE');
  }

  if (isFlagSet(type, TransformTypeFlags.ROT_INVALID_VAL)) {
    typeFlags.push('ROT_INVALID');
  } else if (
    isFlagSet(
      type,
      TransformTypeFlags.ROT_90_VAL |
        TransformTypeFlags.FLIP_V_VAL |
        TransformTypeFlags.FLIP_H_VAL,
    )
  ) {
    typeFlags.push('ROT_270');
  } else if (
    isFlagSet(
      type,
      TransformTypeFlags.FLIP_V_VAL | TransformTypeFlags.FLIP_H_VAL,
    )
  ) {
    typeFlags.push('ROT_180');
  } else {
    if (isFlagSet(type, TransformTypeFlags.ROT_90_VAL)) {
      typeFlags.push('ROT_90');
    }
    if (isFlagSet(type, TransformTypeFlags.FLIP_V_VAL)) {
      typeFlags.push('FLIP_V');
    }
    if (isFlagSet(type, TransformTypeFlags.FLIP_H_VAL)) {
      typeFlags.push('FLIP_H');
    }
  }

  if (typeFlags.length === 0) {
    throw makeUnknownTransformTypeError(type);
  }
  return typeFlags.join('|');
}

/**
 * Creates a default transform based on the specified type and translation.
 *
 * @param type The type of transform.
 * @param x The x-coordinate of the translation.
 * @param y The y-coordinate of the translation.
 * @return A new Transform object.
 */
export function getDefaultTransform(
  type: TransformTypeFlags,
  x: number,
  y: number,
): Transform {
  // IDENTITY
  if (!type) {
    return new Transform(
      type,
      TransformMatrix.from({
        dsdx: 1,
        dtdx: 0,
        tx: x,
        dtdy: 0,
        dsdy: 1,
        ty: y,
      }),
    );
  }

  // ROT_270 = ROT_90|FLIP_H|FLIP_V
  if (
    isFlagSet(
      type,
      TransformTypeFlags.ROT_90_VAL |
        TransformTypeFlags.FLIP_V_VAL |
        TransformTypeFlags.FLIP_H_VAL,
    )
  ) {
    return new Transform(
      type,
      TransformMatrix.from({
        dsdx: 0,
        dtdx: -1,
        tx: x,
        dtdy: 1,
        dsdy: 0,
        ty: y,
      }),
    );
  }

  // ROT_180 = FLIP_H|FLIP_V
  if (
    isFlagSet(
      type,
      TransformTypeFlags.FLIP_V_VAL | TransformTypeFlags.FLIP_H_VAL,
    )
  ) {
    return new Transform(
      type,
      TransformMatrix.from({
        dsdx: -1,
        dtdx: 0,
        tx: x,
        dtdy: 0,
        dsdy: -1,
        ty: y,
      }),
    );
  }

  // ROT_90
  if (isFlagSet(type, TransformTypeFlags.ROT_90_VAL)) {
    return new Transform(
      type,
      TransformMatrix.from({
        dsdx: 0,
        dtdx: 1,
        tx: x,
        dtdy: -1,
        dsdy: 0,
        ty: y,
      }),
    );
  }

  // IDENTITY
  if (
    isFlagClear(
      type,
      TransformTypeFlags.SCALE_VAL | TransformTypeFlags.ROTATE_VAL,
    )
  ) {
    return new Transform(
      type,
      TransformMatrix.from({
        dsdx: 1,
        dtdx: 0,
        tx: x,
        dtdy: 0,
        dsdy: 1,
        ty: y,
      }),
    );
  }

  throw makeUnknownTransformTypeError(type);
}

/**
 * Creates an error for an unknown transform type.
 *
 * @param type The unknown transform type.
 * @return An Error object.
 */
export function makeUnknownTransformTypeError(type: TransformTypeFlags): Error {
  return new Error(`Unknown transform type ${type} found in SF trace entry`);
}

/**
 * Checks if a transform is simple (no scaling or invalid rotation).
 *
 * @param type The transform type flags.
 * @return True if the transform is simple, false otherwise.
 */
export function isSimpleTransform(type: TransformTypeFlags): boolean {
  return isFlagClear(
    type,
    TransformTypeFlags.ROT_INVALID_VAL | TransformTypeFlags.SCALE_VAL,
  );
}

/**
 * Checks if specific bits are set in the transform type.
 *
 * @param type The transform type flags.
 * @param bits The bits to check.
 * @return True if all specified bits are set, false otherwise.
 */
function isFlagSet(type: TransformTypeFlags, bits: number): boolean {
  type = type || 0;
  return (type & bits) === bits;
}

/**
 * Checks if specific bits are clear in the transform type.
 *
 * @param type The transform type flags.
 * @param bits The bits to check.
 * @return True if all specified bits are clear, false otherwise.
 */
function isFlagClear(type: TransformTypeFlags, bits: number): boolean {
  return (type & bits) === 0;
}

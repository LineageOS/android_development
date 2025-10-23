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
import {Point3D} from './point3d';
import {TransformMatrix} from './transform_matrix';

describe('TransformMatrix', () => {
  let matrix: TransformMatrix;

  beforeEach(() => {
    matrix = new TransformMatrix(2, 0, 10, 0, 3, 20);
  });

  it('should correctly initialize properties', () => {
    expect(matrix.dsdx).toBe(2);
    expect(matrix.dtdx).toBe(0);
    expect(matrix.tx).toBe(10);
    expect(matrix.dtdy).toBe(0);
    expect(matrix.dsdy).toBe(3);
    expect(matrix.ty).toBe(20);
  });

  it('should have a static IDENTITY matrix', () => {
    const identity = TransformMatrix.IDENTITY;
    expect(identity.dsdx).toBe(1);
    expect(identity.dtdx).toBe(0);
    expect(identity.tx).toBe(0);
    expect(identity.dtdy).toBe(0);
    expect(identity.dsdy).toBe(1);
    expect(identity.ty).toBe(0);
  });

  it('should create a matrix from an object', () => {
    const obj = {dsdx: 2, dtdx: 0, tx: 10, dtdy: 0, dsdy: 3, ty: 20};
    const newMatrix = TransformMatrix.from(obj);
    expect(newMatrix).toEqual(matrix);
  });

  it('should create a matrix from a partial object', () => {
    const partial = {dsdx: 2, ty: 20};
    const fallback = new TransformMatrix(1, 0, 0, 0, 1, 0);
    const newMatrix = TransformMatrix.from(partial, fallback);
    expect(newMatrix.dsdx).toBe(2);
    expect(newMatrix.dtdx).toBe(0);
    expect(newMatrix.tx).toBe(0);
    expect(newMatrix.dtdy).toBe(0);
    expect(newMatrix.dsdy).toBe(1);
    expect(newMatrix.ty).toBe(20);
  });

  it('should transform a 2D point', () => {
    const point: Point = {x: 5, y: 5};
    const transformedPoint = matrix.transformPoint(point);
    expect(transformedPoint.x).toBe(2 * 5 + 0 * 5 + 10);
    expect(transformedPoint.y).toBe(0 * 5 + 3 * 5 + 20);
  });

  it('should transform a 3D point', () => {
    const point: Point3D = new Point3D(5, 5, 5);
    const transformedPoint = matrix.transformPoint3D(point);
    expect(transformedPoint.x).toBe(2 * 5 + 0 * 5 + 10);
    expect(transformedPoint.y).toBe(0 * 5 + 3 * 5 + 20);
    expect(transformedPoint.z).toBe(5);
  });

  it('should calculate the inverse matrix', () => {
    const inverse = matrix.inverse();
    const point: Point = {x: 5, y: 5};
    const transformedPoint = matrix.transformPoint(point);
    const originalPoint = inverse.transformPoint(transformedPoint);
    expect(originalPoint.x).toBeCloseTo(point.x);
    expect(originalPoint.y).toBeCloseTo(point.y);
  });

  it('should add ty', () => {
    const newMatrix = matrix.addTy(5);
    expect(newMatrix.ty).toBe(25);
  });

  it('should check for equality', () => {
    const sameMatrix = new TransformMatrix(2, 0, 10, 0, 3, 20);
    const differentMatrix = new TransformMatrix(1, 1, 1, 1, 1, 1);
    expect(matrix.isEqual(sameMatrix)).toBeTrue();
    expect(matrix.isEqual(differentMatrix)).toBeFalse();
  });

  it('should return correct rotation angles', () => {
    expect(TransformMatrix.IDENTITY.getRotationAngle()).toBe(0);
    expect(
      TransformMatrix.from({
        dsdx: 0,
        dtdx: -1,
        dtdy: 1,
        dsdy: 0,
      }).getRotationAngle(),
    ).toBe(90);
    expect(TransformMatrix.from({dsdx: -1, dsdy: -1}).getRotationAngle()).toBe(
      180,
    );
    expect(
      TransformMatrix.from({
        dsdx: 0,
        dtdx: 1,
        dtdy: -1,
        dsdy: 0,
      }).getRotationAngle(),
    ).toBe(270);
  });
});

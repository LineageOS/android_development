/*
 * Copyright (C) 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Point} from './point';
import {Point3D} from './point3d';

/**
 * These values correspond to the values from the gui::Transform class in the
 * platform, defined in:
 * frameworks/native/libs/ui/include/ui/Transform.h
 * The values are listed in row-major order:
 *     [ dsdx, dtdx,  tx ]
 *     [ dtdy, dsdy,  ty ]
 *     [    0,    0,   1 ]
 */
export class TransformMatrix {
  constructor(
    readonly dsdx: number,
    readonly dtdx: number,
    readonly tx: number,
    readonly dtdy: number,
    readonly dsdy: number,
    readonly ty: number,
  ) {}

  static readonly IDENTITY: TransformMatrix = new TransformMatrix(
    1,
    0,
    0,
    0,
    1,
    0,
  );

  static from(
    m: {
      dsdx?: number;
      dtdx?: number;
      tx?: number;
      dtdy?: number;
      dsdy?: number;
      ty?: number;
    } = {},
    fallback: TransformMatrix = TransformMatrix.IDENTITY,
  ): TransformMatrix {
    return new TransformMatrix(
      m.dsdx ?? fallback.dsdx,
      m.dtdx ?? fallback.dtdx,
      m.tx ?? fallback.tx,
      m.dtdy ?? fallback.dtdy,
      m.dsdy ?? fallback.dsdy,
      m.ty ?? fallback.ty,
    );
  }

  transformPoint(point: Point): Point {
    return {
      x: this.dsdx * point.x + this.dtdx * point.y + this.tx,
      y: this.dtdy * point.x + this.dsdy * point.y + this.ty,
    };
  }

  transformPoint3D(point: Point3D): Point3D {
    const p = this.transformPoint(point);
    return new Point3D(p.x, p.y, point.z);
  }

  inverse(): TransformMatrix {
    const ident = 1.0 / this.det();
    const result = {
      dsdx: this.dsdy * ident,
      dtdx: -this.dtdx * ident,
      tx: 0,
      dsdy: this.dsdx * ident,
      dtdy: -this.dtdy * ident,
      ty: 0,
    };
    const t = TransformMatrix.from(result).transformPoint({
      x: -this.tx,
      y: -this.ty,
    });
    result.tx = t.x;
    result.ty = t.y;
    return TransformMatrix.from(result);
  }

  addTy(ty: number): TransformMatrix {
    return new TransformMatrix(
      this.dsdx,
      this.dtdx,
      this.tx,
      this.dtdy,
      this.dsdy,
      this.ty + ty,
    );
  }

  isEqual(other: TransformMatrix): boolean {
    return (
      this.dsdx === other.dsdx &&
      this.dtdx === other.dtdx &&
      this.tx === other.tx &&
      this.dtdy === other.dtdy &&
      this.dsdy === other.dsdy &&
      this.ty === other.ty
    );
  }

  private det(): number {
    return this.dsdx * this.dsdy - this.dtdx * this.dtdy;
  }
}

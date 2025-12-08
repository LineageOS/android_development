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

import {CornerRadii} from 'common/geometry/corner_radii';
import {Region} from 'common/geometry/region';
import {TransformMatrix} from 'common/geometry/transform_matrix';
import {Transform} from 'common/geometry/transform';
import {TraceRect} from './trace_rect';

/**
 * A builder for a trace rectangle.
 */
export class TraceRectBuilder {
  private x: number | undefined;
  private y: number | undefined;
  private w: number | undefined;
  private h: number | undefined;
  private id: string | undefined;
  private name: string | undefined;
  private cornerRadii: CornerRadii | undefined;
  private transform: TransformMatrix = Transform.EMPTY.matrix;
  private groupId: number | undefined;
  private isVisible: boolean | undefined;
  private isDisplay: boolean | undefined;
  private isActiveDisplay = false;
  private depth: number | undefined;
  private opacity: number | undefined;
  private isSpy: boolean | undefined;
  private fillRegion: Region | undefined;

  setX(value: number) {
    this.x = value;
    return this;
  }

  setY(value: number) {
    this.y = value;
    return this;
  }

  setWidth(value: number) {
    this.w = value;
    return this;
  }

  setHeight(value: number) {
    this.h = value;
    return this;
  }

  setId(value: string) {
    this.id = value;
    return this;
  }

  setName(value: string) {
    this.name = value;
    return this;
  }

  setCornerRadii(value: CornerRadii) {
    this.cornerRadii = value;
    return this;
  }

  setTransform(value: TransformMatrix) {
    this.transform = value;
    return this;
  }

  setGroupId(value: number) {
    this.groupId = value;
    return this;
  }

  setIsVisible(value: boolean) {
    this.isVisible = value;
    return this;
  }

  setIsDisplay(value: boolean) {
    this.isDisplay = value;
    return this;
  }

  setIsActiveDisplay(value: boolean) {
    this.isActiveDisplay = value;
    return this;
  }

  setDepth(value: number) {
    this.depth = value;
    return this;
  }

  setOpacity(value: number) {
    this.opacity = value;
    return this;
  }

  setIsSpy(value: boolean) {
    this.isSpy = value;
    return this;
  }

  setFillRegion(value: Region | undefined) {
    this.fillRegion = value;
    return this;
  }

  build(): TraceRect {
    if (this.x === undefined) {
      throw new Error('x not set');
    }

    if (this.y === undefined) {
      throw new Error('y not set');
    }

    if (this.w === undefined) {
      throw new Error('width not set');
    }

    if (this.h === undefined) {
      throw new Error('height not set');
    }

    if (this.id === undefined) {
      throw new Error('id not set');
    }

    if (this.name === undefined) {
      throw new Error('name not set');
    }

    if (this.groupId === undefined) {
      throw new Error('groupId not set');
    }

    if (this.isVisible === undefined) {
      throw new Error('isVisible not set');
    }

    if (this.isDisplay === undefined) {
      throw new Error('isDisplay not set');
    }

    if (this.depth === undefined) {
      throw new Error('depth not set');
    }

    if (this.isSpy === undefined) {
      throw new Error('isSpy not set');
    }

    return new TraceRect(
      this.x,
      this.y,
      this.w,
      this.h,
      this.id,
      this.name,
      this.cornerRadii,
      this.transform,
      this.groupId,
      this.isVisible,
      this.isDisplay,
      this.isActiveDisplay,
      this.depth,
      this.opacity,
      this.isSpy,
      this.fillRegion,
    );
  }
}

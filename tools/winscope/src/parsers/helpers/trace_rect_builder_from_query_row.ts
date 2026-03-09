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

import {assertBigInt, assertBigIntOrUndefined, assertNumber, assertNumberOrUndefined,} from '@common/assert';
import {CornerRadii} from '@common/geometry/corner_radii';
import {Rect} from '@common/geometry/rect';
import {Region} from '@common/geometry/region';
import {TransformMatrix} from '@common/geometry/transform_matrix';
import {RowIterator} from '@trace_processor/query_result';
import {TraceRect} from '@tree_node/trace_rect';
import {TraceRectBuilder} from '@tree_node/trace_rect_builder';

/**
 * A builder for creating a trace rect from a query row.
 */
export class TraceRectBuilderFromQueryRow {
  private row: RowIterator | undefined;
  private id: string | undefined;
  private name: string | undefined;
  private isDisplay = false;
  private isActiveDisplay = false;
  private rect: Rect | undefined;
  private transformMatrix: TransformMatrix | undefined;
  private xCol = 'x';
  private yCol = 'y';
  private wCol = 'w';
  private hCol = 'h';
  private isVisibleCol = 'is_visible';
  private groupIdCol = 'group_id';
  private depthCol = 'depth';
  private extractMatrix = true;
  private extractOpacity = false;
  private extractCornerRadii = false;
  private extractIsSpy = false;
  private fillRegion: Region | undefined;

  setRect(value: Rect | undefined): this {
    this.rect = value;
    return this;
  }

  setTransformMatrix(value: TransformMatrix | undefined): this {
    this.transformMatrix = value;
    return this;
  }

  setRow(value: RowIterator | undefined): this {
    this.row = value;
    return this;
  }

  setId(value: string): this {
    this.id = value;
    return this;
  }

  setName(value: string): this {
    this.name = value;
    return this;
  }

  setIsDisplay(value: boolean): this {
    this.isDisplay = value;
    return this;
  }

  setIsActiveDisplay(value: boolean): this {
    this.isActiveDisplay = value;
    return this;
  }

  setRectColumns(value: string[]): this {
    [this.xCol, this.yCol, this.wCol, this.hCol] = value;
    return this;
  }

  setIsVisibleColumn(value: string): this {
    this.isVisibleCol = value;
    return this;
  }

  setGroupIdColumn(value: string): this {
    this.groupIdCol = value;
    return this;
  }

  setDepthColumn(value: string): this {
    this.depthCol = value;
    return this;
  }

  setExtractMatrix(value: boolean): this {
    this.extractMatrix = value;
    return this;
  }

  setExtractOpacity(value: boolean): this {
    this.extractOpacity = value;
    return this;
  }

  setExtractCornerRadii(value: boolean): this {
    this.extractCornerRadii = value;
    return this;
  }

  setExtractIsSpy(value: boolean): this {
    this.extractIsSpy = value;
    return this;
  }

  addFillRegionRect(rect: Rect): this {
    if (!this.fillRegion) {
      this.fillRegion = Region.createEmpty();
    }
    this.fillRegion.rects.push(rect);
    return this;
  }

  build(): TraceRect {
    if (this.row === undefined) {
      throw new Error('row not set');
    }
    if (this.id === undefined) {
      throw new Error('id not set');
    }
    if (this.name === undefined) {
      throw new Error('name not set');
    }

    let x;
    let y;
    let w;
    let h;
    if (this.rect) {
      x = this.rect.x;
      y = this.rect.y;
      w = this.rect.w;
      h = this.rect.h;
    } else {
      x = assertNumber(this.row.get(this.xCol));
      y = assertNumber(this.row.get(this.yCol));
      w = assertNumber(this.row.get(this.wCol));
      h = assertNumber(this.row.get(this.hCol));
    }

    const isVisible = this.isDisplay
      ? 0n
      : assertBigInt(this.row.get(this.isVisibleCol) ?? 0n);
    const groupId = assertBigInt(this.row.get(this.groupIdCol));
    const depth = assertBigIntOrUndefined(
      this.row.get(this.depthCol) ?? undefined,
    );
    const isSpy = this.extractIsSpy
      ? assertBigInt(this.row.get('is_spy') ?? 0n)
      : 0n;

    let matrix = TransformMatrix.IDENTITY;
    if (this.extractMatrix) {
      if (this.transformMatrix) {
        matrix = this.transformMatrix;
      } else {
        // TODO(b/436835528): remove once consumers of
        // TraceRectBuilderFromQueryRow are adapted to use TraceGeometryData
        matrix = TransformMatrix.from({
          dsdx: assertNumber(this.row.get('dsdx')),
          dtdx: assertNumber(this.row.get('dtdx')),
          tx: assertNumber(this.row.get('tx')),
          dtdy: assertNumber(this.row.get('dtdy')),
          dsdy: assertNumber(this.row.get('dsdy')),
          ty: assertNumber(this.row.get('ty')),
        });
      }
    }

    const builder = new TraceRectBuilder()
      .setX(x)
      .setY(y)
      .setWidth(w)
      .setHeight(h)
      .setId(this.id)
      .setName(this.name)
      .setTransform(matrix)
      .setGroupId(Number(groupId))
      .setIsVisible(isVisible !== 0n)
      .setIsDisplay(this.isDisplay)
      .setIsActiveDisplay(this.isActiveDisplay)
      .setDepth(Number(depth))
      .setIsSpy(isSpy !== 0n);

    if (this.extractOpacity) {
      const opacity = assertNumberOrUndefined(
        this.row.get('opacity') ?? undefined,
      );
      if (opacity !== undefined) {
        builder.setOpacity(opacity);
      }
    }

    if (this.fillRegion) {
      builder.setFillRegion(this.fillRegion);
    }

    if (this.extractCornerRadii) {
      const cornerRadii = new CornerRadii(
        assertNumber(this.row.get('corner_radius_tl') ?? 0),
        assertNumber(this.row.get('corner_radius_tr') ?? 0),
        assertNumber(this.row.get('corner_radius_bl') ?? 0),
        assertNumber(this.row.get('corner_radius_br') ?? 0),
      );
      builder.setCornerRadii(cornerRadii);
    }

    return builder.build();
  }
}

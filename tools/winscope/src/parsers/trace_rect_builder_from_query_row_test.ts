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

import {CornerRadii} from 'common/geometry/corner_radii';
import {Rect} from 'common/geometry/rect';
import {Region} from 'common/geometry/region';
import {TransformMatrix} from 'common/geometry/transform_matrix';
import {RowIterator} from 'trace_processor/query_result';
import {makeSpyRowIterator} from 'trace_processor/test_utils';
import {TraceRectBuilder} from 'tree_node/trace_rect_builder';
import {TraceRectBuilderFromQueryRow} from './trace_rect_builder_from_query_row';

describe('TraceRectBuilderFromQueryRow', () => {
  const id = '123 rectName';
  const name = 'rectName';
  let builder: TraceRectBuilderFromQueryRow;
  let row: jasmine.SpyObj<RowIterator>;

  beforeEach(() => {
    row = makeSpyRowIterator();
    builder = new TraceRectBuilderFromQueryRow()
      .setRow(row)
      .setId(id)
      .setName(name);
  });

  it('throws error if row not set', () => {
    expect(new TraceRectBuilderFromQueryRow().build).toThrowError();
  });

  it('throws error if id not set', () => {
    expect(new TraceRectBuilderFromQueryRow().setRow(row).build).toThrowError();
  });

  it('throws error if name not set', () => {
    expect(
      new TraceRectBuilderFromQueryRow().setRow(row).setId(id).build,
    ).toThrowError();
  });

  it('makes rect with default values from default columns', () => {
    setDefaultColumnValues();
    const expectedRect = makeExpectedRect();
    expect(builder.build()).toEqual(expectedRect);
  });

  it('sets isDisplay as true and isVisible as false on rect', () => {
    setDefaultColumnValues();
    const expectedRect = makeExpectedRect({isDisplay: true, isVisible: false});
    expect(builder.setIsDisplay(true).build()).toEqual(expectedRect);
  });

  it('sets isActiveDisplay as true on rect', () => {
    setDefaultColumnValues();
    const expectedRect = makeExpectedRect({isActiveDisplay: true});
    expect(builder.setIsActiveDisplay(true).build()).toEqual(expectedRect);
  });

  it('extracts xywh from provided columns', () => {
    setDefaultColumnValues();
    row.get.withArgs('x1').and.returnValue(2);
    row.get.withArgs('y1').and.returnValue(3);
    row.get.withArgs('w1').and.returnValue(400);
    row.get.withArgs('h1').and.returnValue(200);
    const expectedRect = makeExpectedRect({x: 2, y: 3, w: 400, h: 200});
    expect(builder.setRectColumns(['x1', 'y1', 'w1', 'h1']).build()).toEqual(
      expectedRect,
    );
  });

  it('extracts isVisible from provided column', () => {
    setDefaultColumnValues();
    const column = 'is_visible_2';
    row.get.withArgs(column).and.returnValue(0n);
    const expectedRect = makeExpectedRect({isVisible: false});
    expect(builder.setIsVisibleColumn(column).build()).toEqual(expectedRect);
  });

  it('extracts groupId from provided column', () => {
    setDefaultColumnValues();
    const column = 'group_id_2';
    row.get.withArgs(column).and.returnValue(10n);
    const expectedRect = makeExpectedRect({groupId: 10});
    expect(builder.setGroupIdColumn(column).build()).toEqual(expectedRect);
  });

  it('extracts depth from provided column', () => {
    setDefaultColumnValues();
    const column = 'depth_2';
    row.get.withArgs(column).and.returnValue(12n);
    const expectedRect = makeExpectedRect({depth: 12});
    expect(builder.setDepthColumn(column).build()).toEqual(expectedRect);
  });

  it('extracts opacity', () => {
    setDefaultColumnValues();
    row.get.withArgs('opacity').and.returnValue(0.5);
    const expectedRect = makeExpectedRect({opacity: 0.5});
    expect(builder.setExtractOpacity(true).build()).toEqual(expectedRect);
  });

  it('extracts corner radii', () => {
    setDefaultColumnValues();
    row.get.withArgs('corner_radius_tl').and.returnValue(0.5);
    row.get.withArgs('corner_radius_tr').and.returnValue(0.25);
    row.get.withArgs('corner_radius_bl').and.returnValue(null);
    row.get.withArgs('corner_radius_br').and.returnValue(null);
    const expectedRect = makeExpectedRect({
      cornerRadii: new CornerRadii(0.5, 0.25, 0, 0),
    });
    expect(builder.setExtractCornerRadii(true).build()).toEqual(expectedRect);
  });

  it('does not extract matrix', () => {
    setDefaultColumnValues();
    const expectedRect = makeExpectedRect({
      transformMatrix: TransformMatrix.IDENTITY,
    });
    expect(builder.setExtractMatrix(false).build()).toEqual(expectedRect);
  });

  it('extracts isSpy', () => {
    setDefaultColumnValues();
    row.get.withArgs('is_spy').and.returnValue(1n);
    const expectedRect = makeExpectedRect({isSpy: true});
    expect(builder.setExtractIsSpy(true).build()).toEqual(expectedRect);
  });

  it('adds fill region', () => {
    setDefaultColumnValues();
    const fillRegion = new Region([new Rect(1, 2, 3, 4), new Rect(5, 6, 7, 8)]);
    const expectedRect = makeExpectedRect({fillRegion});
    expect(
      builder
        .addFillRegionRect(fillRegion.rects[0])
        .addFillRegionRect(fillRegion.rects[1])
        .build(),
    ).toEqual(expectedRect);
  });

  function setDefaultColumnValues() {
    row.get.withArgs('x').and.returnValue(1);
    row.get.withArgs('y').and.returnValue(1);
    row.get.withArgs('w').and.returnValue(200);
    row.get.withArgs('h').and.returnValue(400);
    row.get.withArgs('is_visible').and.returnValue(1n);
    row.get.withArgs('group_id').and.returnValue(3n);
    row.get.withArgs('depth').and.returnValue(5n);
    row.get.withArgs('opacity').and.returnValue(0.5);
    row.get.withArgs('dsdx').and.returnValue(1);
    row.get.withArgs('dtdx').and.returnValue(2);
    row.get.withArgs('tx').and.returnValue(3);
    row.get.withArgs('dtdy').and.returnValue(4);
    row.get.withArgs('dsdy').and.returnValue(5);
    row.get.withArgs('ty').and.returnValue(6);
  }

  interface ExpectedParams {
    isDisplay?: boolean;
    isVisible?: boolean;
    isActiveDisplay?: boolean;
    transformMatrix?: TransformMatrix;
    groupId?: number;
    depth?: number;
    opacity?: number;
    cornerRadii?: CornerRadii;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    isSpy?: boolean;
    fillRegion?: Region;
  }

  function makeExpectedRect(params?: ExpectedParams) {
    const defaultMatrix = TransformMatrix.from({
      dsdx: 1,
      dtdx: 2,
      tx: 3,
      dtdy: 4,
      dsdy: 5,
      ty: 6,
    });
    const builder = new TraceRectBuilder()
      .setX(params?.x ?? 1)
      .setY(params?.y ?? 1)
      .setWidth(params?.w ?? 200)
      .setHeight(params?.h ?? 400)
      .setId(id)
      .setName(name)
      .setTransform(params?.transformMatrix ?? defaultMatrix)
      .setGroupId(params?.groupId ?? 3)
      .setIsVisible(params?.isVisible !== undefined ? params.isVisible : true)
      .setIsDisplay(params?.isDisplay ?? false)
      .setIsActiveDisplay(params?.isActiveDisplay ?? false)
      .setDepth(params?.depth ?? 5)
      .setIsSpy(params?.isSpy ?? false);

    if (params?.opacity) {
      builder.setOpacity(params.opacity);
    }
    if (params?.fillRegion) {
      builder.setFillRegion(params.fillRegion);
    }
    if (params?.cornerRadii) {
      builder.setCornerRadii(params.cornerRadii);
    }
    return builder.build();
  }
});

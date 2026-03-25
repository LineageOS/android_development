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

import {assertDefined} from '@common/assert';
import {TransformTypeFlags} from '@common/geometry/transform';
import {TransformMatrix} from '@common/geometry/transform_matrix';
import {PropertySource, PropertyTreeNode} from '@tree_node/property_tree_node';
import {PropertyTreeBuilder} from '@tree_node/testing/property_tree_builder';
import {makeBufferNode, makeColorNode, makeMatrixNode, makePositionNode, makePropertyNode, makeRectNode, makeSizeNode, makeTransformNode,} from '@tree_node/testing/tree_node_test_helpers';

import {BUFFER_FORMATTER, COLOR_FORMATTER, CUJ_TYPE_FORMATTER, DEFAULT_PROPERTY_FORMATTER, EMPTY_ARRAY_STRING, EMPTY_OBJ_STRING, formatAsHex, HEX_FORMATTER, LAYER_ID_FORMATTER, MATRIX_FORMATTER, POSITION_FORMATTER, RECT_FORMATTER, REGION_FORMATTER, SIZE_FORMATTER, TRANSFORM_FORMATTER,} from './formatters';

describe('Formatters', () => {
  describe('PropertyFormatter', () => {
    it('translates simple values correctly', () => {
      expect(
        DEFAULT_PROPERTY_FORMATTER.format(
          new PropertyTreeNode('', '', PropertySource.PROTO, 12345),
        ),
      ).toBe('12345');
      expect(
        DEFAULT_PROPERTY_FORMATTER.format(
          new PropertyTreeNode('', '', PropertySource.PROTO, 'test_string'),
        ),
      ).toBe('test_string');
      expect(
        DEFAULT_PROPERTY_FORMATTER.format(
          new PropertyTreeNode('', '', PropertySource.PROTO, 0.1234),
        ),
      ).toBe('0.123');
      expect(
        DEFAULT_PROPERTY_FORMATTER.format(
          new PropertyTreeNode('', '', PropertySource.PROTO, 1.5),
        ),
      ).toBe('1.500');
    });

    it('translates values with toString method correctly', () => {
      expect(
        DEFAULT_PROPERTY_FORMATTER.format(
          new PropertyTreeNode('', '', PropertySource.PROTO, BigInt(123)),
        ),
      ).toBe('123');
    });

    it('translates default values correctly', () => {
      expect(
        DEFAULT_PROPERTY_FORMATTER.format(
          new PropertyTreeNode('', '', PropertySource.PROTO, []),
        ),
      ).toEqual(EMPTY_ARRAY_STRING);
      expect(
        DEFAULT_PROPERTY_FORMATTER.format(
          new PropertyTreeNode('', '', PropertySource.PROTO, false),
        ),
      ).toBe('false');
      expect(
        DEFAULT_PROPERTY_FORMATTER.format(
          new PropertyTreeNode('', '', PropertySource.PROTO, undefined),
        ),
      ).toBe('null');
    });
  });

  describe('ColorFormatter', () => {
    it('translates empty color to string correctly', () => {
      expect(COLOR_FORMATTER.format(makeColorNode(-1, -1, -1, 1))).toEqual(
        `${EMPTY_OBJ_STRING}, alpha: 1`,
      );
      expect(COLOR_FORMATTER.format(makeColorNode(1, 1, 1, 0))).toEqual(
        `${EMPTY_OBJ_STRING}, alpha: 0`,
      );
    });

    it('translates non-empty color to string correctly', () => {
      expect(COLOR_FORMATTER.format(makeColorNode(1, 2, 3, 1))).toEqual(
        '(1, 2, 3), alpha: 1',
      );
      expect(COLOR_FORMATTER.format(makeColorNode(1, 2, 3, 0.608))).toEqual(
        '(1, 2, 3), alpha: 0.608',
      );
    });

    it('translates rgb color without alpha to string correctly (transactions)', () => {
      expect(COLOR_FORMATTER.format(makeColorNode(1, 2, 3, undefined))).toEqual(
        '(1, 2, 3)',
      );
      expect(
        COLOR_FORMATTER.format(makeColorNode(0.106, 0.203, 0.313, undefined)),
      ).toBe('(0.106, 0.203, 0.313)');
    });
  });

  describe('RectFormatter', () => {
    it('translates empty rect to string correctly', () => {
      expect(RECT_FORMATTER.format(makeRectNode(0, 0, -1, -1))).toEqual(
        EMPTY_OBJ_STRING,
      );
      expect(RECT_FORMATTER.format(makeRectNode(0, 0, 0, 0))).toEqual(
        EMPTY_OBJ_STRING,
      );
    });

    it('translates non-empty rect to string correctly', () => {
      expect(RECT_FORMATTER.format(makeRectNode(0, 0, 1, 1))).toEqual(
        '(0, 0) - (1, 1)',
      );
      expect(RECT_FORMATTER.format(makeRectNode(0, 0, 10, 10))).toEqual(
        '(0, 0) - (10, 10)',
      );
      expect(
        RECT_FORMATTER.format(makeRectNode(0, 1.6431, 10456.9086, 10)),
      ).toBe('(0, 1.643) - (10456.909, 10)');
    });
  });

  describe('BufferFormatter', () => {
    it('translates buffer to string correctly', () => {
      const buffer = makeBufferNode();
      expect(BUFFER_FORMATTER.format(buffer)).toEqual(
        'w: 1, h: 0, stride: 0, format: 1',
      );
    });
  });

  describe('LayerIdFormatter', () => {
    it('translates -1 id correctly', () => {
      expect(
        LAYER_ID_FORMATTER.format(
          new PropertyTreeNode('', '', PropertySource.PROTO, -1),
        ),
      ).toBe('none');
    });

    it('translates valid id correctly', () => {
      expect(
        LAYER_ID_FORMATTER.format(
          new PropertyTreeNode('', '', PropertySource.PROTO, 1),
        ),
      ).toBe('1');
      expect(
        LAYER_ID_FORMATTER.format(
          new PropertyTreeNode('', '', PropertySource.PROTO, -10),
        ),
      ).toBe('-10');
    });
  });

  describe('MatrixFormatter', () => {
    it('translates matrix correctly', () => {
      expect(
        MATRIX_FORMATTER.format(
          makeMatrixNode(
            TransformMatrix.IDENTITY.dsdx,
            TransformMatrix.IDENTITY.dtdx,
            TransformMatrix.IDENTITY.dtdy,
            TransformMatrix.IDENTITY.dsdy,
          ),
        ),
      ).toBe('dsdx: 1, dtdx: 0, dtdy: 0, dsdy: 1');
      expect(MATRIX_FORMATTER.format(makeMatrixNode(0.4, 100, 1, 0.1232))).toBe(
        'dsdx: 0.400, dtdx: 100, dtdy: 1, dsdy: 0.123',
      );
      expect(MATRIX_FORMATTER.format(makeMatrixNode(0, 0, 0, 0))).toEqual(
        'null',
      );
      expect(
        MATRIX_FORMATTER.format(
          makePropertyNode('test node', 'transform', {
            dsdx: 1,
            dtdx: 0,
            tx: 5,
            dtdy: 0,
            dsdy: 1,
            ty: 10,
          }),
        ),
      ).toBe('dsdx: 1, dtdx: 0, dtdy: 0, dsdy: 1, tx: 5, ty: 10');
    });
  });

  describe('TransformFormatter', () => {
    it('translates type correctly', () => {
      expect(
        TRANSFORM_FORMATTER.format(makeTransformNode(TransformTypeFlags.EMPTY)),
      ).toBe('IDENTITY');
      expect(
        TRANSFORM_FORMATTER.format(
          makeTransformNode(TransformTypeFlags.TRANSLATE_VAL),
        ),
      ).toBe('TRANSLATE');
      expect(
        TRANSFORM_FORMATTER.format(
          makeTransformNode(TransformTypeFlags.SCALE_VAL),
        ),
      ).toBe('SCALE');
      expect(
        TRANSFORM_FORMATTER.format(
          makeTransformNode(TransformTypeFlags.FLIP_H_VAL),
        ),
      ).toBe('IDENTITY|FLIP_H');
      expect(
        TRANSFORM_FORMATTER.format(
          makeTransformNode(TransformTypeFlags.FLIP_V_VAL),
        ),
      ).toBe('IDENTITY|FLIP_V');
      expect(
        TRANSFORM_FORMATTER.format(
          makeTransformNode(TransformTypeFlags.ROT_90_VAL),
        ),
      ).toBe('IDENTITY|ROT_90');
      expect(
        TRANSFORM_FORMATTER.format(
          makeTransformNode(TransformTypeFlags.ROT_INVALID_VAL),
        ),
      ).toBe('IDENTITY|ROT_INVALID');
    });
  });

  describe('SizeFormatter', () => {
    it('translates size correctly', () => {
      expect(SIZE_FORMATTER.format(makeSizeNode(1, 2))).toBe('1 x 2');
    });
  });

  describe('PositionFormatter', () => {
    it('translates position correctly', () => {
      expect(POSITION_FORMATTER.format(makePositionNode(1, 2))).toEqual(
        'x: 1, y: 2',
      );
      expect(POSITION_FORMATTER.format(makePositionNode(1.5, 2.2916))).toEqual(
        'x: 1.500, y: 2.292',
      );
    });
  });

  describe('RegionFormatter', () => {
    it('translates region correctly', () => {
      const region = new PropertyTreeBuilder()
        .setRootId('test node')
        .setName('region')
        .setChildren([{name: 'rect', value: []}])
        .build();

      const rectNode = assertDefined(region.getChildByName('rect'));
      rectNode.addOrReplaceChild(makeRectNode(0, 0, 1080, 2340));

      expect(REGION_FORMATTER.format(region)).toEqual(
        'SkRegion((0, 0, 1080, 2340))',
      );
    });
  });

  describe('CujTypeFormatter', () => {
    it('translates known cuj type correctly', () => {
      const cujType = new PropertyTreeBuilder()
        .setRootId('test node')
        .setName('cujType')
        .setValue(66)
        .build();

      expect(CUJ_TYPE_FORMATTER.format(cujType)).toEqual(
        'CUJ_LAUNCHER_APP_SWIPE_TO_RECENTS (66)',
      );
    });

    it('translates unknown cuj type correctly', () => {
      const cujType = new PropertyTreeBuilder()
        .setRootId('test node')
        .setName('cujType')
        .setValue(-1)
        .build();

      expect(CUJ_TYPE_FORMATTER.format(cujType)).toBe('UNKNOWN (-1)');
    });
  });

  describe('hex formatting', () => {
    it('formatAsHex()', () => {
      expect(formatAsHex(0)).toBe('0x0');
      expect(formatAsHex(1024)).toBe('0x400');
      expect(formatAsHex(-1024)).toBe('0xfffffc00');
      expect(formatAsHex(-1024, true)).toBe('0xFFFFFC00');
    });

    it('HexFormatter', () => {
      const hashcode = new PropertyTreeBuilder()
        .setRootId('test node')
        .setName('hashcode')
        .setValue(1024)
        .build();
      expect(HEX_FORMATTER.format(hashcode)).toBe('0x400');
    });
  });
});

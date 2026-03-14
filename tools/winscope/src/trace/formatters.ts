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

import {getTypeFlags} from '@common/geometry/transform';
import {Timestamp} from '@common/time/time';
import {TimeDuration} from '@common/time/time_duration';
import {PropertyFormatter, PropertyTreeNode,} from '@tree_node/property_tree_node';

import {CUJ_TYPE} from './cuj_type';

/**
 * String used to represent an empty object in formatted output.
 * Useful for clearly indicating that a property tree node represents an empty object.
 */
export const EMPTY_OBJ_STRING = '{empty}';
/**
 * String used to represent an empty array in formatted output.
 * Useful for clearly indicating that a property tree node represents an empty array.
 */
export const EMPTY_ARRAY_STRING = '[empty]';
/**
 * Separator used when concatenating multiple flag strings.
 * This provides a consistent way to display multiple flags within a single formatted string.
 */
export const FLAG_SEPARATOR = ' | ';

function formatAsDecimal(value: number): string {
  if (!Number.isInteger(value)) {
    return value.toFixed(3).toString();
  }
  return value.toString();
}

/**
 * Formats a number as a hexadecimal string.
 * This function is useful for displaying numerical values in a hexadecimal format,
 * which is common in low-level system traces and debugging.
 *
 * @param value The number to format. Negative values are converted to their
 *        32-bit two's complement representation.
 * @param upperCase If true, the hex characters (a-f) will be in upper case. Defaults to false.
 * @param withPrefix If true, the output string will be prefixed with '0x'. Defaults to true.
 * @return The hexadecimal string representation of the value.
 */
export function formatAsHex(
  value: number,
  upperCase = false,
  withPrefix = true,
): string {
  if (value < 0) {
    value += Math.pow(2, 32); // convert to 2's complement
  }
  let hexValue = value.toString(16);
  if (upperCase) {
    hexValue = hexValue.toUpperCase();
  }
  return withPrefix ? '0x' + hexValue : hexValue;
}

function formatAsValueOrNull(value: unknown) {
  return `${value ?? 'null'}`;
}

class BufferFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    return `w: ${node.getChildByName('width')?.getValue() ?? 0}, h: ${
      node.getChildByName('height')?.getValue() ?? 0
    }, stride: ${node.getChildByName('stride')?.getValue()}, format: ${node
      .getChildByName('format')
      ?.getValue()}`;
  }
}

/**
 * Formats buffer properties (width, height, stride, format) into a concise string.
 * This formatter is useful for displaying essential buffer information in a readable format
 * within the Winscope UI, making it easier to understand buffer configurations at a glance.
 */
export const BUFFER_FORMATTER = new BufferFormatter();

class ColorFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    const rNode = node.getChildByName('r');
    const gNode = node.getChildByName('g');
    const bNode = node.getChildByName('b');
    const alphaNode = node.getChildByName('a');

    const r = formatAsDecimal(rNode?.getValue() ?? 0);
    const g = formatAsDecimal(gNode?.getValue() ?? 0);
    const b = formatAsDecimal(bNode?.getValue() ?? 0);
    const rgbString = `(${r}, ${g}, ${b})`;
    if (rNode && gNode && bNode && !alphaNode) {
      return rgbString;
    }

    const alpha = formatAsDecimal(alphaNode?.getValue() ?? 0);
    const alphaString = `alpha: ${alpha}`;
    if (node.isEmptyObj()) {
      return `${EMPTY_OBJ_STRING}, ${alphaString}`;
    }
    return `${rgbString}, ${alphaString}`;
  }
}

/**
 * Formats color properties (r, g, b, a) from a `PropertyTreeNode` into a concise string.
 * This formatter is useful for displaying color values in a readable format within the Winscope UI,
 * making it easier to understand color configurations.
 */
export const COLOR_FORMATTER = new ColorFormatter();

class CujTypeFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    const cujTypeId: string = `${node.getValue()}`;
    const cujTypeKey = cujTypeId as keyof typeof CUJ_TYPE;
    const cujTypeString = CUJ_TYPE[cujTypeKey];

    if (cujTypeString !== undefined) {
      return `${cujTypeString} (${cujTypeId})`;
    } else {
      return `UNKNOWN (${cujTypeId})`;
    }
  }
}

/**
 * Formats a CUJ (Critical User Journey) type ID into a more descriptive string.
 * This formatter takes a numeric or string ID and maps it to a known CUJ type name
 * from `CUJ_TYPE`, also including the original ID for clarity. It's useful for
 * displaying CUJ types in a user-friendly format within the Winscope UI.
 */
export const CUJ_TYPE_FORMATTER = new CujTypeFormatter();

class DefaultPropertyFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    const value = node.getValue();
    if (Array.isArray(value) && value.length === 0) {
      return EMPTY_ARRAY_STRING;
    }

    if (typeof value === 'number') {
      return formatAsDecimal(value);
    }

    if (value?.toString) return value.toString();

    return formatAsValueOrNull(value);
  }
}

/**
 * Provides a default formatting strategy for `PropertyTreeNode` values.
 * This formatter is used when no specific formatter is provided for a property.
 * It handles empty arrays, formats numbers as decimals, and uses the object's
 * `toString()` method if available, falling back to a string coercion.
 */
export const DEFAULT_PROPERTY_FORMATTER = new DefaultPropertyFormatter();

/**
 * Formats a numeric or bigint enum value into a human-readable string.
 * This formatter is useful for displaying enum properties in the Winscope UI,
 * by mapping the enum's numeric ID to a descriptive string.
 *
 * @param valuesById A map where keys are enum numeric values and values are their string representations.
 * @param overrideValue An optional string to return if the enum value is not found in `valuesById`.
 *        If not provided, the raw value is returned as a string.
 */
export class EnumFormatter implements PropertyFormatter {
  constructor(
    private readonly valuesById: {[key: number]: string},
    private readonly overrideValue?: string,
  ) {}

  format(node: PropertyTreeNode): string {
    const value = node.getValue();
    if (typeof value === 'number' && this.valuesById[value]) {
      return this.valuesById[value];
    }
    if (typeof value === 'bigint' && this.valuesById[Number(value)]) {
      return this.valuesById[Number(value)];
    }
    return this.overrideValue ?? formatAsValueOrNull(value);
  }
}

/**
 * A formatter that always returns a fixed, predefined string.
 * This is useful for displaying static labels or placeholders in the UI,
 * regardless of the actual value of the property node.
 */
export class FixedStringFormatter implements PropertyFormatter {
  constructor(private readonly fixedStringValue: string) {}

  format(_: PropertyTreeNode): string {
    return this.fixedStringValue;
  }
}

class HexFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    return formatAsHex(node.getValue() ?? 0);
  }
}
/**
 * Formats a numeric property tree node value as a hexadecimal string, prefixed with '0x'.
 * This is useful for displaying values like memory addresses or bitmasks in a standard hexadecimal format
 * within the Winscope UI.
 */
export const HEX_FORMATTER = new HexFormatter();

class HexNoPrefixFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    return formatAsHex(node.getValue() ?? 0, false, false);
  }
}
/**
 * Formats a numeric property tree node value as a hexadecimal string, without the '0x' prefix.
 * This is useful for displaying hexadecimal values in contexts where the '0x' prefix is redundant
 * or not desired, providing a more compact representation within the Winscope UI.
 */
export const HEX_NO_PREFIX_FORMATTER = new HexNoPrefixFormatter();

class LayerIdFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    const value = node.getValue();
    return value === -1 || value === 0 ? 'none' : formatAsValueOrNull(value);
  }
}
/**
 * Formats a layer ID. Returns 'none' for layer IDs of -1 or 0, which commonly represent
 * an invalid or absent layer, and the ID itself otherwise. This makes layer ID properties
 * more readable in the Winscope UI.
 */
export const LAYER_ID_FORMATTER = new LayerIdFormatter();

class MatrixFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    const dsdx = formatAsDecimal(node.getChildByName('dsdx')?.getValue() ?? 0);
    const dtdx = formatAsDecimal(node.getChildByName('dtdx')?.getValue() ?? 0);
    const dtdy = formatAsDecimal(node.getChildByName('dtdy')?.getValue() ?? 0);
    const dsdy = formatAsDecimal(node.getChildByName('dsdy')?.getValue() ?? 0);
    const tx = node.getChildByName('tx');
    const ty = node.getChildByName('ty');
    if (
      dsdx === '0' &&
      dtdx === '0' &&
      dsdy === '0' &&
      dtdy === '0' &&
      !tx &&
      !ty
    ) {
      return 'null';
    }
    const matrix22 = `dsdx: ${dsdx}, dtdx: ${dtdx}, dtdy: ${dtdy}, dsdy: ${dsdy}`;
    if (!tx && !ty) {
      return matrix22;
    }
    return (
      matrix22 +
      `, tx: ${formatAsDecimal(tx?.getValue() ?? 0)}, ty: ${formatAsDecimal(
        ty?.getValue() ?? 0,
      )}`
    );
  }
}

/**
 * Formats matrix properties (dsdx, dtdx, dtdy, dsdy, tx, ty) into a concise string.
 * This formatter is useful for displaying transformation matrices in a readable format
 * within the Winscope UI, including special handling for identity or null matrices.
 */
export const MATRIX_FORMATTER = new MatrixFormatter();

class PositionFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    const x = formatAsDecimal(node.getChildByName('x')?.getValue() ?? 0);
    const y = formatAsDecimal(node.getChildByName('y')?.getValue() ?? 0);
    return `x: ${x}, y: ${y}`;
  }
}
/**
 * Formats position properties (x, y) into a concise string.
 * This formatter is useful for displaying 2D coordinates in a readable format
 * within the Winscope UI.
 */
export const POSITION_FORMATTER = new PositionFormatter();

class RectFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    if (!node.isRect() || node.isEmptyObj()) {
      return EMPTY_OBJ_STRING;
    }
    const left = formatAsDecimal(node.getChildByName('left')?.getValue() ?? 0);
    const top = formatAsDecimal(node.getChildByName('top')?.getValue() ?? 0);
    const right = formatAsDecimal(
      node.getChildByName('right')?.getValue() ?? 0,
    );
    const bottom = formatAsDecimal(
      node.getChildByName('bottom')?.getValue() ?? 0,
    );

    return `(${left}, ${top}) - (${right}, ${bottom})`;
  }
}
/**
 * Formats rectangle properties (left, top, right, bottom) into a concise string.
 * This formatter is useful for displaying rectangular bounds in a readable format
 * within the Winscope UI.
 */
export const RECT_FORMATTER = new RectFormatter();

class RegionFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    let res = 'SkRegion(';
    node
      .getChildByName('rect')
      ?.getAllChildren()
      .forEach((rectNode: PropertyTreeNode) => {
        res += `(${rectNode.getChildByName('left')?.getValue() ?? 0}, ${
          rectNode.getChildByName('top')?.getValue() ?? 0
        }, ${rectNode.getChildByName('right')?.getValue() ?? 0}, ${
          rectNode.getChildByName('bottom')?.getValue() ?? 0
        })`;
      });
    return res + ')';
  }
}
/**
 * Formats a region, which is a collection of rectangles, into a string.
 * This formatter iterates through the 'rect' children of the node and
 * displays each rectangle's bounds.
 */
export const REGION_FORMATTER = new RegionFormatter();

class SizeFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    return `${node.getChildByName('w')?.getValue() ?? 0} x ${
      node.getChildByName('h')?.getValue() ?? 0
    }`;
  }
}
/**
 * Formats size properties (w, h) into a concise "width x height" string.
 * This formatter is useful for displaying dimensions in a readable format
 * within the Winscope UI.
 */
export const SIZE_FORMATTER = new SizeFormatter();

class TimestampNodeFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    const timestamp = node.getValue();
    if (timestamp instanceof Timestamp || timestamp instanceof TimeDuration) {
      return timestamp.format();
    }
    return 'null';
  }
}
/**
 * Formats a timestamp or time duration node.
 * It uses the `format()` method of `Timestamp` or `TimeDuration` objects
 * to provide a human-readable representation.
 */
export const TIMESTAMP_NODE_FORMATTER = new TimestampNodeFormatter();

class TransformFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    const type = node.getChildByName('type');
    return type !== undefined ? getTypeFlags(type.getValue() ?? 0) : 'null';
  }
}
/**
 * Formats a transform type by converting its numeric value to a string
 * representing the transform flags. This is useful for understanding
 * the nature of a transformation.
 */
export const TRANSFORM_FORMATTER = new TransformFormatter();

class UpperCaseFormatter implements PropertyFormatter {
  format(node: PropertyTreeNode): string {
    return node.getValue()?.toString().toUpperCase() ?? '';
  }
}
/**
 * Formats a property tree node's value by converting it to an upper-case string.
 * This is useful for displaying string values in a consistent upper-case format
 * within the Winscope UI, for example, when presenting enum names or status strings.
 */
export const UPPER_CASE_FORMATTER = new UpperCaseFormatter();

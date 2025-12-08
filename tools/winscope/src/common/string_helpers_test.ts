/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {
  convertSnakeToCamelCase,
  isAlpha,
  isBlank,
  isDigit,
  isNumeric,
  parseBigIntStrippingUnit,
} from './string_helpers';

describe('StringUtils', () => {
  it('parses bigint', () => {
    expect(parseBigIntStrippingUnit('-10')).toEqual(-10n);
    expect(parseBigIntStrippingUnit('-10 unit')).toEqual(-10n);
    expect(parseBigIntStrippingUnit('-10unit')).toEqual(-10n);
    expect(parseBigIntStrippingUnit(' -10 unit ')).toEqual(-10n);

    expect(parseBigIntStrippingUnit('0')).toBe(0n);
    expect(parseBigIntStrippingUnit('0 unit')).toBe(0n);
    expect(parseBigIntStrippingUnit('0unit')).toBe(0n);
    expect(parseBigIntStrippingUnit(' 0 unit ')).toBe(0n);

    expect(parseBigIntStrippingUnit('10')).toBe(10n);
    expect(parseBigIntStrippingUnit('10 unit')).toBe(10n);
    expect(parseBigIntStrippingUnit('10unit')).toBe(10n);
    expect(parseBigIntStrippingUnit(' 10 unit ')).toBe(10n);

    expect(() => parseBigIntStrippingUnit('invalid')).toThrow();
    expect(() => parseBigIntStrippingUnit('invalid 10 unit')).toThrow();
  });

  it('convertSnakeToCamelCase()', () => {
    expect(convertSnakeToCamelCase('_aaa')).toBe('_aaa');
    expect(convertSnakeToCamelCase('aaa')).toBe('aaa');

    expect(convertSnakeToCamelCase('aaa_bbb')).toBe('aaaBbb');
    expect(convertSnakeToCamelCase('_aaa_bbb')).toBe('_aaaBbb');

    expect(convertSnakeToCamelCase('aaa_bbb_ccc')).toBe('aaaBbbCcc');
    expect(convertSnakeToCamelCase('_aaa_bbb_ccc')).toBe('_aaaBbbCcc');

    expect(convertSnakeToCamelCase('_field_32')).toBe('_field_32');
    expect(convertSnakeToCamelCase('field_32')).toBe('field_32');
    expect(convertSnakeToCamelCase('field_32_bits')).toBe('field_32Bits');
    expect(convertSnakeToCamelCase('field_32_bits_lsb')).toEqual(
      'field_32BitsLsb',
    );
    expect(convertSnakeToCamelCase('field_32bits')).toBe('field_32bits');
    expect(convertSnakeToCamelCase('field_32bits_lsb')).toEqual(
      'field_32bitsLsb',
    );

    expect(convertSnakeToCamelCase('_aaa_aaa.bbb_bbb')).toEqual(
      '_aaaAaa.bbbBbb',
    );
    expect(convertSnakeToCamelCase('aaa_aaa.bbb_bbb')).toBe('aaaAaa.bbbBbb');
    expect(convertSnakeToCamelCase('aaa_aaa.field_32bits_lsb.bbb_bbb')).toEqual(
      'aaaAaa.field_32bitsLsb.bbbBbb',
    );
  });

  it('isAlpha()', () => {
    expect(isAlpha('a')).toBeTrue();
    expect(isAlpha('A')).toBeTrue();
    expect(isAlpha('_')).toBeFalse();
    expect(isAlpha('0')).toBeFalse();
    expect(isAlpha('9')).toBeFalse();
  });

  it('isDigit()', () => {
    expect(isDigit('a')).toBeFalse();
    expect(isDigit('A')).toBeFalse();
    expect(isDigit('_')).toBeFalse();
    expect(isDigit('0')).toBeTrue();
    expect(isDigit('9')).toBeTrue();
  });

  it('isBlank()', () => {
    expect(isBlank('')).toBeTrue();
    expect(isBlank(' ')).toBeTrue();
    expect(isBlank('  ')).toBeTrue();
    expect(isBlank(' a')).toBeFalse();
    expect(isBlank('a ')).toBeFalse();
    expect(isBlank(' a ')).toBeFalse();
    expect(isBlank('a  a')).toBeFalse();
  });

  it('isNumeric()', () => {
    expect(isNumeric('0')).toBeTrue();
    expect(isNumeric('1')).toBeTrue();
    expect(isNumeric('0.1')).toBeTrue();
    expect(isNumeric('')).toBeFalse();
    expect(isNumeric('a')).toBeFalse();
    expect(isNumeric('4n')).toBeFalse();
  });
});

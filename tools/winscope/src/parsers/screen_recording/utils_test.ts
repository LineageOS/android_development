/*
 * Copyright (C) 2022 The Android Open Source Project
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

import {toIntLittleEndian, toUintLittleEndian} from './utils';

describe('utils_test', () => {
  it('toUintLittleEndian', () => {
    expect(toUintLittleEndian(new Uint8Array([0xff, 0xff]), 0, -1)).toBe(0n);
    expect(toUintLittleEndian(new Uint8Array([0xff, 0xff]), 0, 0)).toBe(0n);
    expect(toUintLittleEndian(new Uint8Array([0xff, 0xff]), 1, 1)).toBe(0n);

    expect(toUintLittleEndian(new Uint8Array([0x00, 0x01, 0xff]), 0, 1)).toBe(
      0n,
    );
    expect(toUintLittleEndian(new Uint8Array([0x00, 0x01, 0xff]), 1, 2)).toBe(
      1n,
    );
    expect(toUintLittleEndian(new Uint8Array([0x00, 0x01, 0xff]), 2, 3)).toBe(
      255n,
    );

    expect(toUintLittleEndian(new Uint8Array([0x00, 0x00]), 0, 2)).toBe(0n);
    expect(toUintLittleEndian(new Uint8Array([0x01, 0x00]), 0, 2)).toBe(1n);
    expect(toUintLittleEndian(new Uint8Array([0x00, 0x01]), 0, 2)).toBe(256n);
    expect(toUintLittleEndian(new Uint8Array([0xff, 0xff]), 0, 2)).toEqual(
      0xffffn,
    );

    expect(
      toUintLittleEndian(new Uint8Array([0xff, 0xff, 0xff, 0xff]), 0, 4),
    ).toBe(0xffffffffn);

    expect(
      toUintLittleEndian(
        new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
        0,
        8,
      ),
    ).toBe(0xffffffffffffffffn);

    expect(
      toUintLittleEndian(
        new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
        0,
        9,
      ),
    ).toBe(0xffffffffffffffffffn);
  });

  it('toIntLittleEndian', () => {
    expect(toIntLittleEndian(new Uint8Array([0xff]), 0, -1)).toBe(0n);
    expect(toIntLittleEndian(new Uint8Array([0xff]), 0, 0)).toBe(0n);

    expect(toIntLittleEndian(new Uint8Array([0x00]), 0, 1)).toBe(0n);
    expect(toIntLittleEndian(new Uint8Array([0x01]), 0, 1)).toBe(1n);
    expect(toIntLittleEndian(new Uint8Array([0x7f]), 0, 1)).toBe(127n);
    expect(toIntLittleEndian(new Uint8Array([0x80]), 0, 1)).toBe(-128n);
    expect(toIntLittleEndian(new Uint8Array([0xff]), 0, 1)).toBe(-1n);

    expect(toIntLittleEndian(new Uint8Array([0xff, 0x7f]), 0, 2)).toBe(32767n);
    expect(toIntLittleEndian(new Uint8Array([0x00, 0x80]), 0, 2)).toBe(-32768n);
    expect(toIntLittleEndian(new Uint8Array([0x01, 0x80]), 0, 2)).toBe(-32767n);
    expect(toIntLittleEndian(new Uint8Array([0xff, 0xff]), 0, 2)).toBe(-1n);

    expect(
      toIntLittleEndian(new Uint8Array([0xff, 0xff, 0xff, 0x7f]), 0, 4),
    ).toBe(0x7fffffffn);
    expect(
      toIntLittleEndian(new Uint8Array([0x00, 0x00, 0x00, 0x80]), 0, 4),
    ).toBe(-0x80000000n);
    expect(
      toIntLittleEndian(new Uint8Array([0x01, 0x00, 0x00, 0x80]), 0, 4),
    ).toBe(-0x7fffffffn);
    expect(
      toIntLittleEndian(new Uint8Array([0xff, 0xff, 0xff, 0xff]), 0, 4),
    ).toBe(-1n);

    expect(
      toIntLittleEndian(
        new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]),
        0,
        8,
      ),
    ).toBe(0x7fffffffffffffffn);
    expect(
      toIntLittleEndian(
        new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80]),
        0,
        8,
      ),
    ).toBe(-0x8000000000000000n);
    expect(
      toIntLittleEndian(
        new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80]),
        0,
        8,
      ),
    ).toBe(-0x7fffffffffffffffn);
    expect(
      toIntLittleEndian(
        new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
        0,
        8,
      ),
    ).toBe(-1n);

    expect(
      toIntLittleEndian(
        new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x7f]),
        0,
        9,
      ),
    ).toBe(0x7fffffffffffffffffn);
    expect(
      toIntLittleEndian(
        new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80]),
        0,
        9,
      ),
    ).toBe(-0x800000000000000000n);
    expect(
      toIntLittleEndian(
        new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80]),
        0,
        9,
      ),
    ).toBe(-0x7fffffffffffffffffn);
    expect(
      toIntLittleEndian(
        new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
        0,
        9,
      ),
    ).toBe(-1n);
  });
});

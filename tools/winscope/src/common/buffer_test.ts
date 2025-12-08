/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {ArrayBufferBuilder, ResizableBuffer} from './buffer';

describe('ResizableBuffer', () => {
  it('is initially empty', () => {
    const buffer = new ResizableBuffer();
    expect(buffer.get().length).toBe(0);
  });

  it('appends data correctly', () => {
    const buffer = new ResizableBuffer();
    const data = new Uint8Array([1, 2, 3]);
    buffer.append(data);
    expect(buffer.get()).toEqual(data);
  });

  it('appends data multiple times', () => {
    const buffer = new ResizableBuffer();
    buffer.append(new Uint8Array([1, 2]));
    buffer.append(new Uint8Array([3, 4, 5]));
    expect(buffer.get()).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it('resizes when capacity is exceeded', () => {
    const buffer = new ResizableBuffer();
    const data = new Uint8Array(200);
    for (let i = 0; i < data.length; i++) {
      data[i] = i;
    }
    buffer.append(data);
    expect(buffer.get()).toEqual(data);
  });
});

describe('ArrayBufferBuilder', () => {
  it('builds an empty buffer', () => {
    const builder = new ArrayBufferBuilder();
    const buffer = builder.build();
    expect(buffer.byteLength).toBe(0);
  });

  it('builds a buffer with a string', () => {
    const builder = new ArrayBufferBuilder();
    builder.append(['test']);
    const buffer = builder.build();
    expect(buffer.byteLength).toBe(4);
    const view = new Uint8Array(buffer);
    // 'test' in ASCII
    expect(view).toEqual(new Uint8Array([116, 101, 115, 116]));
  });

  it('builds a buffer with a number', () => {
    const builder = new ArrayBufferBuilder();
    builder.append([42]);
    const buffer = builder.build();
    expect(buffer.byteLength).toBe(4);
    const view = new DataView(buffer);
    expect(view.getUint32(0, true)).toBe(42);
  });

  it('builds a buffer with a Uint8Array', () => {
    const builder = new ArrayBufferBuilder();
    const data = new Uint8Array([1, 2, 3, 4]);
    builder.append([data]);
    const buffer = builder.build();
    expect(buffer.byteLength).toBe(4);
    const view = new Uint8Array(buffer);
    expect(view).toEqual(data);
  });

  it('builds a buffer with mixed types', () => {
    const builder = new ArrayBufferBuilder();
    const data = new Uint8Array([5, 6]);
    builder.append(['ab', 10, data]);
    const buffer = builder.build();
    expect(buffer.byteLength).toBe(2 + 4 + 2);

    const view = new DataView(buffer);
    const textDecoder = new TextDecoder('ascii');
    expect(textDecoder.decode(buffer.slice(0, 2))).toBe('ab');
    expect(view.getUint32(2, true)).toBe(10);
    expect(new Uint8Array(buffer.slice(6))).toEqual(data);
  });
});

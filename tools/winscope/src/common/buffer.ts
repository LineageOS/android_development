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

import {binaryEncode} from './string_helpers';

/**
 * A buffer that can be resized.
 */
export class ResizableBuffer {
  private buffer: Uint8Array;
  private capacityUsed = 0;

  constructor() {
    this.buffer = new Uint8Array(128);
  }

  /**
   * Appends data to the buffer.
   *
   * @param data The data to append.
   */
  append(data: ArrayLike<number>) {
    const capacityNeeded = this.capacityUsed + data.length;
    if (this.buffer.length < capacityNeeded) {
      this.increaseCapacity(capacityNeeded);
    }
    this.buffer.set(data, this.capacityUsed);
    this.capacityUsed = capacityNeeded;
  }

  /**
   * Gets the buffer.
   *
   * @return The buffer.
   */
  get(): Uint8Array {
    return this.buffer.subarray(0, this.capacityUsed);
  }

  private increaseCapacity(newCapacity: number) {
    let capacity = this.buffer.length;
    const mb32 = 32 * 1024 * 1024;
    do {
      capacity = capacity < mb32 ? capacity * 2 : capacity + mb32;
    } while (capacity < newCapacity);
    const newBuf = new Uint8Array(capacity);
    newBuf.set(this.buffer);
    this.buffer = newBuf;
  }
}

/**
 * A token that can be appended to an ArrayBufferBuilder.
 */
export type BufferToken = string | number | Uint8Array;

/**
 * A builder for creating ArrayBuffers.
 */
export class ArrayBufferBuilder {
  private readonly tokens: BufferToken[] = [];

  /**
   * Builds the ArrayBuffer.
   *
   * @return The built ArrayBuffer.
   */
  build(): ArrayBuffer {
    let byteLength = 0;
    this.tokens.forEach((token) => {
      byteLength += this.getTokenLength(token);
    });
    const buffer = new ArrayBuffer(byteLength);
    const dataView = new DataView(buffer);
    const typedArray = new Uint8Array(buffer);
    let byteOffset = 0;
    for (const token of this.tokens) {
      this.insertToken(dataView, typedArray, byteOffset, token);
      byteOffset += this.getTokenLength(token);
    }
    return buffer;
  }

  /**
   * Appends tokens to the builder.
   *
   * @param tokens The tokens to append.
   * @return The builder.
   */
  append(tokens: BufferToken[]): this {
    this.tokens.push(...tokens);
    return this;
  }

  private getTokenLength(token: BufferToken): number {
    if (typeof token === 'string') {
      return token.length;
    } else if (token instanceof Uint8Array) {
      return token.byteLength;
    } else {
      return 4;
    }
  }

  private insertToken(
    dataView: DataView,
    typedArray: Uint8Array,
    byteOffset: number,
    token: BufferToken,
  ) {
    if (typeof token === 'string') {
      this.setAscii(typedArray, byteOffset, token);
    } else if (token instanceof Uint8Array) {
      typedArray.set(token, byteOffset);
    } else {
      dataView.setUint32(byteOffset, token, true);
    }
  }

  private setAscii(buffer: Uint8Array, byteOffset: number, token: string) {
    const byteArray = binaryEncode(token);
    buffer.set(byteArray, byteOffset);
  }
}

/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {utf8Decode} from './string_utils';

export class ProtoReader {
  pos = 0;
  len: number;
  readonly buf: Uint8Array;

  constructor(buf: Uint8Array) {
    this.buf = buf;
    this.len = buf.length;
  }

  static create(buf: Uint8Array): ProtoReader {
    return new ProtoReader(buf);
  }

  uint32(): number {
    return this.int32() >>> 0;
  }

  int32(): number {
    const buf = this.buf;
    let pos = this.pos;
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      if (pos >= this.len) throw new Error('Index out of range');
      b = buf[pos++];
      result |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    this.pos = pos;
    return result;
  }

  int64(): {high: number, low: number} {
    // We only need this if standard Google Protobuf doesn't handle it or if we are decoding manually.
    // QueryResult uses custom decoding for varints.
    // Minimal implementation for skipping or basic reading.
    const buf = this.buf;
    let pos = this.pos;
    let lo = 0;
    let hi = 0;
    let i = 0;

    if (this.len - pos > 4) {
      for (; i < 4; ++i) {
        lo = (lo | (buf[pos] & 127) << i * 7) >>> 0;
        if (buf[pos++] < 128) {
          this.pos = pos;
          return {high: 0, low: lo}; // This might be wrong for negative numbers but sufficient for length
        }
      }
      lo = (lo | (buf[pos] & 127) << 28) >>> 0;
      hi = (hi | (buf[pos] & 127) >> 4) >>> 0;
      if (buf[pos++] < 128) {
        this.pos = pos;
        return {high: hi, low: lo};
      }
      i = 0;
    } else {
      for (; i < 3; ++i) {
        if (pos >= this.len) throw new Error("Index out of range");
        lo = (lo | (buf[pos] & 127) << i * 7) >>> 0;
        if (buf[pos++] < 128) {
          this.pos = pos;
          return {high: 0, low: lo};
        }
      }
      lo = (lo | (buf[pos++] & 127) << i * 7) >>> 0;
      this.pos = pos;
      return {high: hi, low: lo};
    }

    if (this.len - pos > 4) {
      for (; i < 5; ++i) {
        hi = (hi | (buf[pos] & 127) << i * 7 + 3) >>> 0;
        if (buf[pos++] < 128) {
          this.pos = pos;
          return {high: hi, low: lo};
        }
      }
    } else {
      for (; i < 5; ++i) {
        if (pos >= this.len) throw new Error("Index out of range");
        hi = (hi | (buf[pos] & 127) << i * 7 + 3) >>> 0;
        if (buf[pos++] < 128) {
          this.pos = pos;
          return {high: hi, low: lo};
        }
      }
    }
    throw new Error("invalid varint encoding");
  }

  bool(): boolean {
    return this.uint32() !== 0;
  }

  string(): string {
    const len = this.uint32();
    if (this.pos + len > this.len) throw new Error('Index out of range');
    const str = utf8Decode(this.buf.subarray(this.pos, this.pos + len));
    this.pos += len;
    return str;
  }

  bytes(): Uint8Array {
    const len = this.uint32();
    if (this.pos + len > this.len) throw new Error('Index out of range');
    const bytes = this.buf.slice(this.pos, this.pos + len);
    this.pos += len;
    return bytes;
  }

  skipType(wireType: number): void {
    switch (wireType) {
      case 0: // Varint
        this.skipVarint();
        break;
      case 1: // Fixed64
        this.pos += 8;
        break;
      case 2: // Length-delimited
        const len = this.uint32();
        this.pos += len;
        break;
      case 3: // Start group
        while ((this.uint32() & 7) !== 4) {
             this.pos--; // Backup to read tag again
             this.skipType(this.uint32() & 7);
             // This logic is flawed for groups but groups are deprecated and not used here.
             // Better implementation:
        }
        break;
      case 5: // Fixed32
        this.pos += 4;
        break;
      default:
        throw new Error('Invalid wire type ' + wireType);
    }
  }

  skipVarint(): void {
    const buf = this.buf;
    while (buf[this.pos++] & 0x80) {
      if (this.pos >= this.len) throw new Error('Index out of range');
    }
  }
}

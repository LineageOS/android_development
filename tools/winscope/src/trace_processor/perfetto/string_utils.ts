// Copyright (C) 2019 The Android Open Source Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.



// TextDecoder/Decoder requires the full DOM and isn't available in all types
// of tests. Use fallback implementation if needed.
let Utf8Decoder: {decode: (buf: Uint8Array) => string};
let Utf8Encoder: {encode: (str: string) => Uint8Array};

if (typeof TextDecoder !== 'undefined' && typeof TextEncoder !== 'undefined') {
  Utf8Decoder = new TextDecoder('utf-8');
  Utf8Encoder = new TextEncoder();
} else {
  throw new Error('TextEncoder/TextDecoder not available');
}

export function base64Encode(buffer: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  } else {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }
}

export function base64Decode(str: string): Uint8Array {
  // if the string is in base64url format, convert to base64
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  } else {
    const binary_string = atob(b64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  }
}

// encode binary array to hex string
export function hexEncode(bytes: Uint8Array): string {
  return bytes.reduce(
    (prev, cur) => prev + ('0' + cur.toString(16)).slice(-2),
    '',
  );
}

export function utf8Encode(str: string): Uint8Array {
  return Utf8Encoder.encode(str);
}

// Note: not all byte sequences can be converted to<>from UTF8. This can be
// used only with valid unicode strings, not arbitrary byte buffers.
export function utf8Decode(buffer: Uint8Array): string {
  return Utf8Decoder.decode(buffer);
}

// The binaryEncode/Decode functions below allow to encode an arbitrary binary
// buffer into a string that can be JSON-encoded. binaryEncode() applies
// UTF-16 encoding to each byte individually.
// Unlike utf8Encode/Decode, any arbitrary byte sequence can be converted into a
// valid string, and viceversa.
// This should be only used when a byte array needs to be transmitted over an
// interface that supports only JSON serialization (e.g., postmessage to a
// chrome extension).

export function binaryEncode(buf: Uint8Array): string {
  let str = '';
  for (let i = 0; i < buf.length; i++) {
    str += String.fromCharCode(buf[i]);
  }
  return str;
}

export function binaryDecode(str: string): Uint8Array {
  const buf = new Uint8Array(str.length);
  const strLen = str.length;
  for (let i = 0; i < strLen; i++) {
    buf[i] = str.charCodeAt(i);
  }
  return buf;
}

// A function used to interpolate strings into SQL query. The only replacement
// is done is that single quote replaced with two single quotes, according to
// SQLite documentation:
// https://www.sqlite.org/lang_expr.html#literal_values_constants_
//
// The purpose of this function is to use in simple comparisons, to escape
// strings used in GLOB clauses see escapeQuery function.
export function sqliteString(str: string): string {
  return `'${str.replace(/'/g, "''")}'`;
}

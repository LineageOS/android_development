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
import {assertTrue} from './assert';

/**
 * String utility functions.
 */
/**
 * Parses a bigint from a string, stripping any non-numeric characters.
 *
 * @param s The string to parse.
 * @return The parsed bigint.
 */
export function parseBigIntStrippingUnit(s: string): bigint {
  const match = s.match(/^\s*(-?\d+)\D*.*$/);
  if (!match) {
    throw new Error(`Cannot parse '${s}' as bigint`);
  }
  return BigInt(match[1]);
}

/**
 * Converts a snake_case string to camelCase.
 *
 * @param s The string to convert.
 * @return The converted string.
 */
export function convertSnakeToCamelCase(s: string): string {
  const tokens = s.split('_').filter((token) => token.length > 0);
  const tokensCapitalized = tokens.map((token) => {
    return capitalizeFirstCharIfAlpha(token);
  });

  const inputStartsWithUnderscore = s[0] === '_';
  let result = inputStartsWithUnderscore ? '_' : '';
  result += tokens[0];
  for (const token of tokensCapitalized.slice(1)) {
    if (!isAlpha(token[0])) {
      result += '_';
    }
    result += token;
  }

  return result;
}

/**
 * Checks if a character is an alphabetic character.
 *
 * @param char The character to check.
 * @return True if the character is an alphabetic character, false otherwise.
 */
export function isAlpha(char: string): boolean {
  assertTrue(char.length === 1, () => 'Input must be a single character');
  return char[0].toLowerCase() !== char[0].toUpperCase();
}

/**
 * Checks if a character is a digit.
 *
 * @param char The character to check.
 * @return True if the character is a digit, false otherwise.
 */
export function isDigit(char: string): boolean {
  assertTrue(char.length === 1, () => 'Input must be a single character');
  return char >= '0' && char <= '9';
}

/**
 * Checks if a string is blank.
 *
 * @param str The string to check.
 * @return True if the string is blank, false otherwise.
 */
export function isBlank(str: string): boolean {
  return str.replace(/\s/g, '').length === 0;
}

/**
 * Checks if a string is numeric.
 *
 * @param str The string to check.
 * @return True if the string is numeric, false otherwise.
 */
export function isNumeric(str: string): boolean {
  return Number(str).toString() === str;
}

/**
 * Encodes a string as a binary string.
 *
 * @param str The string to encode.
 * @return The encoded string.
 */
export function binaryEncode(str: string): Uint8Array {
  return Uint8Array.from(str, (c) => c.charCodeAt(0));
}

/**
 * Decodes a binary string.
 *
 * @param buf The binary string to decode.
 * @return The decoded string.
 */
export function binaryDecode(buf: Uint8Array): string {
  return String.fromCharCode(...buf);
}

/**
 * Encodes a string as UTF-8.
 *
 * @param data The string to encode.
 * @return The encoded string.
 */
export function utf8Encode(data: string): Uint8Array {
  return new TextEncoder().encode(data);
}

/**
 * Decodes a UTF-8 string.
 *
 * @param data The string to decode.
 * @return The decoded string.
 */
export function utf8Decode(data: Uint8Array): string {
  return new TextDecoder('utf-8').decode(data);
}

/**
 * Encodes a byte array as a hex string.
 *
 * @param bytes The byte array to encode.
 * @return The encoded string.
 */
export function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => ('0' + byte.toString(16)).slice(-2))
    .join('');
}

/**
 * Decodes a base64 string.
 *
 * @param str The string to decode.
 * @return The decoded byte array.
 */
export function base64Decode(str: string): Uint8Array {
  // if the string is in base64url format, convert to base64
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encodes a byte array as a base64 string.
 *
 * @param buffer The byte array to encode.
 * @return The encoded string.
 */
export function base64Encode(buffer: Uint8Array): string {
  const binaryStr = Array.from(buffer)
    .map((c) => String.fromCharCode(c))
    .join('');
  return btoa(binaryStr);
}

function capitalizeFirstCharIfAlpha(word: string): string {
  if (word.length === 0) {
    return word;
  }

  if (!isAlpha(word[0])) {
    return word;
  }
  return word[0].toUpperCase() + word.slice(1);
}

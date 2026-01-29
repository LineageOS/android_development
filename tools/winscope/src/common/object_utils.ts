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

import {assertDefined, assertTrue} from './assert';

/**
 * Represents a key in an object, which may be a simple key or an array key.
 */
class Key {
  /**
   * @param key The key name.
   * @param index The index of the key in an array, or undefined if it's not an array key.
   */
  constructor(
    public key: string,
    public index?: number,
  ) {}

  /**
   * Returns true if the key is an array key.
   */
  isArrayKey(): boolean {
    return this.index !== undefined;
  }
}

const ARRAY_KEY_REGEX = new RegExp('(.+)\\[(\\d+)\\]');

/**
 * Sets the property at the given path in the object.
 *
 * @param obj The object to set the property on.
 * @param path The path to the property, using dot notation for nested objects.
 * @param value The value to set the property to.
 */
export function setProperty(obj: object, path: string, value: unknown) {
  const keys = parseKeys(path);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: Record<string, any> = obj as Record<string, any>;

  keys.slice(0, -1).forEach((key) => {
    if (key.isArrayKey()) {
      initializePropertyArrayIfNeeded(current, key);
      current = current[key.key][assertDefined(key.index)];
    } else {
      initializePropertyIfNeeded(current, key.key);
      current = current[key.key];
    }
  });

  const lastKey = assertDefined(keys.at(-1));
  if (lastKey.isArrayKey()) {
    initializePropertyArrayIfNeeded(current, lastKey);
    current[lastKey.key][assertDefined(lastKey.index)] = value;
  } else {
    current[lastKey.key] = value;
  }
}

function parseKeys(path: string): Key[] {
  return path.split('.').map((rawKey) => {
    const match = ARRAY_KEY_REGEX.exec(rawKey);
    if (match) {
      return new Key(match[1], Number(match[2]));
    }
    return new Key(rawKey);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function initializePropertyIfNeeded(obj: Record<string, any>, key: string) {
  if (obj[key] === undefined) {
    obj[key] = {};
  }
  assertTrue(typeof obj[key] === 'object', () => 'Expected to be object');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function initializePropertyArrayIfNeeded(obj: Record<string, any>, key: Key) {
  if (obj[key.key] === undefined) {
    obj[key.key] = [];
  }
  if (obj[key.key][assertDefined(key.index)] === undefined) {
    obj[key.key][assertDefined(key.index)] = {};
  }
  assertTrue(Array.isArray(obj[key.key]), () => 'Expected to be array');
}

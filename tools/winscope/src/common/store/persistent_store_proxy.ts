/*
 * Copyright (C) 2022 The Android Open Source Project
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

import {Store} from './store';

/**
 * A proxy class that allows you to create objects that are backed by a persistent store.
 * The proxy will automatically save changes made to the object to the store.
 */
export function createPersistentStoreProxy<T extends object>(
  key: string,
  defaultState: T,
  storage: Store,
): T {
  const storedState = JSON.parse(storage.get(key) ?? '{}', parseMap);
  const currentState = mergeDeep({}, structuredClone(defaultState)) as T;
  mergeDeepKeepingStructure(currentState, storedState);
  return wrapWithPersistentStoreProxy(key, currentState, storage);
}

function wrapWithPersistentStoreProxy<T extends object>(
  storeKey: string,
  object: T,
  storage: Store,
  baseObject: object = object,
): T {
  const updatableProps: string[] = [];

  for (const [key, value] of Object.entries(object)) {
    if (
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      typeof value === 'number' ||
      value === undefined
    ) {
      if (!Array.isArray(object)) {
        updatableProps.push(key);
      }
    } else if (value !== null && typeof value === 'object') {
      (object as Record<string, unknown>)[key] = wrapWithPersistentStoreProxy(
        storeKey,
        value,
        storage,
        baseObject,
      );
    }
  }
  const proxyObj = new Proxy(object, {
    set: (target: T, prop: string | symbol, newValue: unknown): boolean => {
      if (typeof prop === 'symbol') {
        throw new Error("Can't use symbol keys only strings");
      }
      if (Array.isArray(target) && !Number.isNaN(Number(prop))) {
        target[Number(prop)] = newValue;
        storage.add(storeKey, JSON.stringify(baseObject, stringifyMap));
        return true;
      }
      if (!Array.isArray(target) && Array.isArray(newValue)) {
        (target as Record<string, unknown>)[prop] =
          wrapWithPersistentStoreProxy(storeKey, newValue, storage, baseObject);
        storage.add(storeKey, JSON.stringify(baseObject, stringifyMap));
        return true;
      }
      if (!Array.isArray(target) && updatableProps.includes(prop)) {
        (target as Record<string, unknown>)[prop] = newValue;
        storage.add(storeKey, JSON.stringify(baseObject, stringifyMap));
        return true;
      }
      throw new Error(
        `Object property '${prop.toString()}' is not updatable. Can only update leaf keys: [${updatableProps}]`,
      );
    },
  });

  return proxyObj;
}

function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Merge sources into the target keeping the structure of the target. Arrays are replaced.
 * @param target the object we mutate by merging the data from source into, but keep the object structure of
 * @param source the object we merge into target
 */
function mergeDeepKeepingStructure(target: object, source: unknown) {
  if (isObject(target) && isObject(source)) {
    for (const key of Object.keys(target)) {
      if (!(key in source)) {
        continue;
      }

      const targetValue = target[key];
      const sourceValue = source[key];

      if (isObject(targetValue) && isObject(sourceValue)) {
        mergeDeepKeepingStructure(targetValue, sourceValue);
      } else if (!isObject(targetValue) && !isObject(sourceValue)) {
        target[key] = sourceValue;
      }
    }
  }
}

function mergeDeep(target: object, ...sources: object[]): object {
  if (!sources.length) {
    return target;
  }
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key] || !isObject(target[key])) {
          target[key] = {};
        }
        mergeDeep(target[key] as object, source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  return mergeDeep(target, ...sources);
}

/**
 * Stringify a Map object to an object with type and value properties.
 * @param key the key of the Map object
 * @param value the Map object
 * @return the object with type and value properties
 */
export function stringifyMap(key: string, value: unknown) {
  if (value instanceof Map) {
    return {
      type: 'Map',
      value: [...value],
    };
  }
  return value;
}

/**
 * Parse a Map object from an object with type and value properties.
 * @param key the key of the Map object
 * @param value the object with type and value properties
 * @return the Map object
 */
export function parseMap(key: string, value: unknown) {
  if (
    isObject(value) &&
    value['type'] === 'Map' &&
    Array.isArray(value['value'])
  ) {
    return new Map(value['value']);
  }
  return value;
}

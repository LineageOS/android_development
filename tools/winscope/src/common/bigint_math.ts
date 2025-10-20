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

/**
 * Divides two bigints and rounds the result to the nearest integer.
 *
 * @param ns The numerator.
 * @param div The denominator.
 * @return The result of the division, rounded to the nearest integer.
 */
export function divideAndRound(ns: bigint, div: bigint): bigint {
  let quot = ns / div;
  if (ns % div >= div / 2n) {
    quot += 1n;
  }
  return quot;
}

/**
 * Gets the maximum value in an array of bigints.
 *
 * @param values The array of bigints.
 * @return The maximum value in the array, or undefined if the array is empty.
 */
export function getMax(values: Array<bigint>): bigint | undefined {
  let max: bigint | undefined;
  for (const value of values) {
    if (max === undefined || value > max) {
      max = value;
    }
  }
  return max;
}

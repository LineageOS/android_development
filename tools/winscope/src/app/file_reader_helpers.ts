/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {assertDefined} from '@common/assert';
import {FileReader} from '@trace_api/file_reader';

/**
 * Gets the reader with the latest real-to-boottime offset.
 *
 * @param readers The readers to search.
 * @return The reader with the latest real-to-boottime offset, or undefined if
 *     no such reader exists.
 */
export function getReaderWithLatestRealToBootTimeOffset(
  readers: FileReader[],
): FileReader | undefined {
  return readers
    .filter((reader) => reader.getRealToBootTimeOffsetNs() !== undefined)
    .sort((a, b) => {
      return Number(
        assertDefined(a.getRealToBootTimeOffsetNs()) -
          assertDefined(b.getRealToBootTimeOffsetNs()),
      );
    })
    .at(-1);
}

/**
 * Gets the reader with the latest real-to-monotonic offset.
 *
 * @param readers The readers to search.
 * @return The reader with the latest real-to-monotonic offset, or undefined if
 *     no such reader exists.
 */
export function getReaderWithLatestRealToMonotonicTimeOffset(
  readers: FileReader[],
): FileReader | undefined {
  return readers
    .filter((reader) => reader.getRealToMonotonicTimeOffsetNs() !== undefined)
    .sort((a, b) => {
      return Number(
        assertDefined(a.getRealToMonotonicTimeOffsetNs()) -
          assertDefined(b.getRealToMonotonicTimeOffsetNs()),
      );
    })
    .at(-1);
}

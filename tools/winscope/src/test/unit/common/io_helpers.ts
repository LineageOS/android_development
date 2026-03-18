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

import {FIXTURES_DIR} from '@compat/test/fixtures';

/**
 * Gets a test fixture file.
 *
 * @param srcFilename The name of the file in the fixtures directory.
 * @param dstFilename The destination filename for the created File object.
 *   Defaults to `srcFilename`.
 * @return A promise that resolves to the File object.
 */
export async function getFixtureFile(
  srcFilename: string,
  dstFilename: string = srcFilename,
): Promise<File> {
  const url = FIXTURES_DIR + srcFilename;
  const response = await fetch(url);
  expect(response.ok).toBeTrue();
  const blob = await response.blob();
  const file = new File([blob], dstFilename);
  return file;
}

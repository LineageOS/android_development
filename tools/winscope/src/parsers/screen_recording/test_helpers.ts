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

import {ThumbnailGenerator} from './thumbnail_generator';
import {Thumbnail} from 'trace/media_based/thumbnail';

// Karma webpack compilation does not function well with module workers.
// Since thumbnail generation is offloaded to a module worker, we spy on
// this for all screen recording parser tests.
export function spyOnThumbnailGenerator() {
  spyOn(ThumbnailGenerator.prototype, 'generate').and.returnValue(
    Promise.resolve(new Thumbnail(1, 10, 10, new Blob(), 10, 10)),
  );
}

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

import {waitToBeCalled} from '@common/spy_utils';

import {ThumbnailGenerator} from './thumbnail_generator';

export function spyOnThumbnailGenerator() {
  return spyOn(ThumbnailGenerator.prototype, 'generate').and.callThrough();
}

export async function waitForThumbnailGeneration(spy: jasmine.Spy) {
  await waitToBeCalled(spy);
  await spy.calls.mostRecent().returnValue;
}

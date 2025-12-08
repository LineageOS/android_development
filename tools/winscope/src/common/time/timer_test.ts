/*
 * Copyright (C) 2022 The Android Open Source Project
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

import {Timer} from './timer';

describe('timer', () => {
  it('waits for condition', async () => {
    let success = false;
    setTimeout(() => {
      success = true;
    }, 200);
    await expectAsync(new Timer(1000).wait(() => success)).toBeResolved();
  });

  it('times out waiting for condition', async () => {
    let success = false;
    const promise = new Timer(1000, 200).sleepMs().then(() => {
      success = true;
    });
    await expectAsync(new Timer(100, 50).wait(() => success)).toBeRejected();
    await promise;
  });

  it('checks condition based on interval', async () => {
    let success = false;
    const promise = new Timer(1000, 250).sleepMs().then(() => {
      success = true;
    });
    await expectAsync(new Timer(500, 500).wait(() => success)).toBeRejected();
    await promise;
  });
});

/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {browser, by, element, ElementFinder} from 'protractor';

import {checkFinalRealTimestamp, checkInitialRealTimestamp, checkScrollPresent, checkTimelineTraceSelector, checkTotalScrollEntries, checkWinscopeRealTimestamp, loadTraceAndCheckViewer, setTimeouts, WINSCOPE_URL,} from './helpers';

describe('Viewer Jank CUJs', () => {
  const viewerSelector = 'viewer-jank-cujs';
  const totalEntries = 3;

  beforeEach(async () => {
    await setTimeouts(1000);
    await browser.get(WINSCOPE_URL);
  });

  it('processes trace and navigates correctly', async () => {
    await loadTraceAndCheckViewer(
      'traces/perfetto/cujs.perfetto-trace',
      'Jank CUJs',
      viewerSelector,
    );
    await checkScrollPresent(viewerSelector);
    await checkTotalScrollEntries(viewerSelector, totalEntries);
    await checkTimelineTraceSelector({
      icon: 'label',
      color: 'rgba(255, 99, 184, 1)',
    });
    await checkFinalRealTimestamp('2025-08-07, 15:36:02.770');
    await checkInitialRealTimestamp('2025-08-07, 15:36:01.364');
    const entry = element(
      by.css(`${viewerSelector} .scroll .entry[item-id="0"]`),
    );
    await checkFirstEntry(entry);

    await entry.element(by.css('.end-time .time-button')).click();
    await checkWinscopeRealTimestamp('15:36:01.879');
    await entry.element(by.css('.start-time button')).click();
    await checkWinscopeRealTimestamp('15:36:01.364');
  });

  async function checkFirstEntry(entry: ElementFinder) {
    expect(await entry.isPresent()).toBeTruthy();

    const type = entry.element(by.css('.jank-cuj-type'));
    expect(await type.getText()).toBe('LAUNCHER_APP_LAUNCH_FROM_ICON');

    const start = entry.element(by.css('.start-time'));
    expect(await start.getText()).toBe('15:36:01.364');

    const end = entry.element(by.css('.end-time'));
    expect(await end.getText()).toBe('15:36:01.879');

    const duration = entry.element(by.css('.duration'));
    expect(await duration.getText()).toBe('515 ms');

    const status = entry.element(by.css('.status'));
    expect(await status.getText()).toBe('EXECUTED\ncheck');
  }
});

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
import {browser, by, element, ElementFinder} from 'protractor';
import {
  changeRealTimestampInWinscope,
  checkFinalRealTimestamp,
  checkInitialRealTimestamp,
  checkItemInPropertiesTreeByIndex,
  checkSelectFilter,
  checkWinscopeRealTimestamp,
  loadTraceAndCheckViewer,
  setTimeouts,
  WINSCOPE_URL,
} from './helpers';

describe('Viewer Transitions', () => {
  const viewerSelector = 'viewer-transitions';
  const totalEntries = 4;

  beforeEach(async () => {
    await setTimeouts(1000);
    await browser.get(WINSCOPE_URL);
  });

  it('processes trace and navigates correctly', async () => {
    await loadTraceAndCheckViewer(
      'traces/perfetto/shell_transitions_trace.perfetto-trace',
      'Transitions',
      viewerSelector,
    );

    await checkFinalRealTimestamp('2023-11-21, 13:30:33.279');
    await checkInitialRealTimestamp('2023-11-21, 13:30:25.448');

    await changeRealTimestampInWinscope('2023-11-21, 13:30:26.522');
    await checkCurrentEntry();
    await checkSelectedEntry();

    let entry = getEntryForTimeButtonChecks();
    await entry.element(by.css('.send-time .time-button')).click();
    await checkWinscopeRealTimestamp('13:30:26.515');
    entry = getEntryForTimeButtonChecks();
    await entry.element(by.css('.dispatch-time button')).click();
    await checkWinscopeRealTimestamp('13:30:26.522');

    await checkFilter('.transition-type', ['TO_FRONT'], 1);
    await checkFilter(
      '.handler',
      ['com.android.wm.shell.transition.DefaultMixedHandler'],
      2,
    );
    await checkFilter('.participants', ['398', '472'], 3);
    await checkFilter('.flags', ['0x0'], 3);
    await checkFilter('.status', ['MERGED'], 1);
  });

  function getEntryForTimeButtonChecks() {
    return element(by.css(`${viewerSelector} .scroll .entry[item-id="1"]`));
  }

  async function checkCurrentEntry() {
    const current = element(by.css(`${viewerSelector} .scroll .current`));
    await checkEntryColumns(current, [
      '33',
      'TO_FRONT',
      '13:30:26.515',
      '13:30:26.522',
      '2,561 ms',
      'com.android.wm.shell.recents.RecentsTransitionHandler',
      'Layers: 47, 398, 67\nWindows: 0x97b5518, 0xb887160, 0xa884527',
      'TRANSIT_FLAG_IS_RECENTS',
      'PLAYED\ncheck',
    ]);
    await checkProperty(4, 'finishTransactionId:\n5811090758257');
    await checkProperty(12, 'flags:\nFLAG_MOVED_TO_TOP | FLAG_SHOW_WALLPAPER');
  }

  async function checkSelectedEntry() {
    const last = element.all(by.css(`${viewerSelector} .scroll .entry`)).last();
    await last.click();
    const selected = element(by.css(`${viewerSelector} .scroll .selected`));
    await checkEntryColumns(selected, [
      '35',
      'OPEN',
      '13:30:33.279',
      'N/A',
      'N/A',
      'N/A',
      'Layers: 489, 472\nWindows: 0x5ba3da0, 0xc5f6ee4',
      '0x0',
      'MERGED\nmerge',
    ]);
    await checkProperty(8, 'startTransactionId:\n5811090759955');
    await checkProperty(14, 'windowId:\n0x5ba3da0');
  }

  async function checkEntryColumns(entry: ElementFinder, columns: string[]) {
    expect(await entry.isPresent()).toBeTruthy();

    const id = entry.element(by.css('.transition-id'));
    expect(await id.getText()).toBe(columns[0]);

    const type = entry.element(by.css('.transition-type'));
    expect(await type.getText()).toBe(columns[1]);

    const sendTime = entry.element(by.css('.send-time'));
    expect(await sendTime.getText()).toBe(columns[2]);

    const dispatchTime = entry.element(by.css('.dispatch-time'));
    expect(await dispatchTime.getText()).toBe(columns[3]);

    const duration = entry.element(by.css('.duration'));
    expect(await duration.getText()).toBe(columns[4]);

    const handler = entry.element(by.css('.handler'));
    expect(await handler.getText()).toBe(columns[5]);

    const participants = entry.element(by.css('.participants'));
    expect(await participants.getText()).toBe(columns[6]);

    const flags = entry.element(by.css('.flags'));
    expect(await flags.getText()).toBe(columns[7]);

    const status = entry.element(by.css('.status'));
    expect(await status.getText()).toBe(columns[8]);
  }

  async function checkProperty(index: number, prop: string) {
    await checkItemInPropertiesTreeByIndex(
      `${viewerSelector} .properties-view`,
      index,
      prop,
    );
  }

  async function checkFilter(
    filter: string,
    options: string[],
    expected: number,
  ) {
    await checkSelectFilter(
      viewerSelector,
      filter,
      options,
      expected,
      totalEntries,
      false,
    );
  }
});

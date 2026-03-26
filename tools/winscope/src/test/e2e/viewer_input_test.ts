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

import {checkFinalRealTimestamp, checkInitialRealTimestamp, checkItemInPropertiesTreeByIndex, checkItemInPropertiesTreeByName, checkSelectFilter, checkTimelineTraceSelector, loadTraceAndCheckViewer, setTimeouts, WINSCOPE_URL,} from './helpers';

describe('Viewer Input', () => {
  const viewerSelector = 'viewer-input';
  const totalEntries = 8;

  beforeEach(async () => {
    await setTimeouts(1000);
    await browser.get(WINSCOPE_URL);
  });

  it('processes trace and navigates correctly', async () => {
    await loadTrace('traces/perfetto/input-events.perfetto-trace');
    await checkFinalRealTimestamp('2024-06-14, 13:41:45.123');
    await checkInitialRealTimestamp('2024-06-14, 13:41:43.800');
    await checkCurrentEntry();
    await checkSelectedEntry();

    await checkFilter('.input-type', ['KEY'], 2);
    await checkFilter('.input-source', ['TOUCHSCREEN'], 6);
    await checkFilter('.input-action', ['UP', 'OUTSIDE'], 3);
    await checkFilter('.input-device-id', ['4'], 6);
    await checkFilter('.input-display-id', ['-1'], 2);
    await checkFilter('.input-windows', ['212'], 7);
  });

  it('processes trace with only key events', async () => {
    await loadTrace('traces/perfetto/input-key-events.perfetto-trace');
    await checkFinalRealTimestamp('2024-06-14, 13:41:45.123');
    await checkInitialRealTimestamp('2024-06-14, 13:41:45.115');
    const entryTypes = getEntryTypes();
    expect(await entryTypes).toEqual(['KEY', 'KEY']);
  });

  it('processes trace with only motion events', async () => {
    await loadTrace('traces/perfetto/input-motion-events.perfetto-trace');
    await checkFinalRealTimestamp('2024-06-14, 13:41:43.842');
    await checkInitialRealTimestamp('2024-06-14, 13:41:43.800');
    const entryTypes = getEntryTypes();
    expect(await entryTypes).toEqual(Array.from({length: 6}, () => 'MOTION'));
  });

  async function checkCurrentEntry() {
    const current = element(by.css(`${viewerSelector} .scroll .current`));
    await checkEntryColumns(current, [
      'MOTION',
      'TOUCHSCREEN',
      'DOWN',
      '4',
      '0',
      '[\n212\n,\n64\n,\n82\n,\n75\n]',
    ]);
    await checkItemInPropertiesTreeByName(
      viewerSelector,
      'classification',
      'classification:\nCLASSIFICATION_NONE',
      '.event-properties',
    );
    await checkItemInPropertiesTreeByName(
      viewerSelector,
      'metaState',
      'metaState:\n0x0',
      '.event-properties',
    );
    await checkItemInPropertiesTreeByIndex(
      viewerSelector,
      3,
      '0 - Pointer:\nID: 0, XY: (1936.00, 431.00), RawXY: (1936.00, 431.00)',
      '.dispatch-properties',
    );
  }

  async function checkSelectedEntry() {
    const last = element.all(by.css(`${viewerSelector} .scroll .entry`)).last();
    await last.click();
    const selected = element(by.css(`${viewerSelector} .scroll .selected`));
    await checkEntryColumns(selected, [
      'KEY',
      'KEYBOARD',
      'UP',
      '2',
      '-1',
      'Keycode: VOLUME_UP [\n212\n]',
    ]);
    await checkItemInPropertiesTreeByName(
      viewerSelector,
      'flags',
      'flags:\nFLAG_FROM_SYSTEM',
      '.event-properties',
    );
    await checkItemInPropertiesTreeByIndex(
      viewerSelector,
      2,
      'resolvedFlags:\n8',
      '.dispatch-properties',
    );
  }

  async function checkEntryColumns(entry: ElementFinder, columns: string[]) {
    expect(await entry.isPresent()).toBeTruthy();

    const type = entry.element(by.css('.input-type'));
    expect(await type.getText()).toBe(columns[0]);

    const source = entry.element(by.css('.input-source'));
    expect(await source.getText()).toBe(columns[1]);

    const action = entry.element(by.css('.input-action'));
    expect(await action.getText()).toBe(columns[2]);

    const device = entry.element(by.css('.input-device-id'));
    expect(await device.getText()).toBe(columns[3]);

    const display = entry.element(by.css('.input-display-id'));
    expect(await display.getText()).toBe(columns[4]);

    const windows = entry.element(by.css('.input-details'));
    expect(await windows.getText()).toBe(columns[5]);
  }

  async function loadTrace(path: string) {
    await loadTraceAndCheckViewer(path, 'Input', viewerSelector, false);
    await checkTimelineTraceSelector({
      icon: 'touch_app',
      color: 'rgba(139, 174, 244, 1)',
    });
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

  function getEntryTypes() {
    return element
      .all(by.css(`${viewerSelector} .scroll .entry .input-type`))
      .map((e) => e?.getText());
  }
});

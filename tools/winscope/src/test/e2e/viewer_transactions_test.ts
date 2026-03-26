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

import {browser, by, element} from 'protractor';

import {changeRealTimestampInWinscope, checkFinalRealTimestamp, checkInitialRealTimestamp, checkItemInPropertiesTreeByName, checkScrollPresent, checkSelectFilter, checkTimelineTraceSelector, checkTotalScrollEntries, checkWinscopeRealTimestamp, loadTraceAndCheckViewer, setTimeouts, WINSCOPE_URL,} from './helpers';

describe('Viewer Transactions', () => {
  const viewerSelector = 'viewer-transactions';
  const totalEntries = 9534;

  beforeEach(async () => {
    await setTimeouts(2000);
    await browser.get(WINSCOPE_URL);
  });

  it('processes trace from zip and navigates correctly', async () => {
    await loadTraceAndCheckViewer(
      'archives/deployment_full_trace_phone_perfetto.zip',
      'Transactions',
      viewerSelector,
    );
    await checkScrollPresent(viewerSelector);
    await checkTotalScrollEntries(viewerSelector, totalEntries, true);
    await checkTimelineTraceSelector({
      icon: 'show_chart',
      color: 'rgba(13, 101, 45, 1)',
    });
    await checkFinalRealTimestamp('2022-11-21, 18:05:19.592');
    await checkInitialRealTimestamp('2022-11-21, 11:36:19.513');

    await changeRealTimestampInWinscope('2022-11-21, 18:05:17.505');
    await checkWinscopeRealTimestamp('18:05:17.505');
    await checkCurrentEntry();
    await checkSelectFilter(
      viewerSelector,
      '.pid',
      ['6914'],
      2,
      totalEntries,
      true,
    );
    await checkSelectFilter(
      viewerSelector,
      '.uid',
      ['10161'],
      16,
      totalEntries,
      true,
    );
    await checkSelectFilter(
      viewerSelector,
      '.flags',
      ['eBackgroundBlurRadiusChanged'],
      10,
      totalEntries,
      true,
    );
  });

  async function checkCurrentEntry() {
    const currentEntry = element(by.css(`${viewerSelector} .scroll .current`));
    expect(await currentEntry.isPresent()).toBeTruthy();

    const transactionId = currentEntry.element(by.css('.transaction-id'));
    expect(await transactionId.getText()).toBe('7975754272149');

    const vsyncId = currentEntry.element(by.css('.vsyncid'));
    expect(await vsyncId.getText()).toBe('93389');

    const pid = currentEntry.element(by.css('.pid'));
    expect(await pid.getText()).toBe('1857');

    const uid = currentEntry.element(by.css('.uid'));
    expect(await uid.getText()).toBe('1000');

    const type = currentEntry.element(by.css('.transaction-type'));
    expect(await type.getText()).toBe('LAYER_CHANGED');

    const layerOrDisplayId = currentEntry.element(
      by.css('.layer-or-display-id'),
    );
    expect(await layerOrDisplayId.getText()).toBe('798');

    const whatString =
      'eLayerChanged | eAlphaChanged | eFlagsChanged | eReparent | eColorChanged | eHasListenerCallbacksChanged';
    const what = currentEntry.element(by.css('.flags'));
    expect(await what.getText()).toEqual(whatString);

    await checkItemInPropertiesTreeByName(
      viewerSelector,
      'what',
      'what:\n' + whatString,
      undefined,
      false,
    );
    await checkItemInPropertiesTreeByName(
      viewerSelector,
      'color',
      'color:\n(0.106, 0.106, 0.106)',
      undefined,
      false,
    );
  }
});

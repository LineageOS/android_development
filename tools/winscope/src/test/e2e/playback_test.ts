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

import {browser, by, element, ExpectedConditions} from 'protractor';

import {areMessagesEmitted, changeRealTimestampInWinscope, getWinscopeRealTimestamp, loadTraceAndCheckViewer, setTimeouts, WINSCOPE_URL,} from './helpers';

describe('Playback', () => {
  beforeEach(async () => {
    await setTimeouts(1000);
    await browser.get(WINSCOPE_URL);
  });

  it('starts and pauses playback - forwards', async () => {
    await loadTraces();
    const initialTimestamp = await getWinscopeRealTimestamp();
    const initialRootNodeText = await getRootNodeText();

    await checkPlaybackRunsCorrectly('#start-playback-button');

    const currTimestamp = await getWinscopeRealTimestamp();
    compareRenderedTimestamps(currTimestamp, initialTimestamp);
    const currRootNodeText = await getRootNodeText();
    compareRenderedTimestamps(currRootNodeText, initialRootNodeText);

    await checkPlaybackHasStopped(currTimestamp, currRootNodeText);
  });

  it('starts and pauses playback - backwards', async () => {
    await loadTraces();
    await changeRealTimestampInWinscope('2022-11-21, 18:05:14.993');
    const initialTimestamp = await getWinscopeRealTimestamp();
    const initialRootNodeText = await getRootNodeText();

    await checkPlaybackRunsCorrectly('#start-reverse-playback-button');

    const currTimestamp = await getWinscopeRealTimestamp();
    compareRenderedTimestamps(initialTimestamp, currTimestamp);
    const currRootNodeText = await getRootNodeText();
    compareRenderedTimestamps(initialRootNodeText, currRootNodeText);

    await checkPlaybackHasStopped(currTimestamp, currRootNodeText);
  });

  async function loadTraces() {
    await loadTraceAndCheckViewer(
      'archives/deployment_full_trace_phone_perfetto.zip',
      'Surface Flinger',
      'viewer-surface-flinger',
    );
  }

  async function getRootNodeText(): Promise<string> {
    return await element(by.css('tree-node#noderoot')).getText();
  }

  async function checkPlaybackRunsCorrectly(startButtonCss: string) {
    await element(by.css(startButtonCss)).click();

    const timelineDisabledMsg = element(by.css('timeline .disabled-message'));
    expect(await timelineDisabledMsg.getText()).toEqual(
      'UI disabled due to playback initialization',
    );

    await browser.wait(
      ExpectedConditions.not(
        ExpectedConditions.presenceOf(timelineDisabledMsg),
      ),
      5000,
      'Playback failed to start',
    );
    expect(await timelineDisabledMsg.isPresent()).toBeFalsy();
    const propertiesDisabledMsg = element(by.css('.disabled-message'));
    expect(await propertiesDisabledMsg.isPresent()).toBeTruthy();
    expect(await propertiesDisabledMsg.getText()).toEqual(
      'Properties disabled due to playback',
    );

    await browser.sleep(1000);
    await element(by.css('#pause-playback-button')).click();
    expect(await propertiesDisabledMsg.isPresent()).toBeFalsy();
  }

  async function checkPlaybackHasStopped(
    currTimestamp: string | undefined,
    currRootNodeText: string,
  ) {
    await browser.sleep(1000);
    expect(await getWinscopeRealTimestamp()).toEqual(currTimestamp);
    expect(await getRootNodeText()).toEqual(currRootNodeText);
    expect(await areMessagesEmitted(1000)).toBeFalsy();
  }

  function compareRenderedTimestamps(
    later: string | undefined,
    earlier: string | undefined,
  ) {
    expect(
      later !== undefined && earlier !== undefined && later > earlier,
    ).toBeTruthy();
  }
});

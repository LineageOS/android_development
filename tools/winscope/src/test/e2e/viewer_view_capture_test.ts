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

import {browser, by, element} from 'protractor';

import {changeRealTimestampInWinscope, checkFinalRealTimestamp, checkInitialRealTimestamp, checkTimelineTraceSelector, checkWinscopeRealTimestamp, filterHierarchy, loadTraceAndCheckViewer, selectItemInHierarchy, setTimeouts, WINSCOPE_URL,} from './helpers';

describe('Viewer View Capture', () => {
  const viewerSelector = 'viewer-view-capture';

  beforeEach(async () => {
    await setTimeouts(1000);
    await browser.get(WINSCOPE_URL);
  });

  it('processes trace and navigates correctly', async () => {
    await loadTraceAndCheckViewer(
      'traces/perfetto/viewcapture_two_windows.perfetto-trace',
      'View Capture',
      viewerSelector,
    );
    await checkTimelineTraceSelector({
      icon: 'filter_none',
      color: 'rgba(89, 202, 119, 1)',
    });
    await checkInitialRealTimestamp('2023-08-10, 18:42:16.293');
    await checkFinalRealTimestamp('2023-08-10, 18:44:13.390');

    await changeRealTimestampInWinscope('2023-08-10, 18:43:17.407');
    await checkWinscopeRealTimestamp('18:43:17.407');
    await filterHierarchy(viewerSelector, 'StashedHandleView');
    await selectItemInHierarchy(
      viewerSelector,
      'com.android.launcher3.taskbar.StashedHandleView@63457369',
    );
    await checkViewProperties();

    const miniTimeline = await element(
      by.css('#mini-timeline-canvas'),
    ).getWebElement();
    const timelineSize = await miniTimeline.getSize();
    const slider = await element(by.css('slider')).getWebElement();
    const sliderSize = await slider.getSize();
    const actions = browser
      .actions()
      .mouseMove(miniTimeline)
      .mouseMove({
        x: 0,
        y: timelineSize.height / 2 - (sliderSize.height * 3) / 2,
      })
      .click();
    await actions.perform();
    await checkFinalRealTimestamp('2023-08-10, 18:44:27.287');
    await checkInitialRealTimestamp('2023-08-10, 18:43:14.989');
  });

  async function checkViewProperties() {
    const curatedProperties = element(by.css('view-capture-property-groups'));
    const isPresent = await curatedProperties.isPresent();
    expect(isPresent).toBeTruthy();

    const translationY = curatedProperties.element(by.css('.translationy'));
    const translationYText = await translationY.getText();
    expect(translationYText).toEqual('Translation Y: -115.284');

    const willNotDraw = curatedProperties.element(by.css('.will-not-draw'));
    const willNotDrawText = await willNotDraw.getText();
    expect(willNotDrawText).toEqual('Will Not Draw: false');
  }
});

/*
 * Copyright (C) 2024 The Android Open Source Project
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

import {clickViewTracesButton, closeSnackBar, setTimeouts, uploadFixture, WINSCOPE_URL,} from './helpers';

describe('Viewer Screenshot', () => {
  const viewerSelector = 'viewer-media-based';
  const canvasSelector = '#frameCanvasElementOverlay';

  beforeEach(async () => {
    await setTimeouts(1000);
    await browser.get(WINSCOPE_URL);
  });

  it('processes file and renders view', async () => {
    await uploadFixture('traces/screenshot/screenshot.png');
    await closeSnackBar();
    await clickViewTracesButton(false);

    const viewer = element(by.css(viewerSelector));
    expect(await viewer.isPresent()).toBeTruthy();

    const img = element(by.css(`${viewerSelector} ${canvasSelector}`));
    expect(await img.isPresent()).toBeTruthy();
    expect(await img.getAttribute('height')).toBe('2400');
    expect(await img.getAttribute('width')).toBe('1080');
  });

  it('processes files and renders view with multiple screenshots', async () => {
    await uploadFixture(
      'traces/screenshot/screenshot.png',
      'traces/screenshot/screenshot_2.png',
    );
    await closeSnackBar();
    await clickViewTracesButton(false);

    const viewer = element(by.css(viewerSelector));
    expect(await viewer.isPresent()).toBeTruthy();

    const img = element(by.css(`${viewerSelector} ${canvasSelector}`));
    expect(await img.isPresent()).toBeTruthy();
    expect(await img.getAttribute('height')).toBe('2400');
    expect(await img.getAttribute('width')).toBe('1080');

    const overlayTitle = element(by.css(`${viewerSelector} .overlay-title`));
    expect(await overlayTitle.getText()).toBe('screenshot');

    const selectTrigger = element(
      by.css(`${viewerSelector} .mat-mdc-select-trigger`),
    );
    expect(await selectTrigger.isPresent()).toBeTruthy();
    await selectTrigger.click();
    const option2 = element.all(by.css('.mat-mdc-option')).last();
    await option2.click();

    expect(await img.isPresent()).toBeTruthy();
    expect(await img.getAttribute('height')).toBe('2152');
    expect(await img.getAttribute('width')).toBe('2076');
    expect(await overlayTitle.getText()).toBe('screenshot_2');
  });
});

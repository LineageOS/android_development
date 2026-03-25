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

import {TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {waitToBeCalled} from '@common/spy_utils';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {getFixtureFile} from '@common/testing/io_helpers';
import {Timer} from '@common/time/timer';
import {NonPerfettoParserProvider} from '@parsers/fixture_utils';
import {Parser} from '@trace_api/parser';
import {CanvasEntry, MediaBasedTraceEntry, VideoEntry,} from '@trace/media_based/media_based_trace_entry';

import {ViewerMediaBasedComponent} from './viewer_media_based_component';

describe('ViewerMediaBasedComponent', () => {
  let component: ViewerMediaBasedComponent;
  let dom: DOMTestHelper<ViewerMediaBasedComponent>;
  let screenshotImage: ImageBitmap;
  let screenRecordingParser: Parser<MediaBasedTraceEntry>;
  let srFrame: MediaBasedTraceEntry;

  beforeAll(async () => {
    screenRecordingParser = (await new NonPerfettoParserProvider()
      .addFile(
        'traces/elapsed_and_real_timestamp/screen_recording_metadata_v2.mp4',
      )
      .get()) as Parser<MediaBasedTraceEntry>;
    const screenshotFile = await getFixtureFile(
      'traces/screenshot/screenshot_2.png',
    );
    screenshotImage = await createImageBitmap(screenshotFile);
    srFrame = await screenRecordingParser.getEntry(1);
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MatCardModule,
        MatTooltipModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        NoopAnimationsModule,
        ViewerMediaBasedComponent,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ViewerMediaBasedComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('titles', ['Screen recording']);
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('renders title correctly', () => {
    const title = dom.get('.overlay-title');
    title.checkText('Screen');

    dom.setComponentInput('titles', ['Screenshot']);
    dom.detectChanges();
    title.checkTextExact('Screenshot');

    dom.setComponentInput('titles', ['Screenshot.png']);
    dom.detectChanges();
    title.checkTextExact('Screenshot');

    dom.setComponentInput('titles', ['Screenshot.png (parent.zip)']);
    dom.detectChanges();
    title.checkTextExact('Screenshot');

    dom.setComponentInput('titles', ['Screenshot (parent.zip)']);
    dom.detectChanges();
    title.checkTextExact('Screenshot');
  });

  it('can be minimized and maximized', () => {
    const buttonMinimize = dom.get('.button-minimize');
    const videoContainer = dom.get('.video-container').getHTMLElement();
    expect(videoContainer.style.height).toBe('');

    buttonMinimize.click();
    expect(videoContainer.style.height).toBe('0px');

    buttonMinimize.click();
    expect(videoContainer.style.height).toBe('');
  });

  it('forces minimized state', () => {
    dom.setComponentInput('forceMinimize', true);
    dom.detectChanges();

    const buttonMinimize = dom.get('.button-minimize');
    const videoContainer = dom.get('.video-container').getHTMLElement();
    expect(videoContainer.style.height).toBe('0px');
    buttonMinimize.checkDisabled(true);

    dom.setComponentInput('forceMinimize', false);
    dom.detectChanges();
    expect(videoContainer.style.height).toBe('');
    buttonMinimize.checkDisabled(false);
  });

  it('shows video', async () => {
    const initialMaxWidth = getContainerMaxWidth();
    dom.setComponentInput('currentTraceEntries', [srFrame]);
    await dom.detectChangesAndWaitStable();

    const videoContainer = dom.get('.video-container');
    expect(videoContainer.find('video')).toBeDefined();
    expect(getContainerMaxWidth()).not.toEqual(initialMaxWidth);
  });

  it('shows no frame message', () => {
    dom.get('.video-container').checkTextExact('No frame to show.');
  });

  it('image updated on selector entry change', async () => {
    const entry0 = new CanvasEntry(makeSpyImage());
    const spy0 = spyOn(entry0.frame, 'tryDrawOnCanvas');
    const entry1 = new CanvasEntry(makeSpyImage());
    const spy1 = spyOn(entry1.frame, 'tryDrawOnCanvas');
    dom.setComponentInput('currentTraceEntries', [entry0, entry1]);
    dom.setComponentInput('titles', ['Screenshot 1', 'Screenshot 2']);
    dom.detectChanges();
    expect(spy0).toHaveBeenCalledTimes(1);
    expect(spy1).not.toHaveBeenCalled();

    dom.openMatSelect();
    const options = dom.getMatSelectPanel().findAll('mat-option');

    options[1].click();
    expect(spy0).toHaveBeenCalledTimes(1);
    expect(spy1).toHaveBeenCalledTimes(1);

    options[1].click();
    expect(spy0).toHaveBeenCalledTimes(1);
    expect(spy1).toHaveBeenCalledTimes(1);

    options[0].click();
    expect(spy0).toHaveBeenCalledTimes(2);
    expect(spy1).toHaveBeenCalledTimes(1);

    options[0].click();
    expect(spy0).toHaveBeenCalledTimes(2);
    expect(spy1).toHaveBeenCalledTimes(1);
  });

  it('emits event on overlay trace change', () => {
    const emitSpy = spyOn(component.onOverlayMediaBasedTraceChange, 'emit');
    const entry0 = new CanvasEntry(makeSpyImage());
    const spy0 = spyOn(entry0.frame, 'tryDrawOnCanvas');
    const entry1 = new CanvasEntry(makeSpyImage());
    const spy1 = spyOn(entry1.frame, 'tryDrawOnCanvas');
    dom.setComponentInput('currentTraceEntries', [entry0, entry1]);
    dom.setComponentInput('titles', ['Screenshot 1', 'Screenshot 2']);
    dom.detectChanges();
    expect(spy0).toHaveBeenCalledTimes(1);
    expect(spy1).not.toHaveBeenCalled();

    dom.openMatSelect();
    dom.getMatSelectPanel().findAndClickByIndex('mat-option', 1);
    expect(emitSpy).toHaveBeenCalledOnceWith(1);
    expect(spy0).toHaveBeenCalledTimes(1);
    expect(spy1).toHaveBeenCalledTimes(1);
  });

  it('video frame updated on selector entry change', () => {
    dom.setComponentInput('currentTraceEntries', [
      new VideoEntry(new Blob(), 0),
      new VideoEntry(new Blob(), 0),
    ]);
    dom.setComponentInput('titles', ['Screenshot 1', 'Screenshot 2']);
    dom.detectChanges();

    let url = component.safeUrl;

    dom.openMatSelect();
    const options = dom.getMatSelectPanel().findAll('mat-option');

    options[1].click();
    expect(component.safeUrl).not.toEqual(url);
    url = component.safeUrl;

    options[1].click();
    expect(component.safeUrl).toEqual(url);

    options[0].click();
    expect(component.safeUrl).not.toEqual(url);
    url = component.safeUrl;

    options[0].click();
    expect(component.safeUrl).toEqual(url);
  });

  it('does not update frame if trace entries do not change', () => {
    const entry = new CanvasEntry(screenshotImage);
    const spy = spyOn(entry.frame, 'tryDrawOnCanvas');
    dom.setComponentInput('currentTraceEntries', [entry]);
    dom.setComponentInput('titles', ['Screenshot 1']);
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);

    dom.setComponentInput('titles', ['Screenshot 1', 'Screenshot 2']);
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('updates max container size on window resize', async () => {
    dom.setComponentInput('currentTraceEntries', [
      new CanvasEntry(screenshotImage),
    ]);
    await dom.detectChangesAndWaitStable();

    const initialMaxWidth = getContainerMaxWidth();
    const newWindowHeight = window.innerHeight / 2;
    spyOnProperty(window, 'innerHeight').and.returnValue(newWindowHeight);
    resizeWindow();
    const maxWidthAfterNewWindowHeight = getContainerMaxWidth();
    expect(maxWidthAfterNewWindowHeight < initialMaxWidth).toBeTrue();

    const newWindowWidth = maxWidthAfterNewWindowHeight / 2;
    spyOnProperty(window, 'innerWidth').and.returnValue(newWindowWidth);
    resizeWindow();
    expect(getContainerMaxWidth() < maxWidthAfterNewWindowHeight).toBeTrue();
  });

  it('emits event on double click', () => {
    const emitSpy = spyOn(component.onOverlayDblClick, 'emit');
    expect(dom.find('.info-icon')).toBeUndefined();
    const container = dom.get('.container');
    container.doubleClick();
    expect(emitSpy).not.toHaveBeenCalled();

    dom.setComponentInput('enableDoubleClick', true);
    dom.detectChanges();
    expect(dom.find('.info-icon')).toBeDefined();
    container.doubleClick();
    expect(emitSpy).toHaveBeenCalledOnceWith(0);
  });

  it('does not emit event on double click if in playback mode', () => {
    const emitSpy = spyOn(component.onOverlayDblClick, 'emit');
    dom.setComponentInput('enableDoubleClick', true);
    dom.setComponentInput('isInPlaybackMode', true);
    dom.detectChanges();
    const container = dom.get('.container');
    container.doubleClick();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('shows loading message', async () => {
    dom.setComponentInput('isFetchingEntries', true);
    dom.detectChanges();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
    await new Timer(1000).sleepMs();
    expect(dom.find('.fetching-entries-message')).toBeDefined();
    dom.setComponentInput('isFetchingEntries', false);
    dom.detectChanges();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
  });

  it('does not show loading message if update is too fast', async () => {
    dom.setComponentInput('isFetchingEntries', true);
    dom.detectChanges();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
    dom.setComponentInput('isFetchingEntries', false);
    dom.detectChanges();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
    await new Timer(500).sleepMs();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
  });

  it('does not show loading message if update is not sequential', async () => {
    dom.setComponentInput('isFetchingEntries', true);
    dom.detectChanges();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
    dom.setComponentInput('isFetchingEntries', false);
    dom.detectChanges();
    dom.setComponentInput('isFetchingEntries', true);
    dom.detectChanges();
    dom.setComponentInput('isFetchingEntries', false);
    dom.detectChanges();
    await new Timer(1000).sleepMs();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
  });

  it('disables select if in playback mode', () => {
    dom.setComponentInput('currentTraceEntries', [
      new VideoEntry(new Blob(), 0),
      new VideoEntry(new Blob(), 0),
    ]);
    dom.setComponentInput('titles', ['Screenshot 1', 'Screenshot 2']);
    dom.setComponentInput('isInPlaybackMode', true);
    dom.detectChanges();
    dom.openMatSelect();
    expect(dom.isMatSelectOpen()).toBeFalse();
  });

  it('keeps canvas alive when switching to video until video seek time reached', async () => {
    dom.setComponentInput('currentTraceEntries', [
      new CanvasEntry(screenshotImage),
    ]);
    dom.detectChanges();
    expect(dom.find('canvas')).toBeDefined();

    const seekSpy = spyOn(component, 'onVideoSeeked');
    dom.setComponentInput('currentTraceEntries', [srFrame]);
    dom.detectChanges();
    expect(dom.find('canvas')).toBeDefined();
    expect(dom.find('video')).toBeDefined();

    await waitToBeCalled(seekSpy, 1);
    seekSpy.and.callThrough();
    component.onVideoSeeked();
    expect(dom.find('canvas')).toBeUndefined();
  });

  it('does not keep canvas alive if no entries with frames alive', () => {
    dom.setComponentInput('currentTraceEntries', [
      new CanvasEntry(screenshotImage),
    ]);
    dom.detectChanges();
    expect(dom.find('canvas')).toBeDefined();

    dom.setComponentInput('currentTraceEntries', []);
    dom.detectChanges();
    expect(dom.find('canvas')).toBeUndefined();
  });

  function getContainerMaxWidth(): number {
    const container = dom.get('.container').getHTMLElement();
    return Number(container.style.maxWidth.slice(0, -2));
  }

  async function resizeWindow() {
    window.dispatchEvent(new Event('resize'));
    await dom.detectChangesAndWaitStable();
  }

  function makeSpyImage(): jasmine.SpyObj<ImageBitmap> {
    return jasmine.createSpyObj<ImageBitmap>('image', ['close']);
  }
});

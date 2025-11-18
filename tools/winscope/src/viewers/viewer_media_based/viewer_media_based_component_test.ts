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

import {Component, ViewChild} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {assertDefined} from 'common/assert';
import {DOMTestHelper} from 'test/unit/dom_test_helpers';
import {getFixtureFile} from 'test/unit/io_helpers';
import {
  CanvasEntry,
  MediaBasedTraceEntry,
  VideoEntry,
} from 'trace_api/media_based_trace_entry';
import {ViewerEvents} from 'viewers/common/viewer_events';
import {ViewerMediaBasedComponent} from './viewer_media_based_component';
import {LegacyParserProvider} from 'test/unit/fixture_utils';
import {Parser} from 'trace_api/parser';
import {Timer} from 'common/time/timer';

describe('ViewerMediaBasedComponent', () => {
  let component: TestHostComponent;
  let dom: DOMTestHelper<TestHostComponent>;
  let screenshotImage: ImageBitmap;
  let screenRecordingParser: Parser<MediaBasedTraceEntry>;

  beforeAll(async () => {
    screenRecordingParser = await new LegacyParserProvider()
      .addFile(
        'traces/elapsed_and_real_timestamp/screen_recording_metadata_v2.mp4',
      )
      .getParser<MediaBasedTraceEntry>();
    const screenshotFile = await getFixtureFile(
      'traces/screenshot/screenshot_2.png',
    );
    screenshotImage = await createImageBitmap(screenshotFile);
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MatCardModule,
        MatTooltipModule,
        MatButtonModule,
        MatIconModule,
        MatSelectModule,
        BrowserAnimationsModule,
        TestHostComponent,
        ViewerMediaBasedComponent,
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('renders title correctly', () => {
    const title = dom.get('.overlay-title');
    title.checkTextExact('Screen recording');

    component.titles = ['Screenshot'];
    dom.detectChanges();
    title.checkTextExact('Screenshot');

    component.titles = ['Screenshot.png'];
    dom.detectChanges();
    title.checkTextExact('Screenshot');

    component.titles = ['Screenshot.png (parent.zip)'];
    dom.detectChanges();
    title.checkTextExact('Screenshot');

    component.titles = ['Screenshot (parent.zip)'];
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
    component.forceMinimize = true;
    dom.detectChanges();

    const buttonMinimize = dom.get('.button-minimize');
    const videoContainer = dom.get('.video-container').getHTMLElement();
    expect(videoContainer.style.height).toBe('0px');
    buttonMinimize.checkDisabled(true);

    component.forceMinimize = false;
    dom.detectChanges();
    expect(videoContainer.style.height).toBe('');
    buttonMinimize.checkDisabled(false);
  });

  it('shows video', async () => {
    const initialMaxWidth = getContainerMaxWidth();
    const firstFrame = await screenRecordingParser.getEntry(0);
    component.currentTraceEntries = [firstFrame];
    await dom.detectChangesAndWaitStable();

    const videoContainer = dom.get('.video-container');
    expect(videoContainer.find('video')).toBeDefined();
    expect(getContainerMaxWidth()).not.toEqual(initialMaxWidth);
  });

  it('shows no frame message', () => {
    dom.get('.video-container').checkTextExact('No frame to show.');
  });

  it('image updated on selector entry change', () => {
    const entry0 = new CanvasEntry(makeSpyImage());
    const spy0 = spyOn(entry0, 'tryDrawOnCanvas');
    const entry1 = new CanvasEntry(makeSpyImage());
    const spy1 = spyOn(entry1, 'tryDrawOnCanvas');
    component.currentTraceEntries = [entry0, entry1];
    component.titles = ['Screenshot 1', 'Screenshot 2'];
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
    let index: number | undefined;
    dom.addEventListener(ViewerEvents.OverlayMediaBasedTraceChange, (event) => {
      index = (event as CustomEvent).detail;
    });
    const entry0 = new CanvasEntry(makeSpyImage());
    const spy0 = spyOn(entry0, 'tryDrawOnCanvas');
    const entry1 = new CanvasEntry(makeSpyImage());
    const spy1 = spyOn(entry1, 'tryDrawOnCanvas');
    component.currentTraceEntries = [entry0, entry1];
    component.titles = ['Screenshot 1', 'Screenshot 2'];
    dom.detectChanges();
    expect(spy0).toHaveBeenCalledTimes(1);
    expect(spy1).not.toHaveBeenCalled();

    dom.openMatSelect();
    dom.getMatSelectPanel().findAndClickByIndex('mat-option', 1);
    expect(index).toEqual(1);
    expect(spy0).toHaveBeenCalledTimes(1);
    expect(spy1).toHaveBeenCalledTimes(1);
  });

  it('video frame updated on selector entry change', async () => {
    component.currentTraceEntries = [
      new VideoEntry(new Blob(), 0),
      new VideoEntry(new Blob(), 0),
    ];
    component.titles = ['Screenshot 1', 'Screenshot 2'];
    dom.detectChanges();

    const screenComponent = assertDefined(component.screenComponent);
    let url = screenComponent.safeUrl;

    dom.openMatSelect();
    const options = dom.getMatSelectPanel().findAll('mat-option');

    options[1].click();
    expect(screenComponent.safeUrl).not.toEqual(url);
    url = screenComponent.safeUrl;

    options[1].click();
    expect(screenComponent.safeUrl).toEqual(url);

    options[0].click();
    expect(screenComponent.safeUrl).not.toEqual(url);
    url = screenComponent.safeUrl;

    options[0].click();
    expect(screenComponent.safeUrl).toEqual(url);
  });

  it('does not update frame if trace entries do not change', async () => {
    const entry = new CanvasEntry(screenshotImage);
    const spy = spyOn(entry, 'tryDrawOnCanvas');
    component.currentTraceEntries = [entry];
    component.titles = ['Screenshot 1'];
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);

    component.titles = ['Screenshot 1', 'Screenshot 2'];
    dom.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('updates max container size on window resize', async () => {
    component.currentTraceEntries = [new CanvasEntry(screenshotImage)];
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
    let index: number | undefined;
    dom.addEventListener(ViewerEvents.OverlayDblClick, (event) => {
      index = (event as CustomEvent).detail;
    });
    expect(dom.find('.info-icon')).toBeUndefined();
    const container = dom.get('.container');
    container.doubleClick();
    expect(index).toBeUndefined();

    assertDefined(component.screenComponent).enableDoubleClick = true;
    dom.detectChanges();
    expect(dom.find('.info-icon')).toBeDefined();
    container.doubleClick();
    expect(index).toBe(0);
  });

  it('does not emit event on double click if in playback mode', () => {
    let index: number | undefined;
    dom.addEventListener(ViewerEvents.OverlayDblClick, (event) => {
      index = (event as CustomEvent).detail;
    });
    assertDefined(component.screenComponent).enableDoubleClick = true;
    assertDefined(component.screenComponent).isInPlaybackMode = true;
    dom.detectChanges();
    const container = dom.get('.container');
    container.doubleClick();
    expect(index).toBeUndefined();
  });

  it('shows loading message', async () => {
    component.isFetchingEntries = true;
    dom.detectChanges();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
    await new Timer(1000).sleepMs();
    expect(dom.find('.fetching-entries-message')).toBeDefined();
    component.isFetchingEntries = false;
    dom.detectChanges();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
  });

  it('does not show loading message if update is too fast', async () => {
    component.isFetchingEntries = true;
    dom.detectChanges();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
    component.isFetchingEntries = false;
    dom.detectChanges();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
    await new Timer(500).sleepMs();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
  });

  it('does not show loading message if update is not sequential', async () => {
    component.isFetchingEntries = true;
    dom.detectChanges();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
    component.isInPlaybackMode = true;
    dom.detectChanges();
    await new Timer(1000).sleepMs();
    expect(dom.find('.fetching-entries-message')).toBeUndefined();
  });

  it('disables select if in playback mode', () => {
    component.currentTraceEntries = [
      new VideoEntry(new Blob(), 0),
      new VideoEntry(new Blob(), 0),
    ];
    component.titles = ['Screenshot 1', 'Screenshot 2'];
    component.isInPlaybackMode = true;
    dom.detectChanges();
    dom.openMatSelect();
    expect(dom.isMatSelectOpen()).toBeFalse();
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

  @Component({
    imports: [ViewerMediaBasedComponent],
    selector: 'host-component',
    template: `
      <viewer-media-based
        [currentTraceEntries]="currentTraceEntries"
        [titles]="titles"
        [forceMinimize]="forceMinimize"
        [isFetchingEntries]="isFetchingEntries"
        [isInPlaybackMode]="isInPlaybackMode"></viewer-media-based>
    `,
  })
  class TestHostComponent {
    currentTraceEntries: MediaBasedTraceEntry[] = [];
    titles: string[] = [];
    forceMinimize = false;
    isFetchingEntries = false;
    isInPlaybackMode = false;

    @ViewChild(ViewerMediaBasedComponent)
    screenComponent: ViewerMediaBasedComponent | undefined;
  }
});

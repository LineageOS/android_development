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
import {MediaBasedTraceEntry} from 'trace_api/media_based_trace_entry';
import {ViewerEvents} from 'viewers/common/viewer_events';
import {ViewerMediaBasedComponent} from './viewer_media_based_component';
import {LegacyParserProvider} from 'test/unit/fixture_utils';
import {Parser} from 'trace_api/parser';

describe('ViewerMediaBasedComponent', () => {
  let component: TestHostComponent;
  let dom: DOMTestHelper<TestHostComponent>;
  let screenshotFile: File;
  let screenRecordingParser: Parser<MediaBasedTraceEntry>;

  beforeAll(async () => {
    screenRecordingParser = await new LegacyParserProvider()
      .addFile(
        'traces/elapsed_and_real_timestamp/screen_recording_metadata_v2.mp4',
      )
      .getParser<MediaBasedTraceEntry>();
    screenshotFile = await getFixtureFile('traces/screenshot/screenshot_2.png');
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
    const spy = spyOn(firstFrame, 'tryDrawOnCanvas').and.callThrough();
    component.currentTraceEntries = [firstFrame];
    await dom.detectChangesAndWaitStable();

    const videoContainer = dom.get('.video-container');
    expect(videoContainer.find('canvas')).toBeDefined();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(videoContainer.find('img')).toBeUndefined();
    expect(getContainerMaxWidth()).not.toEqual(initialMaxWidth);
  });

  it('shows screenshot image', async () => {
    const initialMaxWidth = getContainerMaxWidth();
    component.currentTraceEntries = [new MediaBasedTraceEntry(screenshotFile)];
    await dom.detectChangesAndWaitStable();

    const videoContainer = dom.get('.video-container');
    expect(videoContainer.find('img')).toBeDefined();
    expect(videoContainer.find('canvas')).toBeUndefined();
    expect(getContainerMaxWidth()).not.toEqual(initialMaxWidth);
  });

  it('shows no frame message', () => {
    dom.get('.video-container').checkTextExact('No frame to show.');
  });

  it('image updated on selector entry change', () => {
    component.currentTraceEntries = [
      new MediaBasedTraceEntry(new Blob()),
      new MediaBasedTraceEntry(new Blob()),
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

  it('emits event on overlay trace change', () => {
    let index: number | undefined;
    dom.addEventListener(ViewerEvents.OverlayMediaBasedTraceChange, (event) => {
      index = (event as CustomEvent).detail;
    });
    component.currentTraceEntries = [
      new MediaBasedTraceEntry(new Blob()),
      new MediaBasedTraceEntry(new Blob()),
    ];
    component.titles = ['Screenshot 1', 'Screenshot 2'];
    dom.detectChanges();
    dom.openMatSelect();
    dom.getMatSelectPanel().findAndClickByIndex('mat-option', 1);
    expect(index).toEqual(1);
  });

  it('video frame updated on selector entry change', async () => {
    component.currentTraceEntries = [
      await screenRecordingParser.getEntry(0),
      await screenRecordingParser.getEntry(1),
    ];
    component.titles = ['Recording 1', 'Recording 2'];
    dom.detectChanges();

    const dataUrl = dom
      .get('canvas')
      .getHTMLElement<HTMLCanvasElement>()
      .toDataURL();

    dom.openMatSelect();
    const options = dom.getMatSelectPanel().findAll('mat-option');

    const spy = spyOn(
      component.currentTraceEntries[1],
      'tryDrawOnCanvas',
    ).and.callThrough();
    options[1].click();
    expect(
      dom.get('canvas').getHTMLElement<HTMLCanvasElement>().toDataURL(),
    ).not.toBe(dataUrl);
    expect(spy).toHaveBeenCalledTimes(1);

    options[0].click();
    expect(
      dom.get('canvas').getHTMLElement<HTMLCanvasElement>().toDataURL(),
    ).toBe(dataUrl);
  });

  it('does not update frame if trace entries do not change', () => {
    component.currentTraceEntries = [new MediaBasedTraceEntry(screenshotFile)];
    component.titles = ['Screenshot 1'];
    dom.detectChanges();

    const screenComponent = assertDefined(component.screenComponent);
    const url = screenComponent.safeUrl;

    component.titles = ['Screenshot 1', 'Screenshot 2'];
    dom.detectChanges();
    expect(screenComponent.safeUrl).toEqual(url);
  });

  it('updates max container size on window resize', async () => {
    component.currentTraceEntries = [new MediaBasedTraceEntry(screenshotFile)];
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

  function getContainerMaxWidth(): number {
    const container = dom.get('.container').getHTMLElement();
    return Number(container.style.maxWidth.slice(0, -2));
  }

  async function resizeWindow() {
    window.dispatchEvent(new Event('resize'));
    await dom.detectChangesAndWaitStable();
  }

  @Component({
    imports: [ViewerMediaBasedComponent],
    selector: 'host-component',
    template: `
      <viewer-media-based
        [currentTraceEntries]="currentTraceEntries"
        [titles]="titles"
        [forceMinimize]="forceMinimize"></viewer-media-based>
    `,
  })
  class TestHostComponent {
    currentTraceEntries: MediaBasedTraceEntry[] = [];
    titles: string[] = [];
    forceMinimize = false;

    @ViewChild(ViewerMediaBasedComponent)
    screenComponent: ViewerMediaBasedComponent | undefined;
  }
});

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

import {ClipboardModule} from '@angular/cdk/clipboard';
import {TestBed} from '@angular/core/testing';
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatIconModule} from '@angular/material/icon';
import {MatListModule} from '@angular/material/list';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSnackBar, MatSnackBarModule} from '@angular/material/snack-bar';
import {MatTooltipModule} from '@angular/material/tooltip';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {assertDefined} from '@common/assert';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {getFixtureFile} from '@common/testing/io_helpers';
import {TestFileReaderBuilder} from '@legacy_file_readers/testing/test_file_reader_builder';
import {TestLegacyFileReaderBuilder} from '@legacy_file_readers/testing/test_legacy_file_reader_builder';
import {ShowTraceUploadWarning} from '@trace_api/trace_events';
import {TraceFile} from '@trace_api/trace_file';
import {getReasonForNoTraceVisualization, TraceType,} from '@trace_api/trace_type';
import {AppTraceViewRequest, AppTraceViewRequestHandled,} from '@ui/shared/events/app_events';

import {LoadProgressComponent} from './load_progress_component';
import {UploadTracesComponent} from './upload_traces_component';

describe('UploadTracesComponent', () => {
  const uploadSelector = '.upload-btn';
  const clearAllSelector = '.clear-all-btn';
  const viewTracesSelector = '.load-btn';
  const removeTraceSelector = '.uploaded-files button';
  const warningBannerSelector = '.warning-banner';
  const warningMessageSelector = '.warn-message';
  const warningCloseButtonSelector = '.warning-banner button';
  const discardLegacySelector = '.discard-legacy-traces input';
  const traceFile = new TraceFile(new File([], ''));

  let component: UploadTracesComponent;
  let dom: DOMTestHelper<UploadTracesComponent>;
  let validSfFile: File;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        MatCardModule,
        MatSnackBarModule,
        MatListModule,
        MatIconModule,
        MatProgressBarModule,
        MatTooltipModule,
        MatCheckboxModule,
        ClipboardModule,
        UploadTracesComponent,
        LoadProgressComponent,
      ],
      providers: [MatSnackBar],
    }).compileComponents();
    const fixture = TestBed.createComponent(UploadTracesComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('loadedFileReaders', []);
    dom.setComponentInput('storage', new InMemoryStorage());
    dom.detectChanges();
    validSfFile = await getFixtureFile(
      'traces/elapsed_timestamp/SurfaceFlinger.pb',
    );
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('renders the expected card title', () => {
    const titleSelector = '.title';
    const expectedTitle = 'Upload Traces';
    dom.get(titleSelector).checkText(expectedTitle);
  });

  it('handles file upload via drag and drop', () => {
    const spy = spyOn(component.filesUploaded, 'emit');
    dropFileAndGetTransferredFiles(false);
    expect(spy).not.toHaveBeenCalled();
    const files = dropFileAndGetTransferredFiles();
    expect(spy).toHaveBeenCalledOnceWith(files);
  });

  it('handles file upload via upload button click', async () => {
    loadFiles([TraceType.SURFACE_FLINGER]);
    const spy = spyOn(component.filesUploaded, 'emit');
    addFileByClickAndGetTransferredFiles(false);
    expect(spy).not.toHaveBeenCalled();
    const files = addFileByClickAndGetTransferredFiles();
    expect(spy).toHaveBeenCalledOnceWith(files);
  });

  it('displays only load progress bar on progress update (no existing files)', () => {
    component.onProgressUpdate(undefined, undefined);
    dom.detectChanges();
    checkOnlyProgressBarShowing();

    component.onOperationFinished();
    dom.detectChanges();
    expect(dom.find('load-progress')).toBeUndefined();
    expect(dom.find('.drop-info')).toBeDefined();
  });

  it('displays only load progress bar on progress update (existing files)', async () => {
    loadFiles([TraceType.SURFACE_FLINGER]);
    component.onProgressUpdate(undefined, undefined);
    dom.detectChanges();
    checkOnlyProgressBarShowing();

    component.onOperationFinished();
    dom.detectChanges();
    expect(dom.find('load-progress')).toBeUndefined();
    expect(dom.find('.trace-actions-container')).toBeDefined();
    expect(dom.find('.uploaded-files')).toBeDefined();
  });

  it('shows progress bar with custom message', () => {
    const customMessage = 'Updating';
    component.onProgressUpdate(customMessage, undefined);
    dom.detectChanges();
    checkOnlyProgressBarShowing(customMessage);
  });

  it('updates progress bar percentage only if sufficient time has passed', () => {
    component.onProgressUpdate(undefined, 10);
    dom.detectChanges();
    const progressBar = assertDefined(
      dom.findByDirective(LoadProgressComponent),
    );
    expect(progressBar.progressPercentage()).toBe(10);

    component.onProgressUpdate(undefined, 20);
    dom.detectChanges();
    expect(progressBar.progressPercentage()).toBe(10);

    const now = Date.now();
    spyOn(Date, 'now').and.returnValue(now + 500);
    component.onProgressUpdate(undefined, 20);
    dom.detectChanges();
    expect(progressBar.progressPercentage()).toBe(20);
  });

  it('can display uploaded traces', async () => {
    loadFiles([TraceType.SURFACE_FLINGER]);
    expect(dom.find('.uploaded-files')).toBeDefined();
    expect(dom.find('.trace-actions-container')).toBeDefined();
  });

  it('can remove trace', async () => {
    loadFiles([TraceType.SURFACE_FLINGER, TraceType.WINDOW_MANAGER]);
    const reader = component.loadedFileReaders()[0];
    const removeTrace = spyOn(component.removeTrace, 'emit');
    const operationFinished = spyOn(component, 'onOperationFinished');
    dom.findAndClick(removeTraceSelector);

    expect(dom.find('.uploaded-files')).toBeDefined();
    expect(removeTrace).toHaveBeenCalledOnceWith(reader);
    expect(operationFinished).toHaveBeenCalled();
  });

  it('can clear all uploaded traces', async () => {
    loadFiles([TraceType.SURFACE_FLINGER, TraceType.WINDOW_MANAGER]);
    const operationFinished = spyOn(component, 'onOperationFinished');
    const removeAllTraces = spyOn(component.removeAllTraces, 'emit');
    dom.findAndClick(clearAllSelector);

    expect(operationFinished).toHaveBeenCalledTimes(1);
    expect(removeAllTraces).toHaveBeenCalledTimes(1);
  });

  it('can emit view traces event', async () => {
    loadFiles([TraceType.SURFACE_FLINGER]);
    const spy = spyOn(component.viewTracesButtonClick, 'emit');
    dom.findAndClick(viewTracesSelector);
    expect(spy).toHaveBeenCalledWith(true);
  });

  it('can emit view traces event discarding legacy traces', async () => {
    loadLegacySfFile();
    dom.findAndClick(discardLegacySelector);
    const spy = spyOn(component.viewTracesButtonClick, 'emit');
    dom.findAndClick(viewTracesSelector);
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('disables checkbox to discard legacy traces', async () => {
    loadLegacySfFile();
    dom.detectChanges();
    const box = dom.get(discardLegacySelector);
    box.checkDisabled(false);
    box.checkInputChecked(true);

    loadFiles([TraceType.SURFACE_FLINGER]);
    box.checkDisabled(true);
    box.checkInputChecked(false);
  });

  it('updates discard legacy traces box from storage', async () => {
    loadLegacySfFile();
    dom.findAndClick(discardLegacySelector);

    const newFixture = TestBed.createComponent(UploadTracesComponent);
    const newComponent = newFixture.componentInstance;
    const newDom = new DOMTestHelper(newFixture, newFixture.nativeElement);
    newDom.setComponentInput('storage', component.storage());
    newDom.setComponentInput('loadedFileReaders', []);
    newDom.detectChanges();

    loadLegacySfFile(newDom);

    newDom.get(discardLegacySelector).checkInputChecked(false);
    const spy = spyOn(newComponent.viewTracesButtonClick, 'emit');
    newDom.findAndClick(viewTracesSelector);
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('shows warning elements for traces without visualization', async () => {
    loadFiles([TraceType.SHELL_TRANSITION]);
    await dom
      .get('.warning-icon')
      .checkTooltip(
        getReasonForNoTraceVisualization(TraceType.SHELL_TRANSITION),
      );
    dom.get(viewTracesSelector).checkDisabled(true);
    dom.get(discardLegacySelector).checkDisabled(true);
  });

  it('shows warning elements for legacy traces', async () => {
    loadLegacySfFile();
    await dom
      .get('.warning-icon')
      .checkTooltip(component.legacyTraceWarningTooltip);
    dom.get(viewTracesSelector).checkDisabled(false);
    dom.get(discardLegacySelector).checkDisabled(false);
  });

  it('emits download traces event', async () => {
    loadFiles([TraceType.SURFACE_FLINGER]);
    const spy = spyOn(component.downloadTracesClick, 'emit');
    dom.findAndClick('.download-btn');
    expect(spy).toHaveBeenCalled();
  });

  it('disables edit/view traces functionality on trace view request events', async () => {
    loadFiles([TraceType.SURFACE_FLINGER]);
    const buttons = [
      dom.get(viewTracesSelector),
      dom.get(removeTraceSelector),
      dom.get(clearAllSelector),
      dom.get(uploadSelector),
    ];
    const dropBox = dom.get('.drop-box');
    const spy = spyOn(component.filesUploaded, 'emit');

    await component.onWinscopeEvent(new AppTraceViewRequest());
    dom.detectChanges();
    buttons.forEach((button) => {
      button.checkDisabled(true);
    });
    dropFileAndGetTransferredFiles();
    addFileByClickAndGetTransferredFiles(true, dropBox);
    expect(spy).not.toHaveBeenCalled();

    await component.onWinscopeEvent(new AppTraceViewRequestHandled());
    dom.detectChanges();
    buttons.forEach((button) => {
      button.checkDisabled(false);
    });
    const files = dropFileAndGetTransferredFiles();
    expect(spy).toHaveBeenCalledOnceWith(files);
    spy.calls.reset();
    addFileByClickAndGetTransferredFiles(true, dropBox);
    expect(spy).toHaveBeenCalledOnceWith(files);
  });

  it('displays warning banners when ShowTraceUploadWarning events received', async () => {
    const warningMessage1 = 'This is the first warning!';
    const warningMessage2 = 'This is the second warning!';
    const warningEvent1 = new ShowTraceUploadWarning(warningMessage1);
    const warningEvent2 = new ShowTraceUploadWarning(warningMessage2);

    // Initially, no banners should be visible
    expect(component.warningMessages.length).toBe(0);
    expect(dom.findAll(warningBannerSelector).length).toBe(0);

    // Simulate receiving the first event
    await component.onWinscopeEvent(warningEvent1);
    dom.detectChanges();

    // Assert first banner visibility and message content
    expect(component.warningMessages).toEqual([warningMessage1]);
    let bannerElements = dom.findAll(warningBannerSelector);
    expect(bannerElements.length).toBe(1);
    bannerElements[0]
      .get(warningMessageSelector)
      .checkTextExact(warningMessage1);

    // Simulate receiving the second event
    await component.onWinscopeEvent(warningEvent2);
    dom.detectChanges();

    // Assert both banners are visible with correct messages
    expect(component.warningMessages).toEqual([
      warningMessage1,
      warningMessage2,
    ]);
    bannerElements = dom.findAll(warningBannerSelector);
    expect(bannerElements.length).toBe(2);
    bannerElements[0]
      .get(warningMessageSelector)
      .checkTextExact(warningMessage1);
    bannerElements[1]
      .get(warningMessageSelector)
      .checkTextExact(warningMessage2);

    // Simulate receiving the first event again (should not add duplicate)
    await component.onWinscopeEvent(warningEvent1);
    dom.detectChanges();
    expect(component.warningMessages).toEqual([
      warningMessage1,
      warningMessage2,
    ]);
    expect(dom.findAll(warningBannerSelector).length).toBe(2);
  });

  it('clears specific warning banner when its close button is clicked', async () => {
    const warningMessage1 = 'Warning 1 to dismiss';
    const warningMessage2 = 'Warning 2 to keep';
    const warningEvent1 = new ShowTraceUploadWarning(warningMessage1);
    const warningEvent2 = new ShowTraceUploadWarning(warningMessage2);

    // Show the banners first
    await component.onWinscopeEvent(warningEvent1);
    await component.onWinscopeEvent(warningEvent2);
    dom.detectChanges();
    let warningBanners = dom.findAll(warningBannerSelector);
    expect(warningBanners.length).toBe(2);
    warningBanners[0]
      .get(warningMessageSelector)
      .checkTextExact(warningMessage1);
    warningBanners[1]
      .get(warningMessageSelector)
      .checkTextExact(warningMessage2);

    const firstBannerCloseButton = warningBanners[0].find(
      warningCloseButtonSelector,
    );
    firstBannerCloseButton!.click();
    dom.detectChanges();

    // Assert only the first banner is removed
    warningBanners = dom.findAll(warningBannerSelector);
    expect(warningBanners.length).toBe(1);
    warningBanners[0]
      .get(warningMessageSelector)
      .checkTextExact(warningMessage2);
  });

  it('clears all warning banners when clear all button is clicked', async () => {
    const warningMessage1 = 'Warning before clear all 1!';
    const warningMessage2 = 'Warning before clear all 2!';
    const warningEvent1 = new ShowTraceUploadWarning(warningMessage1);
    const warningEvent2 = new ShowTraceUploadWarning(warningMessage2);
    loadFiles([TraceType.SURFACE_FLINGER]); // Need a file to enable clear all

    // Show the banners first
    await component.onWinscopeEvent(warningEvent1);
    await component.onWinscopeEvent(warningEvent2);
    dom.detectChanges();
    expect(component.warningMessages.length).toBe(2);
    expect(dom.findAll(warningBannerSelector).length).toBe(2);

    // Click clear all
    dom.findAndClick(clearAllSelector);

    // Assert banners are hidden
    expect(component.warningMessages.length).toBe(0);
    expect(dom.findAll(warningBannerSelector).length).toBe(0);
  });

  it('warning banners are not cleared when new files are uploaded', async () => {
    const warningMessage1 = 'Warning before new load 1!';
    const warningMessage2 = 'Warning before new load 2!';
    const warningEvent1 = new ShowTraceUploadWarning(warningMessage1);
    const warningEvent2 = new ShowTraceUploadWarning(warningMessage2);

    // Show the banners first
    await component.onWinscopeEvent(warningEvent1);
    await component.onWinscopeEvent(warningEvent2);
    dom.detectChanges();
    expect(component.warningMessages.length).toBe(2);
    expect(dom.findAll(warningBannerSelector).length).toBe(2);

    // Start a new progress update
    component.onProgressUpdate('Loading new files...', 0);
    dom.detectChanges();

    // Assert banners are hidden
    expect(component.warningMessages.length).toBe(2);
    expect(dom.findAll(warningBannerSelector).length).toBe(2);
  });

  function loadLegacySfFile(testDom = dom) {
    testDom.setComponentInput('loadedFileReaders', [
      new TestLegacyFileReaderBuilder()
        .setTraceFile(traceFile)
        .setType(TraceType.SURFACE_FLINGER)
        .setTimestamps([])
        .build(),
    ]);
    testDom.detectChanges();
  }

  function loadFiles(traceTypes: TraceType[], testDom = dom) {
    const fileReaders = traceTypes.map((traceType) => {
      return new TestFileReaderBuilder()
        .setTraceFile(traceFile)
        .setType(traceType)
        .setTimestamps([])
        .build();
    });
    testDom.setComponentInput('loadedFileReaders', fileReaders);
    testDom.detectChanges();
  }

  function dropFileAndGetTransferredFiles(withFile = true): File[] {
    let dataTransfer: DataTransfer | undefined;
    if (withFile) {
      dataTransfer = new DataTransfer();
      dataTransfer.items.add(validSfFile);
    }
    const dropBox = dom.get('.drop-box');
    dropBox.dispatchEvent(new DragEvent('drop', {dataTransfer}));
    return Array.from(dataTransfer?.files ?? []);
  }

  function addFileByClickAndGetTransferredFiles(
    withFile = true,
    clickEl = dom.get(uploadSelector),
  ): File[] {
    const dataTransfer = new DataTransfer();
    if (withFile) dataTransfer.items.add(validSfFile);
    const fileList = dataTransfer.files;

    const fileInput = dom.get('.drop-box input');
    const fileInputEl = fileInput.getHTMLElement<HTMLInputElement>();
    clickEl.addEventListener('click', () => {
      fileInputEl.files = fileList;
    });
    clickEl.click();
    fileInput.dispatchEvent(new Event('change'));
    return Array.from(fileList);
  }

  function checkOnlyProgressBarShowing(expectedMessage = 'Loading...') {
    dom.get('load-progress').checkTextExact(expectedMessage);
    expect(dom.find('.trace-actions-container')).toBeUndefined();
    expect(dom.find('.uploaded-files')).toBeUndefined();
    expect(dom.find('.drop-info')).toBeUndefined();
  }
});

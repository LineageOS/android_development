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
import {CommonModule} from '@angular/common';
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {Component, input, output} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDialog} from '@angular/material/dialog';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatListModule} from '@angular/material/list';
import {MatMenuModule} from '@angular/material/menu';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSelectModule} from '@angular/material/select';
import {MatSliderModule} from '@angular/material/slider';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatTabsModule} from '@angular/material/tabs';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatTooltipModule} from '@angular/material/tooltip';
import {Title} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {Mediator} from '@app/mediator';
import {AngularViewer} from '@app/shared/angular_viewer';
import {MatDrawer, MatDrawerContainer, MatDrawerContent,} from '@app/shared/bottomnav/bottom_drawer_component';
import {TimelineComponent} from '@app/shared/timeline/timeline_component';
import {CollectTracesComponent} from '@app/trace_collection/collect_traces_component';
import {WdpSetupComponent} from '@app/trace_collection/wdp_setup_component';
import {WinscopeProxySetupComponent} from '@app/trace_collection/winscope_proxy_setup_component';
import {UploadTracesComponent} from '@app/trace_loading/upload_traces_component';
import {assertDefined} from '@common/assert';
import {waitToBeCalled} from '@common/spy_utils';
import {Store} from '@common/store/store';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {makeConverterZeroRteOffsets, makeRealTimestamp,} from '@common/time/testing/test_helpers';
import {Timestamp} from '@common/time/time';
import {RequestData} from '@cross_tool/g3_proxy';
import {TestFileReaderAndParserBuilder} from '@legacy_file_readers/testing/test_file_reader_and_parser_builder';
import {TestFileReaderBuilder} from '@legacy_file_readers/testing/test_file_reader_builder';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent} from '@messaging/winscope_event_emitter';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {UserNotifier} from '@services/user_notifier';
import {FilesSource} from '@trace_api/files_source';
import {TracesBuilder} from '@trace_api/testing/traces_builder';
import {TracePositionUpdate, TraceSearchRequest} from '@trace_api/trace_events';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {AppRefreshDumpsRequest, AppResetRequest,} from '@ui/shared/events/app_events';
import {BookmarksChanged, BugreportFileSelected, BugreportFileSelectionRequest,} from '@ui/shared/events/misc_events';
import {TabbedViewSwitchRequest} from '@ui/shared/events/tabbed_view_events';
import {ViewType} from '@ui/shared/viewers/viewer';
import {TimelineData} from '@ui/timeline/timeline_data';
import {LoadedFileData} from '@ui/trace_loading/loaded_file_data';
import {ParsingErrorType} from '@ui/trace_loading/parsing_error_type';
import {makeWarningFailedToInitializeTimelineData, makeWarningNoValidFiles,} from '@ui/trace_loading/warnings';

import {AppComponent} from './app_component';
import {TraceViewComponent} from './trace_view_component';
import {ViewersLoaded, ViewersUnloaded} from './viewers_events';

@Component({
  selector: 'trace-view',
  template: '',
  standalone: true,
  providers: [
    {provide: TraceViewComponent, useExisting: MockTraceViewComponent},
  ],
})
class MockTraceViewComponent {
  viewers = input.required<AngularViewer[]>();
  store = input.required<Store>();
  traceTypesWithParsingErrors = input<TraceType[]>();
  setEmitEvent(_: EmitEvent) {}
  async onWinscopeEvent(_: WinscopeEvent) {}
}

@Component({
  selector: 'timeline',
  template: '',
  standalone: true,
  providers: [{provide: TimelineComponent, useExisting: MockTimelineComponent}],
})
class MockTimelineComponent {
  timelineData = input.required<TimelineData>();
  allTraces = input.required<Traces>();
  store = input.required<Store>();
  initialTabTraceType = input<TraceType>();
  bookmarks: Timestamp[] = [];
  setEmitEvent(_: EmitEvent) {}
  async onWinscopeEvent(_: WinscopeEvent) {}
}

@Component({
  selector: 'collect-traces',
  template: '',
  standalone: true,
  providers: [
    {provide: CollectTracesComponent, useExisting: MockCollectTracesComponent},
  ],
})
class MockCollectTracesComponent {
  store = input.required<Store>();
  setEmitEvent(_: EmitEvent) {}
  async onWinscopeEvent(_: WinscopeEvent) {}
}

@Component({
  selector: 'upload-traces',
  template:
    '<button class="download-btn" (click)="downloadTracesClick.emit()"></button>',
  standalone: true,
  providers: [
    {provide: UploadTracesComponent, useExisting: MockUploadTracesComponent},
  ],
})
class MockUploadTracesComponent {
  storage = input.required<Store>();
  loadedFileReaders = input.required<FileReader[]>();
  downloadTracesClick = output<void>();
  removeTrace = output<FileReader>();
  removeAllTraces = output<void>();
  setEmitEvent(_: EmitEvent) {}
  async onWinscopeEvent(_: WinscopeEvent) {}
}
@Component({
  selector: 'mat-drawer',
  template: '<ng-content></ng-content>',
  providers: [{provide: MatDrawer, useExisting: MockMatDrawer}],
  standalone: true,
})
class MockMatDrawer {
  mode = input<'push' | 'overlay'>('overlay');
  baseHeight = input(0);
}

@Component({
  selector: 'mat-drawer-container',
  template: '<ng-content></ng-content>',
  providers: [
    {provide: MatDrawerContainer, useExisting: MockMatDrawerContainer},
  ],
  standalone: true,
})
class MockMatDrawerContainer {}

@Component({
  selector: 'mat-drawer-content',
  template: '<ng-content></ng-content>',
  standalone: true,
})
class MockMatDrawerContent {}

describe('AppComponent', () => {
  const reader = new TestFileReaderBuilder().setTimestamps([]).build();
  const converter = makeConverterZeroRteOffsets();

  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let downloadTracesSpy: jasmine.Spy;
  let dom: DOMTestHelper<AppComponent>;
  let matDialogSpy: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    matDialogSpy = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [
        BrowserAnimationsModule,
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCardModule,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatToolbarModule,
        MatTooltipModule,
        MatMenuModule,
        MatListModule,
        MatTabsModule,
        MatSelectModule,
        MatSliderModule,
        MatCheckboxModule,
        ClipboardModule,
        MatSnackBarModule,
        WinscopeProxySetupComponent,
        WdpSetupComponent,
        AppComponent,
      ],
      providers: [Title, provideHttpClient(withInterceptorsFromDi())],
    })
      .overrideComponent(AppComponent, {
        remove: {
          imports: [
            MatDrawer,
            MatDrawerContainer,
            MatDrawerContent,
            TraceViewComponent,
            TimelineComponent,
            CollectTracesComponent,
            UploadTracesComponent,
          ],
        },
        add: {
          imports: [
            MockMatDrawer,
            MockMatDrawerContainer,
            MockMatDrawerContent,
            MockTraceViewComponent,
            MockTimelineComponent,
            MockCollectTracesComponent,
            MockUploadTracesComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;

    // Spy on prototype to capture all instances
    spyOn(LoadedFileData.prototype, 'getTraces').and.returnValue(new Traces());
    spyOn(LoadedFileData.prototype, 'getLoadedFileReaders').and.returnValue([]);
    spyOn(
      LoadedFileData.prototype,
      'getDownloadArchiveFilename',
    ).and.returnValue('winscope');
    spyOn(LoadedFileData.prototype, 'getLostPerfettoPackets').and.returnValue(
      0,
    );
    spyOn(
      LoadedFileData.prototype,
      'getTraceTypesWithParsingErrors',
    ).and.returnValue(new Map());
    spyOn(TimelineData.prototype, 'getTimestampConverter').and.returnValue(
      converter,
    );
    spyOn(TimelineData.prototype, 'hasTimestamps').and.returnValue(false);

    downloadTracesSpy = jasmine.createSpy('fromUrl');
    component.downloadRequest = (url: string, fileName: string) => {
      downloadTracesSpy(url, fileName);
    };
    dom = new DOMTestHelper(fixture, fixture.nativeElement);

    const dialog = fixture.debugElement.injector.get(MatDialog);
    spyOn(dialog, 'open').and.callThrough();
    matDialogSpy = dialog as jasmine.SpyObj<MatDialog>;

    await dom.detectChangesAndWaitStable();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('has the expected title', () => {
    expect(component.title).toBe('winscope');
  });

  it('shows permanent header items on homepage', () => {
    checkPermanentHeaderItems();
  });

  it('displays correct elements when no data loaded', () => {
    component.dataLoaded = false;
    component.showDataLoadedElements = false;
    dom.detectChanges();
    checkHomepage();
  });

  it('displays correct elements when data loaded', async () => {
    await goToTraceView();
    checkTraceViewPage();

    spyOn(component, 'allTracesAreDumps').and.returnValue(true);
    dom.detectChanges();
    expect(dom.find('.refresh-dumps')).toBeTruthy();
  });

  it('returns to homepage on upload new button click', async () => {
    await goToTraceView();
    checkTraceViewPage();
    await dom.clickAndWaitStable('.upload-new');
    await dom.detectChangesAndWaitStable();
    checkHomepage();
  });

  it('sends event on refresh dumps button click', async () => {
    spyOn(component, 'allTracesAreDumps').and.returnValue(true);
    await goToTraceView();
    checkTraceViewPage();

    const winscopeEventSpy = spyOn(
      Mediator.prototype,
      'onWinscopeEvent',
    ).and.callThrough();
    await dom.clickAndWaitStable('.refresh-dumps');
    expect(winscopeEventSpy).toHaveBeenCalledWith(new AppResetRequest());
    await dom.detectChangesAndWaitStable();
    checkHomepage();
    expect(winscopeEventSpy).toHaveBeenCalledWith(new AppRefreshDumpsRequest());
  });

  it('shows download progress bar', () => {
    showDataLoadedElements();
    expect(
      dom.find('.download-files-section mat-progress-bar'),
    ).toBeUndefined();

    component.onProgressUpdate('Progress update', 10);
    dom.detectChanges();
    expect(dom.find('.download-files-section mat-progress-bar')).toBeTruthy();

    component.onOperationFinished(true);
    dom.detectChanges();
    expect(
      dom.find('.download-files-section mat-progress-bar'),
    ).toBeUndefined();
  });

  it('downloads traces on download button click and shows download progress bar', async () => {
    showDataLoadedElements();
    clickDownloadTracesButton();
    expect(dom.find('.download-files-section mat-progress-bar')).toBeTruthy();
    await waitToBeCalled(downloadTracesSpy);
  });

  it('downloads traces after valid file name change', async () => {
    showDataLoadedElements();
    clickEditFilenameButton();
    updateFilenameInputAndDownloadTraces('Winscope2', true);
    await waitToBeCalled(downloadTracesSpy);
    expect(downloadTracesSpy).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      'Winscope2.zip',
    );

    downloadTracesSpy.calls.reset();

    // check it works twice in a row
    clickEditFilenameButton();
    updateFilenameInputAndDownloadTraces('win_scope', true);
    await waitToBeCalled(downloadTracesSpy);
    expect(downloadTracesSpy).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      'win_scope.zip',
    );
  });

  it('changes page title based on archive name', async () => {
    const pageTitle = TestBed.inject(Title);
    await component.onWinscopeEvent(new ViewersUnloaded());
    expect(pageTitle.getTitle()).toBe('Winscope');

    const traces = new Traces();
    component.timelineData.initialize(traces, undefined, converter);
    component.loadedFileData.getDownloadArchiveFilename = jasmine
      .createSpy()
      .and.returnValue('test_archive');
    await sendOnViewersLoadedEvent();
    expect(pageTitle.getTitle()).toBe('Winscope | test_archive');
  });

  it('handles ViewersUnloaded event', async () => {
    const loadedFileData = component.loadedFileData;
    const timelineData = component.timelineData;
    const mediator = component.mediator;
    const spy = spyOn(component.loadedFileData, 'onDestroy');

    await component.onWinscopeEvent(new ViewersUnloaded());
    expect(spy).toHaveBeenCalledTimes(1);
    expect(component.loadedFileData).not.toBe(loadedFileData);
    expect(component.timelineData).not.toBe(timelineData);
    expect(component.mediator).not.toBe(mediator);
  });

  it('handles removeTrace from upload traces component - files still remaining', () => {
    const loadedFileData = component.loadedFileData;
    (
      LoadedFileData.prototype.getLoadedFileReaders as jasmine.Spy
    ).and.returnValue([reader]);
    const removeReaderSpy = spyOn(loadedFileData, 'removeFileReader');
    const onDestroySpy = spyOn(loadedFileData, 'onDestroy');
    const mediatorSpy = spyOn(
      component.mediator,
      'setLoadedFileData',
    ).and.callThrough();

    component.uploadTracesComponent()?.removeTrace.emit(reader);
    dom.detectChanges();

    expect(removeReaderSpy).toHaveBeenCalledOnceWith(reader);
    expect(onDestroySpy).not.toHaveBeenCalled();
    expect(component.loadedFileData).toBe(loadedFileData);
    expect(mediatorSpy).not.toHaveBeenCalled();
  });

  it('handles removeTrace from upload traces component - all files removed', () => {
    (
      LoadedFileData.prototype.getLoadedFileReaders as jasmine.Spy
    ).and.returnValue([]);
    const loadedFileData = component.loadedFileData;
    const removeReaderSpy = spyOn(loadedFileData, 'removeFileReader');
    const onDestroySpy = spyOn(loadedFileData, 'onDestroy');
    const mediatorSpy = spyOn(
      component.mediator,
      'setLoadedFileData',
    ).and.callThrough();

    component.uploadTracesComponent()?.removeTrace.emit(reader);
    dom.detectChanges();

    expect(removeReaderSpy).toHaveBeenCalledOnceWith(reader);
    expect(onDestroySpy).toHaveBeenCalledTimes(1);
    expect(component.loadedFileData).not.toBe(loadedFileData);
    expect(mediatorSpy).toHaveBeenCalledOnceWith(component.loadedFileData);
  });

  it('handles removeAllTraces from upload traces component', () => {
    const loadedFileData = component.loadedFileData;
    const spyLoadedFileData = spyOn(loadedFileData, 'onDestroy');
    const spyMediator = spyOn(
      component.mediator,
      'setLoadedFileData',
    ).and.callThrough();

    component.uploadTracesComponent()?.removeAllTraces.emit();
    dom.detectChanges();
    expect(spyLoadedFileData).toHaveBeenCalledTimes(1);
    expect(component.loadedFileData).not.toBe(loadedFileData);
    expect(spyMediator).toHaveBeenCalledOnceWith(component.loadedFileData);
  });

  it('does not download traces if invalid file name chosen', () => {
    showDataLoadedElements();
    clickEditFilenameButton();
    updateFilenameInputAndDownloadTraces('w?n$cope', false);
    expect(downloadTracesSpy).not.toHaveBeenCalled();
  });

  it('behaves as expected when entering valid then invalid then valid file names', async () => {
    showDataLoadedElements();
    clickEditFilenameButton();
    updateFilenameInputAndDownloadTraces('Winscope2', true);
    await waitToBeCalled(downloadTracesSpy);
    expect(downloadTracesSpy).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      'Winscope2.zip',
    );
    downloadTracesSpy.calls.reset();

    clickEditFilenameButton();
    updateFilenameInputAndDownloadTraces('w?n$cope', false);
    expect(downloadTracesSpy).not.toHaveBeenCalled();

    updateFilenameInputAndDownloadTraces('win.scope', true);
    await waitToBeCalled(downloadTracesSpy);
    expect(downloadTracesSpy).toHaveBeenCalledOnceWith(
      jasmine.any(String),
      'win.scope.zip',
    );
  });

  it('validates filename on enter key, escape key or focus out', () => {
    const spy = spyOn(component, 'trySubmitFilename');
    showDataLoadedElements();
    clickEditFilenameButton();
    const inputField = dom.get('.file-name-input-field');
    inputField.get('input').updateValue('valid_file_name');

    inputField.keydownEnter();
    expect(spy).toHaveBeenCalledTimes(1);

    inputField.keydownEsc();
    expect(spy).toHaveBeenCalledTimes(2);

    inputField.focusOut();
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('downloads traces from upload traces section', () => {
    (
      component.loadedFileData.getLoadedFileReaders as jasmine.Spy
    ).and.returnValue([reader]);
    dom.detectChanges();
    const downloadButtonClickSpy = spyOn(
      component,
      'onDownloadTracesButtonClick',
    );
    dom.findAndClick('upload-traces .download-btn');
    expect(downloadButtonClickSpy).toHaveBeenCalledOnceWith(
      component.uploadTracesComponent(),
    );
  });

  it('shows cross tool sync button', async () => {
    showDataLoadedElements();
    const fileDescriptor = dom.get('.file-descriptor');
    expect(fileDescriptor.find('.cross-tool-sync-button')).toBeUndefined();

    spyOn(
      component.crossToolProtocol,
      'isAllowedTimestampSync',
    ).and.returnValue(true);
    dom.detectChanges();
    const syncButton = fileDescriptor.get('.cross-tool-sync-button');
    await syncButton.checkTooltip('Cross Tool Sync OFF (Click to turn ON)');
    syncButton.checkClassName('mat-accent', true);
    syncButton.checkClassName('mat-primary', false);

    syncButton.click();
    await syncButton.checkTooltip('Cross Tool Sync ON (Click to turn OFF)');
    syncButton.checkClassName('mat-primary', true);
    syncButton.checkClassName('mat-accent', false);

    syncButton.click();
    await syncButton.checkTooltip('Cross Tool Sync OFF (Click to turn ON)');
    syncButton.checkClassName('mat-accent', true);
    syncButton.checkClassName('mat-primary', false);
  });

  it('shows warning icon for packet loss', async () => {
    showDataLoadedElements();
    const fileDescriptor = dom.get('.file-descriptor');
    fileDescriptor.checkClassName('file-warning', false);
    expect(fileDescriptor.find('.warning-icon')).toBeUndefined();

    const spy = component.loadedFileData.getLostPerfettoPackets as jasmine.Spy;
    spy.and.returnValue(1);
    dom.detectChanges();
    fileDescriptor.checkClassName('file-warning', true);
    const warningIcon = fileDescriptor.get('.warning-icon');
    await warningIcon.checkTooltip(
      '1 Perfetto packet lost during tracing - data may be incomplete',
    );

    spy.and.returnValue(4);
    dom.detectChanges();
    await warningIcon.checkTooltip(
      '4 Perfetto packets lost during tracing - data may be incomplete',
    );
  });

  it('shows warning icon for trace processor errors', async () => {
    showDataLoadedElements();
    const fileDescriptor = dom.get('.file-descriptor');
    fileDescriptor.checkClassName('file-warning', false);
    expect(fileDescriptor.find('.warning-icon')).toBeUndefined();

    const spy = component.loadedFileData
      .getTraceTypesWithParsingErrors as jasmine.Spy;
    spy.and.returnValue(
      new Map([[TraceType.PROTO_LOG, ParsingErrorType.DATA_INCOMPLETE]]),
    );
    dom.detectChanges();
    fileDescriptor.checkClassName('file-warning', true);
    const warningIcon = fileDescriptor.get('.warning-icon');
    await warningIcon.checkTooltip(
      'Trace processor errors occurred - data may be incomplete',
    );

    spy.and.returnValue(
      new Map([
        [TraceType.INPUT_METHOD_CLIENTS, ParsingErrorType.DATA_INCORRECT],
        [TraceType.PROTO_LOG, ParsingErrorType.DATA_INCOMPLETE],
      ]),
    );
    dom.detectChanges();
    await warningIcon.checkTooltip(
      'Trace processor errors occurred - data may be incorrect',
    );
  });

  it('shows combined warning message for incorrect data', async () => {
    showDataLoadedElements();
    const fileDescriptor = dom.get('.file-descriptor');
    fileDescriptor.checkClassName('file-warning', false);
    expect(fileDescriptor.find('.warning-icon')).toBeUndefined();

    const spy1 = component.loadedFileData
      .getTraceTypesWithParsingErrors as jasmine.Spy;
    spy1.and.returnValue(
      new Map([[TraceType.PROTO_LOG, ParsingErrorType.DATA_INCORRECT]]),
    );

    const spy2 = component.loadedFileData.getLostPerfettoPackets as jasmine.Spy;
    spy2.and.returnValue(1);

    dom.detectChanges();

    fileDescriptor.checkClassName('file-warning', true);
    const warningIcon = fileDescriptor.get('.warning-icon');
    await warningIcon.checkTooltip(
      '1 Perfetto packet lost during tracing and trace processor errors occurred - data may be incorrect',
    );
  });

  it('shows combined warning message for incomplete data', async () => {
    showDataLoadedElements();
    const fileDescriptor = dom.get('.file-descriptor');
    fileDescriptor.checkClassName('file-warning', false);
    expect(fileDescriptor.find('.warning-icon')).toBeUndefined();

    const spy1 = component.loadedFileData
      .getTraceTypesWithParsingErrors as jasmine.Spy;
    spy1.and.returnValue(
      new Map([[TraceType.PROTO_LOG, ParsingErrorType.DATA_INCOMPLETE]]),
    );

    const spy2 = component.loadedFileData.getLostPerfettoPackets as jasmine.Spy;
    spy2.and.returnValue(1);

    dom.detectChanges();

    fileDescriptor.checkClassName('file-warning', true);
    const warningIcon = fileDescriptor.get('.warning-icon');
    await warningIcon.checkTooltip(
      '1 Perfetto packet lost during tracing and trace processor errors occurred - data may be incomplete',
    );
  });

  it('opens shortcuts panel via dialog', () => {
    component.openShortcutsPanel();
    expect(matDialogSpy.open).toHaveBeenCalled();
  });

  it('sets snackbar opener to global user notifier', () => {
    expect(dom.findInDocument('snack-bar')).toBeUndefined();
    UserNotifier.add(makeWarningNoValidFiles());
    UserNotifier.notify();
    expect(dom.findInDocument('snack-bar')).toBeTruthy();
  });

  it('does not open new snackbar until existing snackbar has been dismissed', async () => {
    expect(dom.findInDocument('snack-bar')).toBeUndefined();
    const firstMessage = makeWarningNoValidFiles();
    UserNotifier.add(firstMessage);
    UserNotifier.notify();
    await dom.detectChangesAndRenderingDone();
    let snackbar = dom.getSnackBar();
    snackbar.checkText(firstMessage.message);

    const secondMessage = makeWarningFailedToInitializeTimelineData();
    UserNotifier.add(secondMessage);
    UserNotifier.notify();
    await dom.detectChangesAndRenderingDone();
    snackbar = dom.getSnackBar();
    snackbar.checkText(firstMessage.message);

    snackbar.findAndClick('.snack-bar-actions .close-button');

    // Wait for the second snackbar to appear
    // We cannot use dom.whenStable() because it waits for the snackbar duration timer (5s)
    for (let i = 0; i < 50; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      dom.detectChanges();
      if (
        document
          .querySelector('snack-bar')
          ?.textContent?.includes(secondMessage.message)
      ) {
        break;
      }
    }

    // The previous snackbar might still be animating out, or the new one animating in.
    snackbar = dom.getSnackBar();
    snackbar.checkText(secondMessage.message);
  });

  it('shows bugreport selection dialog', async () => {
    expect(dom.findInDocument('warning-dialog')).toBeUndefined();
    let eventHandled = false;
    component
      .onWinscopeEvent(new BugreportFileSelectionRequest(['f1', 'f2']))
      .then(() => {
        eventHandled = true;
      });
    await dom.whenStable();
    const dialog = dom.getInDocument('warning-dialog');
    expect(eventHandled).toBeFalse();

    dialog
      .get('.warning-message')
      .checkTextExact('Multiple Perfetto traces found. Select one to process:');

    const [option1, option2] = dialog.findAll(
      '.warning-action-boxes mat-checkbox',
    );
    option1.checkTextExact('f1');
    option2.checkTextExact('f2');
    option2.dispatchEvent(new Event('change'));
    await dom.whenStable();
    expect(eventHandled).toBeFalse();

    const mediatorSpy = spyOn(component.mediator, 'onWinscopeEvent');
    const actions = dialog.findAll('.warning-action-buttons button');
    expect(actions.length).toBe(1);
    actions[0].click();
    await dom.whenStable();
    expect(eventHandled).toBeTrue();
    expect(mediatorSpy).toHaveBeenCalledOnceWith(
      new BugreportFileSelected('f2'),
    );
    expect(dom.findInDocument('warning-dialog')).toBeUndefined();
  });

  describe('settings button', () => {
    let isInsideWinscopeProxyFrameSpy: jasmine.Spy;
    let getReportedParentOriginSpy: jasmine.Spy;
    let isSupportedParentOriginSpy: jasmine.Spy;

    beforeEach(() => {
      isInsideWinscopeProxyFrameSpy = spyOn(
        component,
        'isInsideWinscopeProxyFrame',
      ).and.returnValue(false);
      getReportedParentOriginSpy = spyOn(
        component,
        'getReportedParentOrigin',
      ).and.returnValue(null);
      isSupportedParentOriginSpy = spyOn(
        component,
        'isSupportedReportedParentOrigin',
      ).and.returnValue(false);
    });

    it('is not shown if not in winscope proxy iframe', () => {
      isInsideWinscopeProxyFrameSpy.and.returnValue(false);
      dom.detectChanges();
      expect(dom.find('.iframe-settings')).toBeUndefined();
    });

    it('is shown if in winscope proxy iframe', () => {
      isInsideWinscopeProxyFrameSpy.and.returnValue(true);
      dom.detectChanges();
      expect(dom.find('.iframe-settings')).toBeTruthy();
    });

    it('sends message to parent on click', () => {
      const parentOrigin = 'https://allowed.origin';
      isInsideWinscopeProxyFrameSpy.and.returnValue(true);
      getReportedParentOriginSpy.and.returnValue(parentOrigin);
      isSupportedParentOriginSpy.and.returnValue(true);
      dom.detectChanges();
      const postMessageSpy: jasmine.Spy<
        (
          message: string,
          targetOrigin: string,
          transfer?: Transferable[],
        ) => void
      > = spyOn(window.parent, 'postMessage');
      dom.findAndClick('.iframe-settings');
      expect(postMessageSpy).toHaveBeenCalledOnceWith(
        JSON.stringify({action: 'openSettings'}),
        parentOrigin,
      );
    });
  });

  describe('share button', () => {
    let isInsideWinscopeProxyFrameSpy: jasmine.Spy;
    let getReportedParentOriginSpy: jasmine.Spy;
    let getReportedRequestSpy: jasmine.Spy;

    beforeEach(() => {
      isInsideWinscopeProxyFrameSpy = spyOn(
        component,
        'isInsideWinscopeProxyFrame',
      ).and.returnValue(false);
      getReportedParentOriginSpy = spyOn(
        component,
        'getReportedParentOrigin',
      ).and.returnValue(null);
      getReportedRequestSpy = spyOn(
        component,
        'getReportedRequest',
      ).and.returnValue(undefined);
    });

    it('is always shown', () => {
      dom.detectChanges();
      expect(dom.find('.share-btn')).toBeTruthy();
    });

    describe('when not in winscope proxy iframe', () => {
      beforeEach(() => {
        isInsideWinscopeProxyFrameSpy.and.returnValue(false);
        dom.detectChanges();
      });

      it('is disabled', () => {
        const shareButton = dom.get('.share-btn');
        shareButton.checkDisabled(true);
      });

      it('shows tooltip explaining why it is disabled', async () => {
        const shareButtonWrapper = dom.get('.share-btn-wrapper');
        await shareButtonWrapper.checkTooltip(
          'Share functionality is not available for the provided traces',
        );
      });
    });

    describe('when in winscope proxy iframe', () => {
      const parentOrigin = 'https://winscope.corp.google.com';
      const request: RequestData = {
        artifacts: [{name: 'artifact', invocationId: '123'}],
      };

      beforeEach(() => {
        isInsideWinscopeProxyFrameSpy.and.returnValue(true);
        getReportedParentOriginSpy.and.returnValue(parentOrigin);
        getReportedRequestSpy.and.returnValue(request);
        dom.detectChanges();
      });

      it('is enabled', () => {
        const shareButton = dom.get('.share-btn');
        shareButton.checkDisabled(false);
      });

      it('shows "Share" tooltip', async () => {
        const shareButton = dom.get('.share-btn');
        await shareButton.checkTooltip('Share');
      });

      it('generates correct share link and shows it in menu', async () => {
        component.updateShareLink();
        dom.detectChanges();

        const params = new URLSearchParams();
        params.set(
          'request',
          btoa(JSON.stringify({artifacts: request.artifacts})),
        );
        const expectedLink = `${parentOrigin}?${params.toString()}`;
        expect(component.generatedShareLink).toEqual(expectedLink);

        dom.findAndClick('.share-btn');
        await dom.whenStable();

        const shareInputElement = document.querySelector(
          '.share-link-field input',
        ) as HTMLInputElement;
        assertDefined(shareInputElement);
        expect(shareInputElement.value).toEqual(expectedLink);

        const copyButton = dom.getInDocument('.share-link-container button');
        copyButton.checkDisabled(false);
      });

      it('generates correct share link with no artifacts', async () => {
        const request: RequestData = {
          artifacts: [],
        };
        getReportedRequestSpy.and.returnValue(request);

        component.updateShareLink();
        dom.detectChanges();

        const params = new URLSearchParams();
        params.set('request', btoa(JSON.stringify({artifacts: []})));
        const expectedLink = `${parentOrigin}?${params.toString()}`;
        expect(component.generatedShareLink).toEqual(expectedLink);

        dom.findAndClick('.share-btn');
        await dom.whenStable();

        const shareInputElement = document.querySelector(
          '.share-link-field input',
        ) as HTMLInputElement;
        assertDefined(shareInputElement);
        expect(shareInputElement.value).toEqual(expectedLink);
      });

      it('generates correct share link when original request is undefined', async () => {
        getReportedRequestSpy.and.returnValue(undefined);

        component.updateShareLink();
        dom.detectChanges();

        const params = new URLSearchParams();
        params.set('request', btoa(JSON.stringify({artifacts: []})));
        const expectedLink = `${parentOrigin}?${params.toString()}`;
        expect(component.generatedShareLink).toEqual(expectedLink);

        dom.findAndClick('.share-btn');
        await dom.whenStable();

        const shareInputElement = document.querySelector(
          '.share-link-field input',
        ) as HTMLInputElement;
        assertDefined(shareInputElement);
        expect(shareInputElement.value).toEqual(expectedLink);
      });

      it('disables copy button when no link is generated', async () => {
        dom.findAndClick('.share-btn');
        await dom.whenStable();

        component.generatedShareLink = '';
        dom.detectChanges();

        const copyButton = dom.getInDocument('.share-link-container button');
        copyButton.checkDisabled(true);
      });
    });
  });

  describe('processRequestData', () => {
    let getReportedRequestSpy: jasmine.Spy;
    let onWinscopeEventSpy: jasmine.Spy;

    beforeEach(async () => {
      await buildTraces();
      component.dataLoaded = true;
      component.showDataLoadedElements = true;
      getReportedRequestSpy = spyOn(
        component,
        'getReportedRequest',
      ).and.returnValue(undefined);
      onWinscopeEventSpy = spyOn(
        component.mediator,
        'onWinscopeEvent',
      ).and.callThrough();
    });

    it('processes bookmarks', async () => {
      component.timelineData.initialize(new Traces(), undefined, converter);
      dom.detectChanges();
      const request: RequestData = {
        artifacts: [],
        bookmarks: ['10', '20'],
      };
      getReportedRequestSpy.and.returnValue(request);
      await sendOnViewersLoadedEvent();

      const bookmarksChangedEvent = onWinscopeEventSpy.calls
        .all()
        .find((call) => call.args[0] instanceof BookmarksChanged)
        ?.args[0] as BookmarksChanged;
      expect(bookmarksChangedEvent).toBeInstanceOf(BookmarksChanged);
      expect(bookmarksChangedEvent.bookmarks.length).toEqual(2);
      expect(bookmarksChangedEvent.bookmarks[0].getValueNs()).toEqual(10n);
      expect(bookmarksChangedEvent.bookmarks[1].getValueNs()).toEqual(20n);
      expect(component.timelineComponent()?.bookmarks.length).toEqual(2);
    });

    it('processes timestamp', async () => {
      const traces = new TracesBuilder()
        .setTimestamps(TraceType.SURFACE_FLINGER, [
          converter.makeTimestampFromNs(10n),
        ])
        .build();
      component.timelineData.initialize(traces, undefined, converter);
      dom.detectChanges();
      component.timelineData.trySetActiveTrace(
        assertDefined(traces.getTrace(TraceType.SURFACE_FLINGER)),
      );

      const request: RequestData = {
        artifacts: [],
        timestamp: '15',
      };
      getReportedRequestSpy.and.returnValue(request);

      await sendOnViewersLoadedEvent();

      const tracePositionUpdateEvent = onWinscopeEventSpy.calls
        .all()
        .find((call) => call.args[0] instanceof TracePositionUpdate)
        ?.args[0] as TracePositionUpdate;
      expect(tracePositionUpdateEvent).toBeInstanceOf(TracePositionUpdate);
      expect(tracePositionUpdateEvent.position.timestamp.getValueNs()).toEqual(
        15n,
      );
      expect(tracePositionUpdateEvent.updateTimeline).toBeTrue();
    });

    it('processes search queries', async () => {
      spyOn(component.loadedFileData, 'tryCreateSearchTrace').and.resolveTo(
        undefined,
      );
      spyOn(UserNotifier, 'add');
      component.timelineData.initialize(new Traces(), undefined, converter);
      dom.detectChanges();
      const request: RequestData = {
        artifacts: [],
        searchQueries: ['query1', 'query2'],
      };
      getReportedRequestSpy.and.returnValue(request);

      await sendOnViewersLoadedEvent();

      const searchRequests = onWinscopeEventSpy.calls
        .all()
        .filter((call) => call.args[0] instanceof TraceSearchRequest);
      expect(searchRequests.length).toEqual(2);
      expect(searchRequests[0].args[0].query).toEqual('query1');
      expect(searchRequests[1].args[0].query).toEqual('query2');
      expect(
        component.loadedFileData.tryCreateSearchTrace,
      ).toHaveBeenCalledTimes(2);
      expect(
        component.loadedFileData.tryCreateSearchTrace,
      ).toHaveBeenCalledWith('query1');
      expect(
        component.loadedFileData.tryCreateSearchTrace,
      ).toHaveBeenCalledWith('query2');
    });

    it('processes trace type to switch view', async () => {
      const traces = new TracesBuilder()
        .setEntries(TraceType.SURFACE_FLINGER, [])
        .build();
      const trace = assertDefined(traces.getTrace(TraceType.SURFACE_FLINGER));
      const spy = component.loadedFileData.getTraces as jasmine.Spy;
      spy.and.returnValue(traces);

      component.timelineData.initialize(traces, undefined, converter);
      dom.detectChanges();
      const request: RequestData = {
        artifacts: [],
        traceType: TraceType.SURFACE_FLINGER,
      };
      getReportedRequestSpy.and.returnValue(request);

      const mockViewer: AngularViewer = {
        getTraces: () => [trace],
        onWinscopeEvent: jasmine.createSpy(),
        setEmitEvent: jasmine.createSpy(),
        getTitle: () => 'Mock View',
        onDestroy: () => {},
        getViewType: () => ViewType.TRACE_TAB,
        setComponentRef: jasmine.createSpy(),
        onShow: () => {},
        onHide: () => {},
        getComponentType: jasmine.createSpy(),
      };

      await sendOnViewersLoadedEvent([mockViewer]);

      const switchRequest = onWinscopeEventSpy.calls
        .all()
        .find((call) => call.args[0] instanceof TabbedViewSwitchRequest)
        ?.args[0] as TabbedViewSwitchRequest;
      expect(switchRequest).toBeInstanceOf(TabbedViewSwitchRequest);
      expect(switchRequest.newActiveTrace.type).toEqual(
        TraceType.SURFACE_FLINGER,
      );
    });
  });

  async function goToTraceView() {
    await buildTraces();
    component.timelineData.initialize(new Traces(), undefined, converter);
    component.dataLoaded = true;
    showDataLoadedElements();
    dom.detectChanges();
  }

  function updateFilenameInputAndDownloadTraces(name: string, valid: boolean) {
    dom.findAndDispatchInput('.file-name-input-field', name);
    dom.findAndClick('.check-button');

    const saveButton = dom.get('.save-button');
    if (valid) {
      expect(dom.find('.download-file-info')).toBeTruthy();
      saveButton.checkDisabled(false);
      clickDownloadTracesButton();
    } else {
      expect(dom.find('.download-file-info')).toBeUndefined();
      saveButton.checkDisabled(true);
    }
  }

  function clickDownloadTracesButton() {
    dom.findAndClick('.save-button');
  }

  function clickEditFilenameButton() {
    dom.findAndClick('.edit-button');
  }

  function checkHomepage() {
    expect(dom.find('.welcome-info')).toBeTruthy();
    expect(dom.find('.collect-traces-card')).toBeTruthy();
    expect(dom.find('.upload-traces-card')).toBeTruthy();
    expect(dom.find('.viewers')).toBeUndefined();
    expect(dom.find('.upload-new')).toBeUndefined();
    expect(dom.find('timeline')).toBeUndefined();
    checkPermanentHeaderItems();
  }

  function checkTraceViewPage() {
    expect(dom.find('.welcome-info')).toBeUndefined();
    expect(dom.find('.save-button')).toBeTruthy();
    expect(dom.find('.collect-traces-card')).toBeUndefined();
    expect(dom.find('.upload-traces-card')).toBeUndefined();
    expect(dom.find('.viewers')).toBeTruthy();
    expect(dom.find('.upload-new')).toBeTruthy();
    expect(dom.find('timeline')).toBeTruthy();
    checkPermanentHeaderItems();
  }

  function checkPermanentHeaderItems() {
    expect(dom.find('.app-title')).toBeTruthy();
    expect(dom.find('.shortcuts')).toBeTruthy();
    expect(dom.find('.documentation')).toBeTruthy();
    expect(dom.find('.report-bug')).toBeTruthy();
    expect(dom.find('.dark-mode')).toBeTruthy();
  }

  function showDataLoadedElements() {
    component.showDataLoadedElements = true;
    dom.detectChanges();
  }

  async function sendOnViewersLoadedEvent(viewers: AngularViewer[] = []) {
    await buildTraces();
    await component.onWinscopeEvent(new ViewersLoaded(viewers));
  }

  async function buildTraces() {
    component.loadedFileData.addFiles(
      {
        legacy: [],
        nonPerfetto: [
          new TestFileReaderAndParserBuilder()
            .setTimestamps([makeRealTimestamp(1n)])
            .setType(TraceType.SCREEN_RECORDING)
            .build(),
        ],
        perfetto: [],
        lostPerfettoPackets: 0,
        traceTypesWithParsingErrors: new Map(),
        timezoneInfo: undefined,
        traceGeometryData: new TraceGeometryData(),
        warnings: [],
      },
      FilesSource.TEST,
    );
    await component.loadedFileData.buildTraces(false, undefined);
    await component.loadedFileData.buildTraces(false, undefined);
  }
});

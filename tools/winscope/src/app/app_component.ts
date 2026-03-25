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

import {AbtChromeExtensionProtocol} from '@abt_chrome_extension/abt_chrome_extension_protocol';
import {ClipboardModule} from '@angular/cdk/clipboard';
import {CommonModule} from '@angular/common';
import {ChangeDetectorRef, Component, ErrorHandler, Inject, Injector, NgZone, viewChild, ViewEncapsulation,} from '@angular/core';
import {FormControl, FormsModule, ReactiveFormsModule, Validators,} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatMenuModule} from '@angular/material/menu';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatTooltipModule} from '@angular/material/tooltip';
import {Title} from '@angular/platform-browser';
import {GlobalErrorHandler} from '@app/global_error_handler';
import {Mediator} from '@app/mediator';
import {ViewerSearch} from '@app/search/viewer_search';
import {MatDrawer, MatDrawerContainer, MatDrawerContent,} from '@app/shared/bottomnav/bottom_drawer_component';
import {ShortcutsComponent} from '@app/shared/shortcuts_panel/shortcuts_component';
import {SnackBarOpener} from '@app/shared/snackbar/snack_bar_opener';
import {TimelineComponent} from '@app/shared/timeline/timeline_component';
import {CollectTracesComponent} from '@app/trace_collection/collect_traces_component';
import {WarningDialogComponent, WarningDialogData, WarningDialogResult,} from '@app/trace_collection/warning_dialog_component';
import {UploadTracesComponent} from '@app/trace_loading/upload_traces_component';
import {downloadFromUrl, DownloadRequest} from '@common/download';
import {DOWNLOAD_FILENAME_REGEX} from '@common/io';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {PersistentStore} from '@common/store/persistent_store';
import {Store} from '@common/store/store';
import {Timestamp} from '@common/time/time';
import {getRootUrl} from '@common/window';
import {globalConfig} from '@compat/global_config';
import {getLogger} from '@compat/logging';
import {CrossToolProtocol} from '@cross_tool/cross_tool_protocol';
import {RequestData} from '@cross_tool/g3_proxy';
import {isAllowedIframeParentOrigin} from '@cross_tool/origin_allow_list';
import {Analytics} from '@logging/analytics';
import {ProgressListener} from '@messaging/progress_listener';
import {WinscopeEvent} from '@messaging/winscope_event';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {UserNotifier} from '@services/user_notifier';
import {FileReader} from '@trace_api/file_reader';
import {ActiveTraceChanged, TracePositionUpdate, TraceSearchRequest,} from '@trace_api/trace_events';
import {TraceType} from '@trace_api/trace_type';
import {AdbFiles} from '@trace_collection/adb_files';
import {Registry} from '@trace/proto_utils/tampered_message_type';
import {AppFilesCollected, AppFilesUploaded, AppInitialized, AppRefreshDumpsRequest, AppResetRequest, AppTraceViewRequest,} from '@ui/shared/events/app_events';
import {ActiveSearchQueriesUpdate, BookmarksChanged, BugreportFileSelected, BugreportFileSelectionRequest, DarkModeToggled,} from '@ui/shared/events/misc_events';
import {TabbedViewSwitchRequest} from '@ui/shared/events/tabbed_view_events';
import {TimelineData} from '@ui/timeline/timeline_data';
import {LoadedFileData} from '@ui/trace_loading/loaded_file_data';
import {ParsingErrorType} from '@ui/trace_loading/parsing_error_type';

import {AngularViewer} from './shared/angular_viewer';
import {TraceViewComponent} from './trace_view_component';
import {ViewersLoaded, ViewersUnloaded} from './viewers_events';

/**
 * The root component of the Winscope app.
 */
@Component({
  selector: 'app-root',
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    ClipboardModule,
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatTooltipModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatCheckboxModule,
    ReactiveFormsModule,
    MatProgressBarModule,
    MatDividerModule,
    MatDialogModule,
    MatDrawer,
    MatDrawerContainer,
    MatDrawerContent,
    TraceViewComponent,
    TimelineComponent,
    CollectTracesComponent,
    UploadTracesComponent,
  ],
  providers: [Title, {provide: ErrorHandler, useClass: GlobalErrorHandler}],
  templateUrl: './app_component.ng.html',
  styleUrls: ['app_component.scss'],
})
export class AppComponent implements WinscopeEventListener {
  title = 'winscope';
  timelineData = new TimelineData();
  initialTimelineTabTraceType: TraceType | undefined;
  abtChromeExtensionProtocol = new AbtChromeExtensionProtocol();
  crossToolProtocol: CrossToolProtocol;
  dataLoaded = false;
  showDataLoadedElements = false;
  isBeta = /beta(_[a-z]+)?\/index\.html/.test(window.location.href);
  collapsedTimelineHeight = 0;
  isEditingFilename = false;
  persistentStore = new PersistentStore();
  viewers: AngularViewer[] = [];
  showShareOptionsContainer = false;
  canShareLocation = false;
  canShareBookmarks = false;
  canShareQueries = false;

  shareOptions = {
    location: true,
    bookmarks: true,
    searchQueries: true,
  };
  generatedShareLink = '';

  isDarkModeOn = false;
  changeDetectorRef: ChangeDetectorRef;
  loadedFileData: LoadedFileData;
  mediator: Mediator;
  currentTimestamp?: Timestamp;
  filenameFormControl = new FormControl(
    'winscope',
    Validators.compose([
      Validators.required,
      Validators.pattern(DOWNLOAD_FILENAME_REGEX),
    ]),
  );

  appStorage: Store;
  downloadProgress: number | undefined;
  downloadRequest: DownloadRequest = (url: string, fileName: string) => {
    downloadFromUrl(url, fileName);
  };

  private sendRefreshDumpsRequest = false;

  uploadTracesComponent = viewChild(UploadTracesComponent);
  collectTracesComponent = viewChild(CollectTracesComponent);
  traceViewComponent = viewChild(TraceViewComponent);
  timelineComponent = viewChild(TimelineComponent);

  constructor(
    @Inject(Injector) injector: Injector,
    @Inject(ChangeDetectorRef) changeDetectorRef: ChangeDetectorRef,
    @Inject(SnackBarOpener) snackbarOpener: SnackBarOpener,
    @Inject(Title) private pageTitle: Title,
    @Inject(NgZone) private ngZone: NgZone,
    @Inject(MatDialog) private dialog: MatDialog,
  ) {
    this.changeDetectorRef = changeDetectorRef;
    UserNotifier.setNotificationListener(snackbarOpener);
    this.loadedFileData = new LoadedFileData();
    this.crossToolProtocol = new CrossToolProtocol(
      this.loadedFileData.getTimestampConverter(),
    );
    this.mediator = new Mediator(
      this.loadedFileData,
      this.timelineData,
      this.abtChromeExtensionProtocol,
      this.crossToolProtocol,
      this,
      new PersistentStore(),
    );

    this.updateShareState();

    const storeDarkMode = this.persistentStore.get('dark-mode');
    const prefersDarkQuery = window.matchMedia?.(
      '(prefers-color-scheme: dark)',
    );
    this.setDarkMode(
      storeDarkMode ? storeDarkMode === 'true' : prefersDarkQuery.matches,
    );

    const isProdMode = globalConfig.isProdMode();

    this.appStorage = isProdMode
      ? new PersistentStore()
      : new InMemoryStorage();

    window.onunhandledrejection = (evt) => {
      Analytics.Error.logGlobalException(evt.reason);
    };

    if (isProdMode) {
      window.addEventListener('beforeunload', (event) => {
        if (this.dataLoaded) {
          event.preventDefault();
          event.returnValue = '';
        }
      });
    }
  }

  async ngAfterViewInit() {
    await Registry.getInstance().loadDefaultDescriptors();
    this.setComponentsToMediator();
    await this.mediator.onWinscopeEvent(new AppInitialized());
  }

  ngAfterViewChecked() {
    this.setComponentsToMediator();

    if (this.sendRefreshDumpsRequest) {
      this.sendRefreshDumpsRequest = false;
      this.mediator.onWinscopeEvent(new AppRefreshDumpsRequest());
    }
  }

  onRemoveTrace(reader: FileReader) {
    this.loadedFileData.removeFileReader(reader);
    if (this.loadedFileData.getLoadedFileReaders().length === 0) {
      this.onRemoveAllTraces();
    }
  }

  onRemoveAllTraces() {
    this.loadedFileData.onDestroy();
    this.loadedFileData = this.createNewLoadedFileData();
    this.mediator.setLoadedFileData(this.loadedFileData);
  }

  onCollapsedTimelineSizeChanged(height: number) {
    this.collapsedTimelineHeight = height;
    this.changeDetectorRef.detectChanges();
  }

  getLogoUrl(): string {
    const logoPath = this.isDarkModeOn
      ? 'logo_dark_mode.svg'
      : 'logo_light_mode.svg';
    return getRootUrl() + logoPath;
  }

  async setDarkMode(enabled: boolean) {
    document.body.classList.toggle('dark-mode', enabled);
    this.persistentStore.add('dark-mode', `${enabled}`);
    this.isDarkModeOn = enabled;
    await this.mediator.onWinscopeEvent(new DarkModeToggled(enabled));
  }

  onPencilIconClick() {
    this.isEditingFilename = true;
  }

  trySubmitFilename() {
    if (this.filenameFormControl.invalid) {
      return;
    }
    this.isEditingFilename = false;
    this.pageTitle.setTitle(`Winscope | ${this.filenameFormControl.value}`);
  }

  async onDownloadTracesButtonClick(progressListener: ProgressListener = this) {
    if (this.filenameFormControl.invalid) {
      return;
    }
    const archiveBlob =
      await this.loadedFileData.makeZipArchiveWithLoadedTraceFiles(
        (perc: number) => {
          progressListener.onProgressUpdate('Downloading', 90 * perc);
        },
      );
    const archiveFilename = `${
      this.showDataLoadedElements
        ? this.filenameFormControl.value
        : this.loadedFileData.getDownloadArchiveFilename()
    }.zip`;
    this.downloadTraces(archiveBlob, archiveFilename);
    progressListener.onOperationFinished(true);
  }

  async onFilesCollected(files: AdbFiles) {
    await this.mediator.onWinscopeEvent(new AppFilesCollected(files));
  }

  async onFilesUploaded(files: File[]) {
    await this.mediator.onWinscopeEvent(new AppFilesUploaded(files));
  }

  async onRefreshDumpsButtonClick() {
    Analytics.Tracing.logRefreshDumps();
    await this.mediator.onWinscopeEvent(new AppResetRequest());
    this.sendRefreshDumpsRequest = true;
  }

  async onUploadNewButtonClick() {
    await this.mediator.onWinscopeEvent(new AppResetRequest());
    this.persistentStore.clear('treeView');
  }

  async onViewTracesButtonClick(discardLegacyFiles: boolean) {
    await this.mediator.onWinscopeEvent(
      new AppTraceViewRequest(discardLegacyFiles),
    );
  }

  onProgressUpdate(_: string, progressPercentage: number | undefined) {
    this.ngZone.run(() => {
      this.downloadProgress = progressPercentage;
    });
  }

  onOperationFinished(_: boolean) {
    this.ngZone.run(() => {
      this.downloadProgress = undefined;
    });
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case ViewersLoaded:
        return await this.onViewersLoaded(event as ViewersLoaded);
      case ViewersUnloaded:
        return await this.onViewersUnloaded();
      case BugreportFileSelectionRequest:
        return await this.onBugreportFileSelectionRequest(
          event as BugreportFileSelectionRequest,
        );
      case ActiveSearchQueriesUpdate:
      case ActiveTraceChanged:
      case BookmarksChanged:
      case TracePositionUpdate:
        return this.updateShareState();
      default:
      // no-op
    }
  }

  openShortcutsPanel() {
    this.dialog.open(ShortcutsComponent, {
      height: 'fit-content',
      maxWidth: '860px',
      panelClass: 'shortcuts-panel',
    });
  }

  goToDocumentation() {
    Analytics.Help.logDocumentationOpened();
    this.goToLink(
      'https://source.android.com/docs/core/graphics/tracing-win-transitions',
    );
  }

  goToBuganizer() {
    Analytics.Help.logBuganizerOpened();
    this.goToLink('https://b.corp.google.com/issues/new?component=909476');
  }

  toggleDarkMode() {
    if (!this.isDarkModeOn) {
      Analytics.Settings.logDarkModeEnabled();
    }
    this.setDarkMode(!this.isDarkModeOn);
  }

  isInsideWinscopeProxyFrame(): boolean {
    // NOTE: Technically anyone can pass whatever they want as the origin parameter,
    // but that is fine; in those cases we would just show a settings button that does nothing,
    // because we would fail posting the message due to origin check failures.
    const reportedParentOrigin = this.getReportedParentOrigin();
    if (
      !reportedParentOrigin ||
      !this.isSupportedReportedParentOrigin(reportedParentOrigin)
    ) {
      return false;
    }

    try {
      return window.self !== window.top;
    } catch (e) {
      getLogger('AppComponent').error(
        'Error checking if inside Winscope proxy frame',
        e,
      );
      // Catch potential cross-origin errors when accessing window.top
      return true;
    }
  }

  getReportedParentOrigin(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('parentOrigin');
  }

  getReportedRequest(): RequestData | undefined {
    const urlParams = new URLSearchParams(window.location.search);
    const request = urlParams.get('request');
    if (request == null) {
      return undefined;
    }
    return JSON.parse(atob(request));
  }

  isSupportedReportedParentOrigin(parentOrigin: string): boolean {
    return isAllowedIframeParentOrigin(parentOrigin);
  }

  openSettings() {
    const parentOrigin = this.getReportedParentOrigin();
    const logger = getLogger('AppComponent');

    if (parentOrigin == null) {
      logger.warn(
        "Provided 'parentOrigin' is null cannot send request to open settings menu",
      );
      return;
    }

    // Check if inside an iframe
    if (
      this.isInsideWinscopeProxyFrame() &&
      this.isSupportedReportedParentOrigin(parentOrigin)
    ) {
      // Send message to the parent window
      const data = JSON.stringify({action: 'openSettings'});
      window.parent.postMessage(data, parentOrigin);
    } else {
      logger.warn(
        'Not inside an iframe...',
        window.self.origin,
        window.top?.origin,
      );
    }
  }

  hasBookmarksToShare(): boolean {
    return (this.timelineComponent()?.bookmarks?.length ?? 0) > 0;
  }

  hasTimestampToShare(): boolean {
    return this.mediator.getCurrentTimestamp() !== undefined;
  }

  hasQueriesToShare(): boolean {
    return this.getTraceSearchQueries().length > 0;
  }

  updateShareState() {
    this.updateShareOptionsVisibility();
    this.updateShareLink();
  }

  getTraceSearchQueries(): string[] {
    return (
      this.viewers
        .find((v) => v instanceof ViewerSearch)
        ?.getTraces()
        .flatMap((t) => t.getDescriptors()) ?? []
    );
  }

  updateShareLink() {
    const selectedOptions = Object.entries(this.shareOptions)
      .filter(([_key, value]) => value)
      .map(([key, _value]) => key);

    if (selectedOptions.length === 0) {
      this.generatedShareLink = '';
      return;
    }

    const originalRequest = this.getReportedRequest();

    const newRequest: RequestData = {
      artifacts: [],
    };

    if (originalRequest && originalRequest.artifacts) {
      newRequest.artifacts = originalRequest.artifacts;
    }

    if (originalRequest && originalRequest.testMode) {
      newRequest.testMode = originalRequest.testMode;
    }

    if (this.shareOptions.location) {
      newRequest.timestamp = this.mediator
        .getCurrentTimestamp()
        ?.getValueNs()
        .toString();
      newRequest.traceType = this.mediator.getActiveTraceType();
    }

    if (this.shareOptions.searchQueries) {
      const searchQueries = this.getTraceSearchQueries();
      if (searchQueries.length > 0) {
        newRequest.searchQueries = searchQueries;
      }
    }

    if (this.shareOptions.bookmarks) {
      const bookmarks =
        this.timelineComponent()?.bookmarks.map((bookmark) =>
          bookmark.getValueNs().toString(),
        ) ?? [];
      if (bookmarks.length > 0) {
        newRequest.bookmarks = bookmarks;
      }
    }

    const params = new URLSearchParams();
    params.set('request', btoa(JSON.stringify(newRequest)));

    const baseUrl = this.getReportedParentOrigin() || getRootUrl();
    this.generatedShareLink = `${baseUrl}?${params.toString()}`;
  }

  allTracesAreDumps(): boolean {
    for (const trace of this.timelineData.getTraces()) {
      if (!trace.isDump()) {
        return false;
      }
    }
    return true;
  }

  showCrossToolSyncButton(): boolean {
    return this.crossToolProtocol.isAllowedTimestampSync();
  }

  getCrossToolSyncTooltip(): string {
    const currStatus = this.crossToolProtocol.getAllowTimestampSync();

    return `Cross Tool Sync ${this.translateStatus(
      currStatus,
    )} (Click to turn ${this.translateStatus(!currStatus)})`;
  }

  onCrossToolSyncButtonClick() {
    this.crossToolProtocol.setAllowTimestampSync(
      !this.crossToolProtocol.getAllowTimestampSync(),
    );
    Analytics.Settings.logCrossToolSync(
      this.crossToolProtocol.getAllowTimestampSync(),
    );
  }

  getCrossToolSyncButtonColor(): string {
    return this.crossToolProtocol.getAllowTimestampSync()
      ? 'primary'
      : 'accent';
  }

  getTraceTypesWithParsingErrors(): Map<TraceType, ParsingErrorType> {
    return this.loadedFileData.getTraceTypesWithParsingErrors();
  }

  combinedWarning(): string | undefined {
    const packetLoss = this.packetLossWarning();
    const traceProcessorError = this.traceProcessorErrorWarning();
    if (packetLoss === undefined && traceProcessorError === undefined) {
      return undefined;
    }

    let combinedWarning = '';
    if (packetLoss !== undefined) {
      combinedWarning += packetLoss;
    }

    if (traceProcessorError !== undefined) {
      if (combinedWarning.length > 0) {
        combinedWarning += ' and ';
        combinedWarning +=
          traceProcessorError[0].toLowerCase() + traceProcessorError.slice(1);
      } else {
        combinedWarning += traceProcessorError;
      }
    } else {
      combinedWarning += ' - data may be incomplete';
    }

    return combinedWarning;
  }

  async showFileSelectionDialog(filenames: string[]) {
    await new Promise<void>((resolve) => {
      this.ngZone.run(() => {
        const data: WarningDialogData = {
          message: `Multiple Perfetto traces found. Select one to process:`,
          actions: [],
          options: filenames,
          closeText: 'Process selected trace',
          singleSelection: true,
        };
        const dialogRef = this.dialog.open(WarningDialogComponent, {
          data,
          disableClose: true,
          panelClass: 'warning-panel',
        });
        dialogRef
          .beforeClosed()
          .subscribe(async (result: WarningDialogResult | undefined) => {
            await this.mediator.onWinscopeEvent(
              new BugreportFileSelected(result?.selectedOptions[0]),
            );
            resolve();
          });
      });
    });
  }

  private packetLossWarning(): string | undefined {
    const lostPerfettoPackets = this.loadedFileData.getLostPerfettoPackets();
    if (lostPerfettoPackets === 0) {
      return undefined;
    }
    return `${lostPerfettoPackets} Perfetto packet${
      lostPerfettoPackets > 1 ? 's' : ''
    } lost during tracing`;
  }

  private traceProcessorErrorWarning(): string | undefined {
    const traceTypesWithParsingErrors =
      this.loadedFileData.getTraceTypesWithParsingErrors();
    if (traceTypesWithParsingErrors.size === 0) {
      return undefined;
    }

    for (const [_, errorType] of traceTypesWithParsingErrors) {
      if (errorType === ParsingErrorType.DATA_INCORRECT) {
        return `Trace processor errors occurred - data may be incorrect`;
      }
    }
    return `Trace processor errors occurred - data may be incomplete`;
  }

  private async onViewersLoaded(event: ViewersLoaded) {
    this.viewers = event.viewers;
    this.initialTimelineTabTraceType = event.initialTimelineTabTraceType;
    this.filenameFormControl.setValue(
      this.loadedFileData.getDownloadArchiveFilename(),
    );
    this.pageTitle.setTitle(`Winscope | ${this.filenameFormControl.value}`);
    this.isEditingFilename = false;

    // some elements e.g. timeline require dataLoaded to be set outside NgZone to render
    this.dataLoaded = true;
    this.changeDetectorRef.detectChanges();

    // tooltips must be rendered inside ngZone due to limitation of MatTooltip,
    // therefore toolbar elements controlled by a different boolean
    this.ngZone.run(() => {
      this.showDataLoadedElements = true;
    });
    this.updateShareState();

    await this.processRequestData();
  }

  private async onViewersUnloaded() {
    this.loadedFileData.onDestroy();
    this.loadedFileData = this.createNewLoadedFileData();
    this.timelineData = new TimelineData();
    this.mediator = new Mediator(
      this.loadedFileData,
      this.timelineData,
      this.abtChromeExtensionProtocol,
      this.crossToolProtocol,
      this,
      new PersistentStore(),
    );

    this.dataLoaded = false;
    this.showDataLoadedElements = false;
    this.pageTitle.setTitle('Winscope');
    this.changeDetectorRef.detectChanges();
    this.updateShareState();
    this.setComponentsToMediator();
  }

  private setComponentsToMediator() {
    this.mediator.setUploadTracesComponent(this.uploadTracesComponent());
    this.mediator.setCollectTracesComponent(this.collectTracesComponent());
    this.mediator.setTraceViewComponent(this.traceViewComponent());
    this.mediator.setTimelineComponent(this.timelineComponent());
  }

  private async onBugreportFileSelectionRequest(
    event: BugreportFileSelectionRequest,
  ) {
    await this.showFileSelectionDialog(event.filenames);
  }

  private async processRequestData() {
    const request = this.getReportedRequest();
    if (!request) {
      return;
    }

    const timelineComponent = this.timelineComponent();
    if (request.bookmarks && timelineComponent) {
      const converter = this.timelineData.getTimestampConverter();
      if (converter) {
        timelineComponent.bookmarks = request.bookmarks.map((b) =>
          converter.makeTimestampFromNs(BigInt(b)),
        );
        await this.mediator.onWinscopeEvent(
          new BookmarksChanged(timelineComponent.bookmarks),
        );
      }
    }

    if (request.timestamp) {
      const converter = this.timelineData.getTimestampConverter();
      const timestamp = converter?.makeTimestampFromNs(
        BigInt(request.timestamp),
      );
      if (timestamp) {
        const position =
          this.timelineData.makePositionFromActiveTrace(timestamp);
        await this.mediator.onWinscopeEvent(
          new TracePositionUpdate(position, true),
        );
      }
    }

    if (request.searchQueries) {
      for (const query of request.searchQueries) {
        await this.mediator.onWinscopeEvent(new TraceSearchRequest(query));
      }
    }

    if (request.traceType) {
      const trace = this.loadedFileData.getTraces().getTrace(request.traceType);
      if (trace) {
        await this.mediator.onWinscopeEvent(new TabbedViewSwitchRequest(trace));
      }
    }
  }

  private updateShareOptionsVisibility() {
    this.canShareLocation = this.hasTimestampToShare();
    this.canShareBookmarks = this.hasBookmarksToShare();
    this.canShareQueries = this.hasQueriesToShare();
    this.showShareOptionsContainer =
      this.canShareLocation || this.canShareBookmarks || this.canShareQueries;
  }

  private goToLink(url: string) {
    window.open(url, '_blank');
  }

  private translateStatus(status: boolean) {
    return status ? 'ON' : 'OFF';
  }

  private downloadTraces(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    this.downloadRequest(url, filename);
  }

  private createNewLoadedFileData(): LoadedFileData {
    const loadedFileData = new LoadedFileData();
    this.crossToolProtocol.updateTimestampConverter(
      loadedFileData.getTimestampConverter(),
    );
    return loadedFileData;
  }
}

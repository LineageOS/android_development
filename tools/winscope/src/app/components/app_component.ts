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

import {ViewerSearch} from '@viewers/viewer_search/viewer_search';
import {CommonModule} from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ErrorHandler,
  Inject,
  Injector,
  NgZone,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {createCustomElement} from '@angular/elements';
import {FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatDividerModule} from '@angular/material/divider';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatTooltipModule} from '@angular/material/tooltip';
import {Title} from '@angular/platform-browser';
import {AbtChromeExtensionProtocol} from '@abt_chrome_extension/abt_chrome_extension_protocol';
import {GlobalErrorHandler} from '@app/global_error_handler';
import {Mediator} from '@app/mediator';
import {TimelineData} from '@app/timeline_data';
import {TracePipeline} from '@app/trace_pipeline';
import {DownloadRequest, downloadFromUrl} from '@common/download';
import {DOWNLOAD_FILENAME_REGEX} from '@common/io';
import {globalConfig} from '@common/global_config';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {PersistentStore} from '@common/store/persistent_store';
import {Store} from '@common/store/store';
import {Timestamp} from '@common/time/time';
import {getRootUrl} from '@common/window';
import {CrossToolProtocol} from '@cross_tool/cross_tool_protocol';
import {Analytics} from '@logging/analytics';
import {ProgressListener} from '@messaging/progress_listener';
import {
  AppFilesCollected,
  AppFilesUploaded,
  AppInitialized,
  AppRefreshDumpsRequest,
  AppResetRequest,
  AppTraceViewRequest,
} from '@app/app_events';
import {
  ActiveSearchQueriesUpdate,
  BookmarksChanged,
  BugreportFileSelected,
  BugreportFileSelectionRequest,
  DarkModeToggled,
} from '@app/misc_events';
import {TabbedViewSwitchRequest} from '@app/tabbed_view_events';
import {
  ActiveTraceChanged,
  TracePositionUpdate,
  TraceSearchRequest,
} from '@trace/trace_events';
import {ViewersLoaded, ViewersUnloaded} from '@app/viewers_events';
import {WinscopeEvent} from '@messaging/winscope_event';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {UserNotifier} from '@services/user_notifier';
import {AdbFiles} from '@trace_collection/adb_files';
import {ViewerInputMethodComponent} from '@viewers/components/viewer_input_method_component';
import {Viewer} from '@viewers/viewer';
import {ViewerInputComponent} from '@viewers/viewer_input/viewer_input_component';
import {ViewerJankCujsComponent} from '@viewers/viewer_jank_cujs/viewer_jank_cujs_component';
import {ViewerMediaBasedComponent} from '@viewers/viewer_media_based/viewer_media_based_component';
import {ViewerProtologComponent} from '@viewers/viewer_protolog/viewer_protolog_component';
import {ViewerSearchComponent} from '@viewers/viewer_search/viewer_search_component';
import {ViewerSurfaceFlingerComponent} from '@viewers/viewer_surface_flinger/viewer_surface_flinger_component';
import {ViewerTransactionsComponent} from '@viewers/viewer_transactions/viewer_transactions_component';
import {ViewerTransitionsComponent} from '@viewers/viewer_transitions/viewer_transitions_component';
import {ViewerViewCaptureComponent} from '@viewers/viewer_view_capture/viewer_view_capture_component';
import {ViewerWindowManagerComponent} from '@viewers/viewer_window_manager/viewer_window_manager_component';
import {isAllowedIframeParentOrigin} from '@cross_tool/origin_allow_list';
import {
  MatDrawer,
  MatDrawerContainer,
  MatDrawerContent,
} from './bottomnav/bottom_drawer_component';
import {CollectTracesComponent} from './collect_traces_component';
import {ShortcutsComponent} from './shortcuts_component';
import {SnackBarOpener} from './snack_bar_opener';
import {TimelineComponent} from './timeline/timeline_component';
import {TraceViewComponent} from './trace_view_component';
import {UploadTracesComponent} from './upload_traces_component';
import {
  WarningDialogComponent,
  WarningDialogData,
  WarningDialogResult,
} from './warning_dialog_component';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatMenuModule} from '@angular/material/menu';
import {ClipboardModule} from '@angular/cdk/clipboard';
import {FormsModule} from '@angular/forms';
import {RequestData} from '@cross_tool/g3_proxy';
import {getLogger} from '@compat/logging';
import {FileReader} from '@trace_api/file_reader';

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
  styleUrls: ['app_component.css'],
})
export class AppComponent implements WinscopeEventListener {
  title = 'winscope';
  timelineData = new TimelineData();
  abtChromeExtensionProtocol = new AbtChromeExtensionProtocol();
  crossToolProtocol: CrossToolProtocol;
  dataLoaded = false;
  showDataLoadedElements = false;
  isBeta = /beta(_[a-z]+)?\/index\.html/.test(window.location.href);
  collapsedTimelineHeight = 0;
  isEditingFilename = false;
  persistentStore = new PersistentStore();
  viewers: Viewer[] = [];
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
  tracePipeline: TracePipeline;
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

  @ViewChild(UploadTracesComponent)
  uploadTracesComponent?: UploadTracesComponent;
  @ViewChild(CollectTracesComponent)
  collectTracesComponent?: CollectTracesComponent;
  @ViewChild(TraceViewComponent) traceViewComponent?: TraceViewComponent;
  @ViewChild(TimelineComponent) timelineComponent?: TimelineComponent;

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
    this.tracePipeline = new TracePipeline();
    this.crossToolProtocol = new CrossToolProtocol(
      this.tracePipeline.getTimestampConverter(),
    );
    this.mediator = new Mediator(
      this.tracePipeline,
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

    if (!customElements.get('viewer-input-method')) {
      customElements.define(
        'viewer-input-method',
        createCustomElement(ViewerInputMethodComponent, {injector}),
      );
    }
    if (!customElements.get('viewer-protolog')) {
      customElements.define(
        'viewer-protolog',
        createCustomElement(ViewerProtologComponent, {injector}),
      );
    }
    if (!customElements.get('viewer-media-based')) {
      customElements.define(
        'viewer-media-based',
        createCustomElement(ViewerMediaBasedComponent, {injector}),
      );
    }
    if (!customElements.get('viewer-surface-flinger')) {
      customElements.define(
        'viewer-surface-flinger',
        createCustomElement(ViewerSurfaceFlingerComponent, {injector}),
      );
    }
    if (!customElements.get('viewer-transactions')) {
      customElements.define(
        'viewer-transactions',
        createCustomElement(ViewerTransactionsComponent, {injector}),
      );
    }
    if (!customElements.get('viewer-window-manager')) {
      customElements.define(
        'viewer-window-manager',
        createCustomElement(ViewerWindowManagerComponent, {injector}),
      );
    }
    if (!customElements.get('viewer-transitions')) {
      customElements.define(
        'viewer-transitions',
        createCustomElement(ViewerTransitionsComponent, {injector}),
      );
    }
    if (!customElements.get('viewer-view-capture')) {
      customElements.define(
        'viewer-view-capture',
        createCustomElement(ViewerViewCaptureComponent, {injector}),
      );
    }
    if (!customElements.get('viewer-jank-cujs')) {
      customElements.define(
        'viewer-jank-cujs',
        createCustomElement(ViewerJankCujsComponent, {injector}),
      );
    }
    if (!customElements.get('viewer-input')) {
      customElements.define(
        'viewer-input',
        createCustomElement(ViewerInputComponent, {injector}),
      );
    }
    if (!customElements.get('viewer-search')) {
      customElements.define(
        'viewer-search',
        createCustomElement(ViewerSearchComponent, {injector}),
      );
    }

    this.appStorage =
      globalConfig.MODE === 'PROD'
        ? new PersistentStore()
        : new InMemoryStorage();

    window.onunhandledrejection = (evt) => {
      Analytics.Error.logGlobalException(evt.reason);
    };
  }

  async ngAfterViewInit() {
    await this.mediator.onWinscopeEvent(new AppInitialized());
  }

  ngAfterViewChecked() {
    this.mediator.setUploadTracesComponent(this.uploadTracesComponent);
    this.mediator.setCollectTracesComponent(this.collectTracesComponent);
    this.mediator.setTraceViewComponent(this.traceViewComponent);
    this.mediator.setTimelineComponent(this.timelineComponent);
  }

  onRemoveTrace(reader: FileReader) {
    this.tracePipeline.removeFileReader(reader);
    if (this.tracePipeline?.getLoadedFileReaders().length === 0) {
      this.onRemoveAllTraces();
    }
  }

  onRemoveAllTraces() {
    this.tracePipeline.onDestroy();
    this.tracePipeline = this.createNewTracePipeline();
    this.mediator.setTracePipeline(this.tracePipeline);
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
      await this.tracePipeline.makeZipArchiveWithLoadedTraceFiles(
        (perc: number) => {
          progressListener.onProgressUpdate('Downloading', 90 * perc);
        },
      );
    const archiveFilename = `${
      this.showDataLoadedElements
        ? this.filenameFormControl.value
        : this.tracePipeline.getDownloadArchiveFilename()
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
    await this.mediator.onWinscopeEvent(new AppRefreshDumpsRequest());
  }

  async onUploadNewButtonClick() {
    await this.mediator.onWinscopeEvent(new AppResetRequest());
    this.persistentStore.clear('treeView');
  }

  async onViewTracesButtonClick(discardLegacyTraces: boolean) {
    await this.mediator.onWinscopeEvent(
      new AppTraceViewRequest(discardLegacyTraces),
    );
  }

  onProgressUpdate(message: string, progressPercentage: number | undefined) {
    this.ngZone.run(() => {
      this.downloadProgress = progressPercentage;
    });
  }

  onOperationFinished(success: boolean) {
    this.ngZone.run(() => {
      this.downloadProgress = undefined;
    });
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case ViewersLoaded:
        return await this.onViewersLoaded(event as ViewersLoaded);
      case ViewersUnloaded:
        return await this.onViewersUnloaded(event as ViewersUnloaded);
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
    return (this.timelineComponent?.bookmarks?.length ?? 0) > 0;
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
        this.timelineComponent?.bookmarks.map((bookmark) =>
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

  packetLossWarning(): string | undefined {
    const lostPackets = this.tracePipeline.lostPackets();
    if (lostPackets === 0) {
      return undefined;
    }
    return `${lostPackets} Perfetto packet${
      lostPackets > 1 ? 's' : ''
    } lost during tracing - data may be incomplete`;
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

  private async onViewersLoaded(event: ViewersLoaded) {
    this.viewers = event.viewers;
    this.filenameFormControl.setValue(
      this.tracePipeline.getDownloadArchiveFilename(),
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

  private async onViewersUnloaded(event: ViewersUnloaded) {
    this.tracePipeline.onDestroy();
    this.tracePipeline = this.createNewTracePipeline();
    this.timelineData = new TimelineData();
    this.mediator = new Mediator(
      this.tracePipeline,
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

    if (request.bookmarks && this.timelineComponent) {
      const converter = this.timelineData.getTimestampConverter();
      if (converter) {
        this.timelineComponent.bookmarks = request.bookmarks.map((b) =>
          converter.makeTimestampFromNs(BigInt(b)),
        );
        await this.mediator.onWinscopeEvent(
          new BookmarksChanged(this.timelineComponent.bookmarks),
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
      const trace = this.tracePipeline.getTraces().getTrace(request.traceType);
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

  private createNewTracePipeline(): TracePipeline {
    const tracePipeline = new TracePipeline();
    this.crossToolProtocol.updateTimestampConverter(
      tracePipeline.getTimestampConverter(),
    );
    return tracePipeline;
  }
}

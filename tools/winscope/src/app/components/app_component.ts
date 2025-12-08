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
import {AbtChromeExtensionProtocol} from 'abt_chrome_extension/abt_chrome_extension_protocol';
import {GlobalErrorHandler} from 'app/global_error_handler';
import {Mediator} from 'app/mediator';
import {TimelineData} from 'app/timeline_data';
import {TracePipeline} from 'app/trace_pipeline';
import {DownloadRequest, downloadFromUrl} from 'common/download';
import {DOWNLOAD_FILENAME_REGEX} from 'common/io';
import {globalConfig} from 'common/global_config';
import {InMemoryStorage} from 'common/store/in_memory_storage';
import {PersistentStore} from 'common/store/persistent_store';
import {Store} from 'common/store/store';
import {Timestamp} from 'common/time/time';
import {getRootUrl} from 'common/window';
import {CrossToolProtocol} from 'cross_tool/cross_tool_protocol';
import {Analytics} from 'logging/analytics';
import {ProgressListener} from 'messaging/progress_listener';
import {
  AppFilesCollected,
  AppFilesUploaded,
  AppInitialized,
  AppRefreshDumpsRequest,
  AppResetRequest,
  AppTraceViewRequest,
  BugreportFileSelected,
  DarkModeToggled,
  WinscopeEvent,
  WinscopeEventType,
} from 'messaging/winscope_event';
import {WinscopeEventListener} from 'messaging/winscope_event_listener';
import {UserNotifier} from 'services/user_notifier';
import {AdbFiles} from 'trace_collection/adb_files';
import {iconDividerStyle} from 'viewers/components/styles/icon_divider.styles';
import {ViewerInputMethodComponent} from 'viewers/components/viewer_input_method_component';
import {Viewer} from 'viewers/viewer';
import {ViewerInputComponent} from 'viewers/viewer_input/viewer_input_component';
import {ViewerJankCujsComponent} from 'viewers/viewer_jank_cujs/viewer_jank_cujs_component';
import {ViewerMediaBasedComponent} from 'viewers/viewer_media_based/viewer_media_based_component';
import {ViewerProtologComponent} from 'viewers/viewer_protolog/viewer_protolog_component';
import {ViewerSearchComponent} from 'viewers/viewer_search/viewer_search_component';
import {ViewerSurfaceFlingerComponent} from 'viewers/viewer_surface_flinger/viewer_surface_flinger_component';
import {ViewerTransactionsComponent} from 'viewers/viewer_transactions/viewer_transactions_component';
import {ViewerTransitionsComponent} from 'viewers/viewer_transitions/viewer_transitions_component';
import {ViewerViewCaptureComponent} from 'viewers/viewer_view_capture/viewer_view_capture_component';
import {ViewerWindowManagerComponent} from 'viewers/viewer_window_manager/viewer_window_manager_component';
import {OriginAllowList} from 'cross_tool/origin_allow_list';
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
import {RequestData} from 'cross_tool/g3_proxy';

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
    ShortcutsComponent,
    WarningDialogComponent,
  ],
  providers: [Title, {provide: ErrorHandler, useClass: GlobalErrorHandler}],
  template: `
    <mat-toolbar class="toolbar">
      <div class="horizontal-align vertical-align fixed logo">
        <img class="app-title" [src]="getLogoUrl()"/>
        @if (isBeta) {
          <span class="beta-tag">BETA</span>
        }
      </div>

      <div class="horizontal-align vertical-align icon-actions small-icon-container">
        @if (showDataLoadedElements) {
          @let packetLoss = packetLossWarning();
          @let showFileWarningStyle = downloadProgress === undefined
            && !isEditingFilename
            && packetLoss !== undefined;
          <div class="download-files-section">
            <div
              class="file-descriptor vertical-align"
              [class.file-warning]="showFileWarningStyle">
              @if (showCrossToolSyncButton()) {
                <button
                  mat-icon-button
                  [matTooltip]="getCrossToolSyncTooltip()"
                  class="cross-tool-sync-button"
                  (click)="onCrossToolSyncButtonClick()"
                  [color]="getCrossToolSyncButtonColor()">
                  <mat-icon class="material-symbols-outlined">cloud_sync</mat-icon>
                </button>
              }
              @if (packetLoss !== undefined) {
                <mat-icon
                  [matTooltip]="packetLoss"
                  class="warning-icon fixed">warning</mat-icon>
              }
              @if (!isEditingFilename) {
                <span class="download-file-info text-no-overflow mat-body-2">
                  {{ filenameFormControl.value }}
                </span>
              }
              @if (!isEditingFilename) {
                <span class="download-file-ext mat-body-2">.zip</span>
              }
              @if (isEditingFilename) {
                <mat-form-field
                  class="file-name-input-field"
                  subscriptSizing="dynamic"
                  floatLabel="always"
                  (keydown.esc)="trySubmitFilename()"
                  (keydown.enter)="trySubmitFilename()"
                  (focusout)="trySubmitFilename()"
                  matTooltip="Allowed: A-Z a-z 0-9 . _ - #">
                  <mat-label>Edit file name</mat-label>
                  <input matInput class="right-align" [formControl]="filenameFormControl" />
                  <span matTextSuffix>.zip</span>
                </mat-form-field>
              }
              @if (isEditingFilename) {
                <button
                  mat-icon-button
                  class="check-button"
                  matTooltip="Submit file name"
                  (click)="trySubmitFilename()">
                  <mat-icon>check</mat-icon>
                </button>
              }
              @if (!isEditingFilename) {
                <button
                  mat-icon-button
                  class="edit-button"
                  matTooltip="Edit file name"
                  (click)="onPencilIconClick()">
                  <mat-icon>edit</mat-icon>
                </button>
              }
              <button
                mat-icon-button
                [disabled]="isEditingFilename"
                matTooltip="Download all traces"
                class="save-button"
                (click)="onDownloadTracesButtonClick()">
                <mat-icon class="material-symbols-outlined">download</mat-icon>
              </button>
            </div>
            @if (downloadProgress !== undefined) {
              <mat-progress-bar
                mode="determinate"
                [value]="downloadProgress">
              </mat-progress-bar>
            }
          </div>
        }

        @if (showDataLoadedElements) {
          <div class="icon-divider toolbar-icon-divider"></div>
        }
        @if (showDataLoadedElements && allTracesAreDumps()) {
          <button
            color="primary"
            mat-icon-button
            matTooltip="Refresh dumps"
            class="refresh-dumps"
            (click)="onRefreshDumpsButtonClick()">
            <mat-icon class="material-symbols-outlined">refresh</mat-icon>
          </button>
        }
        @if (showDataLoadedElements) {
          <button
            mat-icon-button
            matTooltip="Upload or collect new trace"
            class="upload-new"
            (click)="onUploadNewButtonClick()">
            <mat-icon class="material-symbols-outlined">upload</mat-icon>
          </button>
        }

        <button
          mat-icon-button
          matTooltip="Shortcuts"
          class="shortcuts"
          (click)="openShortcutsPanel()">
          <mat-icon>keyboard_command_key</mat-icon>
        </button>

        <button
          mat-icon-button
          matTooltip="Documentation"
          class="documentation"
          (click)="goToDocumentation()">
          <mat-icon>menu_book</mat-icon>
        </button>

        <button
          mat-icon-button
          class="report-bug"
          matTooltip="Report bug"
          (click)="goToBuganizer()">
          <mat-icon>bug_report</mat-icon>
        </button>

        <button
          mat-icon-button
          class="dark-mode"
          matTooltip="Switch to {{ isDarkModeOn ? 'light' : 'dark' }} mode"
          (click)="toggleDarkMode()">
          <mat-icon>
            {{ isDarkModeOn ? 'brightness_5' : 'brightness_4' }}
          </mat-icon>
        </button>

        <div class="share-btn-wrapper" matTooltip="Share functionality is not available for the provided traces" [matTooltipDisabled]="isInsideWinscopeProxyFrame()">
          <button
            mat-icon-button
            matTooltip="Share"
            class="share-btn"
            [disabled]="!isInsideWinscopeProxyFrame()"
            [matMenuTriggerFor]="shareMenu">
            <mat-icon>share</mat-icon>
          </button>
        </div>
        <mat-menu #shareMenu="matMenu" (click)="$event.stopPropagation()">
          <div class="share-menu-content" (click)="$event.stopPropagation()">
            <div class="share-link-container">
              <mat-form-field class="share-link-field" subscriptSizing="dynamic">
                <mat-label>Shareable link</mat-label>
                <input matInput readonly [value]="generatedShareLink">
              </mat-form-field>

              <button mat-icon-button [cdkCopyToClipboard]="generatedShareLink" matTooltip="Copy link" [disabled]="!generatedShareLink">
                <mat-icon>content_copy</mat-icon>
              </button>
            </div>
          </div>
        </mat-menu>

        @if (isInsideWinscopeProxyFrame()) {
          <button
            mat-icon-button
            class="iframe-settings"
            matTootltip="Settings"
            (click)="openSettings()">
            <mat-icon>settings</mat-icon>
          </button>
        }
      </div>
    </mat-toolbar>

    <mat-divider></mat-divider>

    <mat-drawer-container
      autosize
      disableClose
      autoFocus
      style.background="var(--background-color)">
      <mat-drawer-content>
        @if (dataLoaded) {
          <trace-view class="viewers" [viewers]="viewers" [store]="persistentStore"></trace-view>

          <mat-divider></mat-divider>
        } @else {
          <div class="center">
            <div class="landing-content">
              <h1 class="welcome-info mat-headline-1">
                Welcome to Winscope. Please select source to view traces.
              </h1>

              <div class="card-grid landing-grid">
                <collect-traces
                  class="collect-traces-card homepage-card"
                  [storage]="appStorage"
                  (filesCollected)="onFilesCollected($event)"></collect-traces>

                <upload-traces
                  #uploadTraces
                  class="upload-traces-card homepage-card"
                  [tracePipeline]="tracePipeline"
                  [storage]="appStorage"
                  (filesUploaded)="onFilesUploaded($event)"
                  (viewTracesButtonClick)="onViewTracesButtonClick($event)"
                  (downloadTracesClick)="onDownloadTracesButtonClick(uploadTraces)"></upload-traces>
              </div>
            </div>
          </div>
        }
      </mat-drawer-content>

      <mat-drawer #drawer mode="overlay" opened="true" [baseHeight]="collapsedTimelineHeight">
        @if (dataLoaded) {
          <timeline
            [allTraces]="tracePipeline.getTraces()"
            [timelineData]="timelineData"
            [store]="persistentStore"
            [initialTabTraceType]="mediator.initialTimelineTabTraceType"
            (collapsedTimelineSizeChanged)="onCollapsedTimelineSizeChanged($event)"></timeline>
        }
      </mat-drawer>
    </mat-drawer-container>
  `,
  styles: [
    `
      .toolbar {
        gap: 10px;
        justify-content: space-between;
      }
      .logo {
        height: 50%;
      }
      .app-title {
        height: 100%;
      }
      .beta-tag {
        font-size: 0.5rem;
        margin-left: 0.1rem;
        color: var(--logo-blue);
        font-weight: 800;
        line-height: normal;
        height: 100%;
      }
      .welcome-info {
        margin: 16px 0 6px 0;
        text-align: center;
      }
      .homepage-card {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow: auto;
        height: 870px;
      }
      .horizontal-align {
        justify-content: center;
      }
      .vertical-align {
        text-align: center;
        align-items: center;
        overflow-x: hidden;
        display: flex;
      }
      .fixed {
        min-width: fit-content;
      }
      .icon-actions {
        height: 100%;
      }

      .download-files-section {
        overflow-x: hidden;
      }
      .file-descriptor {
        font-size: 14px;
        padding-left: 10px;
        max-width: 750px;
        height: 100%;
      }
      .file-warning  {
        border: solid 2px var(--warning-color);
        background: var(--warning-background-color);
      }
      .file-descriptor .warning-icon {
        padding-inline-end: 4px;
      }
      .download-file-info {
        padding-top: 3px;
        max-width: 650px;
      }
      .download-file-ext {
        padding-top: 3px;
      }
      .file-name-input-field .right-align {
        text-align: right;
      }
      .file-name-input-field .mat-mdc-text-field-wrapper {
        width: 600px;
        max-width: 100%;
      }
      .toolbar-icon-divider {
        margin-right: 6px;
        margin-left: 6px;
        height: 20px;
      }
      .viewers {
        height: 0;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        overflow: auto;
      }
      .center {
        display: flex;
        align-content: center;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        justify-items: center;
        flex-grow: 1;
        background-color: var(--background-color);
      }
      .landing-content {
        width: 100%;
      }
      .landing-content .card-grid {
        max-width: 1800px;
        flex-grow: 1;
        margin: auto;
      }

      .share-menu-content {
        padding: 16px;
        display: flex;
        flex-direction: column;
      }
      .share-menu-content mat-checkbox {
        margin-bottom: 8px;
      }
      .share-link-container {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
      }
      .share-link-field {
        flex-grow: 1;
      }
    `,
    iconDividerStyle,
  ],
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
    UserNotifier.setSnackBarOpener(snackbarOpener);
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

    this.updateShareLink();

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
    await event.visit(WinscopeEventType.VIEWERS_LOADED, async (event) => {
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
    });

    await event.visit(WinscopeEventType.VIEWERS_UNLOADED, async (event) => {
      this.dataLoaded = false;
      this.showDataLoadedElements = false;
      this.pageTitle.setTitle('Winscope');
      this.changeDetectorRef.detectChanges();
    });

    await event.visit(
      WinscopeEventType.BUGREPORT_FILE_SELECTION_REQUEST,
      async (event) => {
        await this.showFileSelectionDialog(event.filenames);
      },
    );
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
    return OriginAllowList.isAllowedIframeParentOrigin(parentOrigin);
  }

  openSettings() {
    const parentOrigin = this.getReportedParentOrigin();

    if (parentOrigin == null) {
      console.warn(
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
      window.parent.postMessage({winscopeAction: 'openSettings'}, parentOrigin);
    } else {
      console.warn(
        'Not inside an iframe...',
        window.self.origin,
        window.top?.origin,
      );
    }
  }

  updateShareLink() {
    const originalRequest = this.getReportedRequest();

    const newRequest: RequestData = {
      artifacts: [],
    };
    if (originalRequest && originalRequest.artifacts) {
      newRequest.artifacts = originalRequest.artifacts;
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
    return this.crossToolProtocol.isConnected();
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
}

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

import {TraceSearchInitializer} from '@app/search/trace_search_initializer';
import {ViewerFactory} from '@app/viewer_factory';
import {assertDefined} from '@common/assert';
import {Store} from '@common/store/store';
import {Timestamp} from '@common/time/time';
import {Timer} from '@common/time/timer';
import {getLogger, Logger} from '@compat/logging';
import {CrossToolProtocol} from '@cross_tool/cross_tool_protocol';
import {RemoteToolDownloadStart, RemoteToolFilesReceived, RemoteToolInitialized, RemoteToolTimestampReceived, RemoteToolWaitingForFiles,} from '@cross_tool/remote_tool_events';
import {Analytics} from '@logging/analytics';
import {ProgressListener} from '@messaging/progress_listener';
import {UserWarning} from '@messaging/user_warning';
import {WinscopeEvent} from '@messaging/winscope_event';
import {WinscopeEventEmitter} from '@messaging/winscope_event_emitter';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {UserNotifier} from '@services/user_notifier';
import {FilesSource} from '@trace_api/files_source';
import {PlaybackPrefetchedEntries} from '@trace_api/playback_prefetched_entries';
import {Trace} from '@trace_api/trace';
import {ActiveTraceChanged, InitializeTraceSearchRequest, ScreenRecordingChange, ShowTraceUploadWarning, TraceAddRequest, TracePositionUpdate, TraceRemoveRequest, TraceSearchCompleted, TraceSearchFailed, TraceSearchInitialized, TraceSearchRequest,} from '@trace_api/trace_events';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TracePosition} from '@trace_api/trace_position';
import {TraceType} from '@trace_api/trace_type';
import {RequestedTraceTypes} from '@trace_collection/adb_files';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {AppFilesCollected, AppFilesUploaded, AppInitialized, AppRefreshDumpsRequest, AppResetRequest, AppTraceViewRequest, AppTraceViewRequestHandled,} from '@ui/shared/events/app_events';
import {ActiveSearchQueriesUpdate, BookmarksChanged, BugreportFileSelected, BugreportFileSelectionRequest, DarkModeToggled, FilterPresetApplyRequest, FilterPresetSaveRequest, NoTraceTargetsSelectedEvent,} from '@ui/shared/events/misc_events';
import {TabbedViewSwitched, TabbedViewSwitchRequest,} from '@ui/shared/events/tabbed_view_events';
import {PlaybackSpeedChange, PlaybackStateChangeHandled, PlaybackStateChangeRequest,} from '@ui/shared/playback/events';
import {PlaybackState} from '@ui/shared/playback/playback_state';
import {Viewer, ViewType} from '@ui/shared/viewers/viewer';
import {PlaybackStateChangePropagate} from '@ui/timeline/playback_events';
import {TimelineData} from '@ui/timeline/timeline_data';
import {ExpandedTimelineToggled} from '@ui/timeline/timeline_events';
import {FileLoader} from '@ui/trace_loading/file_loader';
import {LoadedFileData} from '@ui/trace_loading/loaded_file_data';
import {makeWarningCannotVisualizeTraceEntry, makeWarningFailedToInitializeTimelineData, makeWarningNoTraceTargetsSelected, makeWarningNoValidFiles,} from '@ui/trace_loading/warnings';

import {AngularViewer} from './shared/angular_viewer';
import {ViewersLoaded, ViewersUnloaded} from './viewers_events';

/**
 * Mediator class for communication between components
 */
export class Mediator {
  private abtChromeExtensionProtocol: WinscopeEventEmitter &
    WinscopeEventListener;
  private crossToolProtocol: CrossToolProtocol;
  private uploadTracesComponent?: WinscopeEventListener & ProgressListener;
  private collectTracesComponent?: ProgressListener &
    WinscopeEventEmitter &
    WinscopeEventListener;
  private traceViewComponent?: WinscopeEventEmitter & WinscopeEventListener;
  private timelineComponent?: WinscopeEventEmitter & WinscopeEventListener;
  private appComponent: WinscopeEventListener;
  private storage: Store;
  private loadedFileData: LoadedFileData;
  private activeFileLoader: FileLoader | undefined;
  private timelineData: TimelineData;
  private viewers: AngularViewer[] = [];
  private focusedTabView: undefined | Viewer;
  private areViewersLoaded = false;
  private lastRemoteToolDeferredTimestampReceived?: () => Timestamp | undefined;
  private currentProgressListener?: ProgressListener;
  private screenRecordingTrace?: Trace<MediaBasedTraceEntry>;
  private activeSearchQueries: string[] = [];

  constructor(
    loadedFileData: LoadedFileData,
    timelineData: TimelineData,
    abtChromeExtensionProtocol: WinscopeEventEmitter & WinscopeEventListener,
    crossToolProtocol: CrossToolProtocol,
    appComponent: WinscopeEventListener,
    storage: Store,
    private readonly logger: Logger = getLogger('Mediator'),
  ) {
    this.timelineData = timelineData;
    this.appComponent = appComponent;
    this.storage = storage;

    this.loadedFileData = loadedFileData;

    this.crossToolProtocol = crossToolProtocol;
    this.setEmitEvent(this.crossToolProtocol);

    this.abtChromeExtensionProtocol = abtChromeExtensionProtocol;
    this.setEmitEvent(this.abtChromeExtensionProtocol);
  }

  setLoadedFileData(value: LoadedFileData) {
    this.loadedFileData = value;
  }

  setUploadTracesComponent(
    component: (WinscopeEventListener & ProgressListener) | undefined,
  ) {
    this.uploadTracesComponent = component;
  }

  setCollectTracesComponent(
    component:
      | (ProgressListener & WinscopeEventEmitter & WinscopeEventListener)
      | undefined,
  ) {
    this.collectTracesComponent = component;
    if (this.collectTracesComponent) {
      this.setEmitEvent(this.collectTracesComponent);
    }
  }

  setTraceViewComponent(
    component: (WinscopeEventEmitter & WinscopeEventListener) | undefined,
  ) {
    this.traceViewComponent = component;
    if (this.traceViewComponent) {
      this.setEmitEvent(this.traceViewComponent);
    }
  }

  setTimelineComponent(
    component: (WinscopeEventEmitter & WinscopeEventListener) | undefined,
  ) {
    this.timelineComponent = component;
    if (this.timelineComponent) {
      this.setEmitEvent(this.timelineComponent);
    }
  }

  private createFileLoader() {
    const fileLoader = new FileLoader(
      this.loadedFileData.getTimestampConverter(),
    );
    this.setEmitEvent(fileLoader);
    return fileLoader;
  }

  private async onAppInitialized(event: WinscopeEvent) {
    this.abtChromeExtensionProtocol.onWinscopeEvent(event);
  }

  private async onAppFilesUploaded(event: AppFilesUploaded) {
    this.currentProgressListener = this.uploadTracesComponent;
    await this.loadFiles(event.files, FilesSource.UPLOADED);
    this.currentProgressListener?.onOperationFinished(true);
    UserNotifier.notify();
  }

  private async onAppFilesCollected(event: AppFilesCollected) {
    this.currentProgressListener = this.collectTracesComponent;

    if (event.files.collected.length === 0) {
      this.currentProgressListener?.onOperationFinished(false);
      UserNotifier.add(makeWarningNoValidFiles()).notify();
      return;
    }

    await this.loadFiles(event.files.collected, FilesSource.COLLECTED);
    const loadedReaders = this.loadedFileData.getLoadedFileReaders();
    if (loadedReaders.length === 0) {
      this.currentProgressListener?.onOperationFinished(false);
      UserNotifier.notify();
      return;
    }

    const failedTraces: string[] = [];
    event.files.requested.forEach((requested: RequestedTraceTypes) => {
      if (!this.loadedFileData.hasLoadedRequestedType(requested.types)) {
        failedTraces.push(requested.name);
      }
    });
    if (failedTraces.length > 0) {
      UserNotifier.add(makeWarningNoValidFiles(failedTraces));
    }
    await this.uploadTracesComponent?.onWinscopeEvent(
      new AppTraceViewRequest(),
    );
    await this.loadViewers(FilesSource.COLLECTED, false);
    await this.uploadTracesComponent?.onWinscopeEvent(
      new AppTraceViewRequestHandled(),
    );
    UserNotifier.notify();
  }

  private async onAppResetRequest() {
    await this.resetAppToInitialState();
  }

  private async onAppRefreshDumpsRequest(event: AppRefreshDumpsRequest) {
    await this.collectTracesComponent?.onWinscopeEvent(event);
  }

  private async onAppTraceViewRequest(event: AppTraceViewRequest) {
    await this.loadViewers(FilesSource.UPLOADED, event.discardLegacyFiles);
    UserNotifier.notify();
  }

  private async onRemoteToolInitialized() {
    Analytics.Tracing.logOpenFromRemoteTool();
  }

  private async onRemoteToolWaitingForFiles() {
    this.currentProgressListener = this.uploadTracesComponent;
    this.currentProgressListener?.onProgressUpdate(
      'Opened from external tool. Waiting for files...',
      undefined,
    );
  }

  private async onRemoteToolDownloadStart() {
    Analytics.Tracing.logOpenFromABT();
    this.currentProgressListener = this.uploadTracesComponent;
    this.currentProgressListener?.onProgressUpdate(
      'Downloading files...',
      undefined,
    );
  }

  private async onRemoteToolFilesReceived(event: RemoteToolFilesReceived) {
    this.logger.info('Files received from external tool.');
    await this.processRemoteFilesReceived(event.files, FilesSource.REMOTE_TOOL);
    if (event.deferredTimestamp) {
      await this.processRemoteToolDeferredTimestampReceived(
        event.deferredTimestamp,
      );
    }
  }

  private async onRemoteToolTimestampReceived(
    event: RemoteToolTimestampReceived,
  ) {
    await this.processRemoteToolDeferredTimestampReceived(
      event.deferredTimestamp,
    );
  }

  private async onTabbedViewSwitchRequest(event: TabbedViewSwitchRequest) {
    await this.traceViewComponent?.onWinscopeEvent(event);
  }

  private async onTabbedViewSwitched(event: TabbedViewSwitched) {
    const newActiveTrace = event.newFocusedView.getTraces()[0];
    if (this.timelineData.trySetActiveTrace(newActiveTrace)) {
      const activeTraceChanged = new ActiveTraceChanged(
        newActiveTrace,
        event.metadata,
      );
      await this.timelineComponent?.onWinscopeEvent(activeTraceChanged);
      for (const viewer of this.viewers) {
        await viewer.onWinscopeEvent(activeTraceChanged);
      }
    }
    await this.timelineComponent?.onWinscopeEvent(event);
    this.focusedTabView = event.newFocusedView;
    await this.propagateTracePosition(
      this.timelineData.getCurrentPosition(),
      false,
    );
    UserNotifier.notify();
  }

  private async onTracePositionUpdate(event: TracePositionUpdate) {
    if (event.updateTimeline) {
      this.timelineData.setPosition(event.position);
    }
    await this.propagateTracePosition(
      event.position,
      false,
      undefined,
      event.prefetchedEntries,
    );
    UserNotifier.notify();
    await this.appComponent.onWinscopeEvent(event);
  }

  private async onExpandedTimelineToggled(event: ExpandedTimelineToggled) {
    await this.propagateToOverlays(event);
  }

  private async onScreenRecordingChange(event: ScreenRecordingChange) {
    this.screenRecordingTrace = event.trace;
    this.timelineData.updateCurrentScreenRecordingTrace(event.trace);
    this.timelineComponent?.onWinscopeEvent(event);
    for (const viewer of this.viewers) {
      await viewer.onWinscopeEvent(event);
    }
  }

  private async onActiveTraceChanged(event: ActiveTraceChanged) {
    if (this.timelineData.trySetActiveTrace(event.trace)) {
      for (const viewer of this.viewers) {
        await viewer.onWinscopeEvent(event);
      }
      await this.timelineComponent?.onWinscopeEvent(event);
      await this.appComponent.onWinscopeEvent(event);
    }
  }

  private async onDarkModeToggled(event: DarkModeToggled) {
    await this.timelineComponent?.onWinscopeEvent(event);
    for (const viewer of this.viewers) {
      await viewer.onWinscopeEvent(event);
    }
  }

  private async onNoTraceTargetsSelected() {
    UserNotifier.add(makeWarningNoTraceTargetsSelected()).notify();
  }

  private async onFilterPresetSaveRequest(event: FilterPresetSaveRequest) {
    await this.findViewerByType(event.traceType)?.onWinscopeEvent(event);
  }

  private async onFilterPresetApplyRequest(event: FilterPresetApplyRequest) {
    await this.findViewerByType(event.traceType)?.onWinscopeEvent(event);
  }

  private async onTraceSearchRequest(event: TraceSearchRequest) {
    await this.timelineComponent?.onWinscopeEvent(event);
    const searchViewer = this.viewers.find(
      (viewer) => viewer.getViewType() === ViewType.GLOBAL_SEARCH,
    );
    const trace = await this.loadedFileData.tryCreateSearchTrace(event.query);
    this.timelineComponent?.onWinscopeEvent(new TraceSearchCompleted());
    if (!trace) {
      await searchViewer?.onWinscopeEvent(new TraceSearchFailed());
      return;
    }
    const newSearchTrace = new TraceAddRequest(trace);
    await searchViewer?.onWinscopeEvent(newSearchTrace);
    if (trace.lengthEntries > 0 && !trace.isDumpWithoutTimestamp()) {
      this.timelineData.getTraces().addTrace(trace);
      await this.timelineComponent?.onWinscopeEvent(newSearchTrace);
    }
  }

  private async onTraceRemoveRequest(event: TraceRemoveRequest) {
    this.loadedFileData.getTraces().deleteTrace(event.trace);
    if (this.timelineData.hasTrace(event.trace)) {
      this.timelineData.getTraces().deleteTrace(event.trace);
      await this.timelineComponent?.onWinscopeEvent(event);
    }
  }

  private async onInitializeTraceSearchRequest(event: WinscopeEvent) {
    await this.timelineComponent?.onWinscopeEvent(event);
    const traces = this.loadedFileData.getTraces();
    const views = await TraceSearchInitializer.createSearchViews(traces);
    const searchViewer = this.viewers.find(
      (viewer) => viewer.getViewType() === ViewType.GLOBAL_SEARCH,
    );
    const initializedEvent = new TraceSearchInitialized(views);
    await searchViewer?.onWinscopeEvent(initializedEvent);
    await this.timelineComponent?.onWinscopeEvent(initializedEvent);
  }

  private async onBugreportFileSelected(event: BugreportFileSelected) {
    await this.activeFileLoader?.onWinscopeEvent(event);
  }

  private async onBugreportFileSelectionRequest(
    event: BugreportFileSelectionRequest,
  ) {
    await this.appComponent.onWinscopeEvent(event);
  }

  private async onPlaybackStateChangeRequest(
    event: PlaybackStateChangeRequest,
  ) {
    const viewer = this.findViewerByType(event.traceType);
    if (!viewer) {
      return;
    }
    switch (event.state) {
      case PlaybackState.FORWARDS:
      case PlaybackState.BACKWARDS: {
        return await this.handlePlaybackPlayRequest(viewer, event);
      }
      case PlaybackState.PAUSED:
        return await this.handlePlaybackPauseRequest(viewer, event);
      default:
        return;
    }
  }

  private async onPlaybackSpeedChange(event: PlaybackSpeedChange) {
    this.handlePlaybackSpeedChange(event);
  }

  private async onBookmarksChanged(event: BookmarksChanged) {
    await this.appComponent.onWinscopeEvent(event);
  }

  private async onActiveSearchQueriesUpdate(event: ActiveSearchQueriesUpdate) {
    this.activeSearchQueries = event.queries;
    await this.appComponent.onWinscopeEvent(event);
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    switch (event.constructor) {
      case AppInitialized:
        return await this.onAppInitialized(event);
      case AppFilesUploaded:
        return await this.onAppFilesUploaded(event as AppFilesUploaded);
      case AppFilesCollected:
        return await this.onAppFilesCollected(event as AppFilesCollected);
      case AppResetRequest:
        return await this.onAppResetRequest();
      case AppRefreshDumpsRequest:
        return await this.onAppRefreshDumpsRequest(
          event as AppRefreshDumpsRequest,
        );
      case AppTraceViewRequest:
        return await this.onAppTraceViewRequest(event as AppTraceViewRequest);
      case RemoteToolInitialized:
        return await this.onRemoteToolInitialized();
      case RemoteToolWaitingForFiles:
        return await this.onRemoteToolWaitingForFiles();
      case RemoteToolDownloadStart:
        return await this.onRemoteToolDownloadStart();
      case RemoteToolFilesReceived:
        return await this.onRemoteToolFilesReceived(
          event as RemoteToolFilesReceived,
        );
      case RemoteToolTimestampReceived:
        return await this.onRemoteToolTimestampReceived(
          event as RemoteToolTimestampReceived,
        );
      case TabbedViewSwitchRequest:
        return await this.onTabbedViewSwitchRequest(
          event as TabbedViewSwitchRequest,
        );
      case TabbedViewSwitched:
        return await this.onTabbedViewSwitched(event as TabbedViewSwitched);
      case TracePositionUpdate:
        return await this.onTracePositionUpdate(event as TracePositionUpdate);
      case ExpandedTimelineToggled:
        return await this.onExpandedTimelineToggled(
          event as ExpandedTimelineToggled,
        );
      case ScreenRecordingChange:
        return await this.onScreenRecordingChange(
          event as ScreenRecordingChange,
        );
      case ActiveTraceChanged:
        return await this.onActiveTraceChanged(event as ActiveTraceChanged);
      case DarkModeToggled:
        return await this.onDarkModeToggled(event as DarkModeToggled);
      case NoTraceTargetsSelectedEvent:
        return await this.onNoTraceTargetsSelected();
      case FilterPresetSaveRequest:
        return await this.onFilterPresetSaveRequest(
          event as FilterPresetSaveRequest,
        );
      case FilterPresetApplyRequest:
        return await this.onFilterPresetApplyRequest(
          event as FilterPresetApplyRequest,
        );
      case TraceSearchRequest:
        return await this.onTraceSearchRequest(event as TraceSearchRequest);
      case TraceRemoveRequest:
        return await this.onTraceRemoveRequest(event as TraceRemoveRequest);
      case InitializeTraceSearchRequest:
        return await this.onInitializeTraceSearchRequest(event);
      case BugreportFileSelected:
        return await this.onBugreportFileSelected(
          event as BugreportFileSelected,
        );
      case BugreportFileSelectionRequest:
        return await this.onBugreportFileSelectionRequest(
          event as BugreportFileSelectionRequest,
        );
      case PlaybackStateChangeRequest:
        return await this.onPlaybackStateChangeRequest(
          event as PlaybackStateChangeRequest,
        );
      case PlaybackStateChangeHandled:
        return await this.onPlaybackStateChangeHandled(
          event as PlaybackStateChangeHandled,
        );
      case PlaybackSpeedChange:
        return await this.onPlaybackSpeedChange(event as PlaybackSpeedChange);
      case BookmarksChanged:
        return await this.onBookmarksChanged(event as BookmarksChanged);
      case ActiveSearchQueriesUpdate:
        return await this.onActiveSearchQueriesUpdate(
          event as ActiveSearchQueriesUpdate,
        );
      default:
        throw new Error('Unsupported event type ' + event);
    }
  }

  getActiveSearchQueries(): string[] {
    return this.activeSearchQueries;
  }

  getActiveTraceType(): TraceType | undefined {
    return this.focusedTabView?.getTraces()[0]?.type;
  }

  getCurrentTimestamp(): Timestamp | undefined {
    return this.timelineData.getCurrentPosition()?.timestamp;
  }

  private async loadFiles(files: File[], source: FilesSource) {
    const startTimeMs = Date.now();
    this.activeFileLoader = this.createFileLoader();
    const result = await this.activeFileLoader.load(
      files,
      source,
      this.currentProgressListener,
    );
    this.activeFileLoader = undefined;
    Analytics.Loading.logLoadFilesTime(Date.now() - startTimeMs, source);

    for (const warning of result.warnings) {
      await this.uploadTracesComponent?.onWinscopeEvent(
        new ShowTraceUploadWarning(warning.message),
      );
    }
    this.loadedFileData.addFiles(result, source);
  }

  private async propagateTracePosition(
    position: TracePosition | undefined,
    omitCrossToolProtocol: boolean,
    source?: FilesSource,
    prefetchedEntries?: PlaybackPrefetchedEntries,
  ) {
    if (!position) {
      return;
    }

    const event = new TracePositionUpdate(
      position,
      undefined,
      prefetchedEntries,
    );
    const viewers: Viewer[] = [...this.viewers].filter((viewer) =>
      this.isViewerVisible(viewer),
    );

    const warnings: UserWarning[] = [];

    for (const viewer of viewers) {
      const type = viewer.getTraces().at(0)?.type;
      const traceType = type !== undefined ? TRACE_INFO[type].name : 'Unknown';
      try {
        const startTimeMs = Date.now();
        await viewer.onWinscopeEvent(event);
        if (source !== undefined) {
          Analytics.Loading.logViewerInitializationTime(
            traceType,
            source,
            Date.now() - startTimeMs,
          );
          Analytics.Memory.logUsage('viewer_initialized', {traceType});
        }
        Analytics.Navigation.logTimePropagated(
          traceType,
          Date.now() - startTimeMs,
        );
      } catch (e) {
        this.logger.error((e as Error).message);
        warnings.push(
          makeWarningCannotVisualizeTraceEntry(
            `Cannot parse entry for ${traceType} trace: Trace may be corrupted.`,
          ),
        );
      }
    }

    if (this.timelineComponent) {
      const startTimeMs = Date.now();
      await this.timelineComponent.onWinscopeEvent(event);
      Analytics.Navigation.logTimePropagated(
        'Timeline',
        Date.now() - startTimeMs,
      );
    }

    if (!omitCrossToolProtocol) {
      const startTimeMs = Date.now();
      await this.crossToolProtocol.onWinscopeEvent(event);
      Analytics.Navigation.logTimePropagated(
        'CrossToolProtocol',
        Date.now() - startTimeMs,
      );
    }

    if (warnings.length > 0) {
      warnings.forEach((w) => UserNotifier.add(w));
    }
    Analytics.Memory.logUsage('time_propagated');
  }

  private isViewerVisible(viewer: Viewer): boolean {
    if (!this.focusedTabView) {
      // During initialization no tab is focused.
      // Let's just consider all viewers as visible and to be updated.
      return true;
    }

    if (viewer === this.focusedTabView) {
      return true;
    }
    if (viewer.getViewType() === ViewType.OVERLAY) {
      // Nice to have: update viewer only if overlay view is actually visible (not minimized)
      return true;
    }
    return false;
  }

  private async processRemoteToolDeferredTimestampReceived(
    deferredTimestamp: () => Timestamp | undefined,
  ) {
    this.lastRemoteToolDeferredTimestampReceived = deferredTimestamp;

    if (!this.areViewersLoaded) {
      return; // apply timestamp later when traces are visualized
    }

    const timestamp = deferredTimestamp();
    if (!timestamp) {
      return;
    }

    const position = this.timelineData.makePositionFromActiveTrace(timestamp);
    this.timelineData.setPosition(position);

    await this.propagateTracePosition(
      this.timelineData.getCurrentPosition(),
      true,
    );
    UserNotifier.notify();
  }

  private async processRemoteFilesReceived(files: File[], source: FilesSource) {
    this.currentProgressListener = this.uploadTracesComponent;
    await this.loadFiles(files, source);
    this.currentProgressListener?.onOperationFinished(true);
    UserNotifier.notify();
  }

  private async loadViewers(source: FilesSource, discardLegacyFiles: boolean) {
    const e2eStartTimeMs = Date.now();

    const success = await this.loadedFileData.buildTraces(
      discardLegacyFiles,
      this.currentProgressListener,
    );
    if (!success) {
      this.currentProgressListener?.onOperationFinished(false);
      return;
    }

    // timer#sleepMs() allows the UI to update before making the main thread very busy
    await new Timer(10, 100).sleepMs();
    this.currentProgressListener?.onProgressUpdate(
      'Initializing UI...',
      undefined,
    );

    const traces = this.loadedFileData.getTraces();
    const screenRecordingTrace = traces.getTrace<MediaBasedTraceEntry>(
      TraceType.SCREEN_RECORDING,
    );
    const timestampConverter = this.loadedFileData.getTimestampConverter();

    try {
      await this.timelineData.initialize(
        traces,
        screenRecordingTrace,
        timestampConverter,
      );
    } catch {
      this.currentProgressListener?.onOperationFinished(false);
      UserNotifier.add(makeWarningFailedToInitializeTimelineData());
      return;
    }

    this.viewers = new ViewerFactory().createViewers(
      traces,
      this.storage,
      timestampConverter,
    );
    this.viewers.forEach((viewer) => {
      this.setEmitEvent(viewer);
    });

    // Set initial trace position as soon as UI is created
    const initialPosition = this.getInitialTracePosition();
    this.timelineData.setPosition(initialPosition);

    // Make sure all viewers are initialized and have performed the heavy pre-processing they need
    // at this stage, while the "initializing UI" progress message is still being displayed.
    // The viewers initialization is triggered by sending them a "trace position update".
    await this.propagateTracePosition(initialPosition, true, source);
    Analytics.Memory.logUsage('viewers_initialized');

    this.focusedTabView = this.viewers.find(
      (v) => v.getViewType() === ViewType.TRACE_TAB,
    );
    this.areViewersLoaded = true;

    // Notify app component (i.e. render viewers), only after all viewers have been initialized
    // (see above).
    //
    // Notifying the app component first could result in this kind of interleaved execution:
    // 1. Mediator notifies app component
    //    1.1. App component renders UI components
    //    1.2. Mediator receives back a "view switched" event
    //    1.2. Mediator sends "trace position update" to viewers
    // 2. Mediator sends "trace position update" to viewers to initialize them (see above)
    //
    // and because our data load operations are async and involve task suspensions, the two
    // "trace position update" could be processed concurrently within the same viewer.
    // Meaning the viewer could perform twice the initial heavy pre-processing,
    // thus increasing UI initialization times.
    const initialTimelineTabTraceType =
      this.focusedTabView?.getTraces()[0]?.type;
    await this.appComponent.onWinscopeEvent(
      new ViewersLoaded(this.viewers, initialTimelineTabTraceType),
    );
    Analytics.Loading.logLoadViewersTime(Date.now() - e2eStartTimeMs);
  }

  private async handlePlaybackPlayRequest(
    viewer: Viewer,
    event: PlaybackStateChangeRequest,
  ) {
    const visible = this.isViewerVisible(viewer);
    if (!visible) {
      return;
    }

    const traces = this.loadedFileData.getTraces();
    if (!this.screenRecordingTrace) {
      this.screenRecordingTrace = traces.getTrace(TraceType.SCREEN_RECORDING);
    }

    const eventTrace = traces.getTrace(event.traceType);
    const traceGeometryData = this.loadedFileData.getTraceGeometryData();
    const trace = this.screenRecordingTrace ?? eventTrace;

    if (trace === undefined) {
      return;
    }

    // The Screen Recording parsers decode and cache video frames using a background
    // worker to avoid latency in other UI interactions. This must complete operations
    // before playback can start.
    for (const srTrace of traces.getTraces(TraceType.SCREEN_RECORDING)) {
      await srTrace.getAllEntryValues();
    }

    const playbackStatePropagate = new PlaybackStateChangePropagate(
      event.state,
      assertDefined(event.currentTraceIndex),
      traceGeometryData,
    );
    this.timelineData.trySetActiveTrace(trace);
    await viewer.onWinscopeEvent(playbackStatePropagate);
  }

  private async handlePlaybackPauseRequest(
    viewer: Viewer,
    event: PlaybackStateChangeRequest,
  ) {
    await viewer.onWinscopeEvent(event);
  }

  private async onPlaybackStateChangeHandled(
    event: PlaybackStateChangeHandled,
  ) {
    if (event.traceType !== undefined) {
      const viewer = this.findViewerByType(event.traceType);
      if (viewer === undefined) {
        return;
      }
      viewer.onWinscopeEvent(event);
    }
    this.propagateToOverlays(event);
    return this.timelineComponent?.onWinscopeEvent(event);
  }

  private async handlePlaybackSpeedChange(event: PlaybackSpeedChange) {
    const viewer = this.findViewerByType(event.traceType);
    if (viewer) {
      await viewer.onWinscopeEvent(event);
    }
  }

  private getInitialTracePosition(): TracePosition | undefined {
    if (this.lastRemoteToolDeferredTimestampReceived) {
      const lastRemoteToolTimestamp =
        this.lastRemoteToolDeferredTimestampReceived();
      if (lastRemoteToolTimestamp) {
        return this.timelineData.makePositionFromActiveTrace(
          lastRemoteToolTimestamp,
        );
      }
    }

    const position = this.timelineData.getCurrentPosition();
    if (position) {
      return position;
    }

    // TimelineData might not provide a TracePosition because all the loaded traces are
    // dumps with invalid timestamps (value zero). In this case let's create a TracePosition
    // out of any entry from the loaded traces (if available).
    const firstEntries = this.loadedFileData
      .getTraces()
      .mapTrace((trace) => {
        if (trace.lengthEntries > 0) {
          return trace.getEntry(0);
        }
        return undefined;
      })
      .filter((entry) => {
        return entry !== undefined;
      });

    if (firstEntries.length > 0) {
      return TracePosition.fromTraceEntry(firstEntries[0]);
    }

    return undefined;
  }

  private async resetAppToInitialState() {
    this.viewers.forEach((viewer) => {
      viewer.onDestroy();
    });
    await this.appComponent.onWinscopeEvent(new ViewersUnloaded());
  }

  private async propagateToOverlays(event: WinscopeEvent) {
    const overlayViewers = this.viewers.filter(
      (viewer) => viewer.getViewType() === ViewType.OVERLAY,
    );
    for (const overlay of overlayViewers) {
      await overlay.onWinscopeEvent(event);
    }
  }

  private findViewerByType(type: TraceType): Viewer | undefined {
    return this.viewers.find(
      (viewer) => viewer.getTraces().at(0)?.type === type,
    );
  }

  private setEmitEvent(emitter: WinscopeEventEmitter) {
    emitter.setEmitEvent(async (event: WinscopeEvent) => {
      await this.onWinscopeEvent(event);
    });
  }
}

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

import {assertDefined} from '@common/assert';
import {Store} from '@common/store/store';
import {Timestamp} from '@common/time/time';
import {Timer} from '@common/time/timer';
import {CrossToolProtocol} from '@cross_tool/cross_tool_protocol';
import {Analytics} from '@logging/analytics';
import {ProgressListener} from '@messaging/progress_listener';
import {UserWarning} from '@messaging/user_warning';
import {
  makeWarningNoValidFiles,
  makeWarningCannotVisualizeTraceEntry,
  makeWarningFailedToInitializeTimelineData,
  makeWarningIncompleteFrameMapping,
  makeWarningNoTraceTargetsSelected,
} from './warnings';
import {
  AppFilesCollected,
  AppFilesUploaded,
  AppInitialized,
  AppRefreshDumpsRequest,
  AppResetRequest,
  AppTraceViewRequest,
  AppTraceViewRequestHandled,
} from '@app/app_events';
import {
  ActiveSearchQueriesUpdate,
  BookmarksChanged,
  BugreportFileSelected,
  BugreportFileSelectionRequest,
  DarkModeToggled,
  FilterPresetApplyRequest,
  FilterPresetSaveRequest,
  NoTraceTargetsSelectedEvent,
} from '@app/misc_events';
import {ExpandedTimelineToggled} from '@app/components/timeline/timeline_events';
import {
  PlaybackSpeedChange,
  PlaybackStateChangeHandled,
  PlaybackStateChangePropagate,
  PlaybackStateChangeRequest,
} from '@app/components/timeline/playback_events';
import {
  ActiveTraceChanged,
  InitializeTraceSearchRequest,
  ScreenRecordingChange,
  TraceAddRequest,
  TracePositionUpdate,
  TraceRemoveRequest,
  TraceSearchCompleted,
  TraceSearchFailed,
  TraceSearchInitialized,
  TraceSearchRequest,
  ShowTraceUploadWarning,
} from '@trace/trace_events';
import {WinscopeEvent} from '@messaging/winscope_event';
import {
  RemoteToolDownloadStart,
  RemoteToolFilesReceived,
  RemoteToolTimestampReceived,
} from '@cross_tool/remote_tool_events';
import {ViewersLoaded, ViewersUnloaded} from '@app/viewers_events';
import {
  TabbedViewSwitched,
  TabbedViewSwitchRequest,
} from '@app/tabbed_view_events';
import {WinscopeEventEmitter} from '@messaging/winscope_event_emitter';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {getLogger, Logger} from '@compat/logging';
import {UserNotifier} from '@services/user_notifier';
import {Trace} from '@trace_api/trace';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TracePosition} from '@trace_api/trace_position';
import {TraceType} from '@trace_api/trace_type';
import {RequestedTraceTypes} from '@trace_collection/adb_files';
import {View, Viewer, ViewType} from '@viewers/viewer';
import {ViewerFactory} from '@viewers/viewer_factory';
import {FilesSource} from './files_source';
import {TimelineData} from './timeline_data';
import {TracePipeline} from './trace_pipeline';
import {TraceSearchInitializer} from './trace_search/trace_search_initializer';
import {PlaybackState} from '@viewers/common/playback/playback_state';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {PlaybackPrefetchedEntries} from '@trace/playback_prefetched_entries';

/**
 * Mediator class for communication between components
 */
export class Mediator {
  initialTimelineTabTraceType: TraceType | undefined;
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

  private tracePipeline: TracePipeline;
  private timelineData: TimelineData;
  private viewers: Viewer[] = [];
  private focusedTabView: undefined | View;
  private areViewersLoaded = false;
  private lastRemoteToolDeferredTimestampReceived?: () => Timestamp | undefined;
  private currentProgressListener?: ProgressListener;
  private screenRecordingTrace?: Trace<MediaBasedTraceEntry>;
  private activeSearchQueries: string[] = [];

  constructor(
    tracePipeline: TracePipeline,
    timelineData: TimelineData,
    abtChromeExtensionProtocol: WinscopeEventEmitter & WinscopeEventListener,
    crossToolProtocol: CrossToolProtocol,
    appComponent: WinscopeEventListener,
    storage: Store,
    private readonly logger: Logger = getLogger('Mediator'),
  ) {
    this.tracePipeline = tracePipeline;
    this.timelineData = timelineData;
    this.abtChromeExtensionProtocol = abtChromeExtensionProtocol;
    this.crossToolProtocol = crossToolProtocol;
    this.appComponent = appComponent;
    this.storage = storage;

    this.tracePipeline.setEmitEvent(async (event: WinscopeEvent) => {
      await this.onWinscopeEvent(event);
    });

    this.crossToolProtocol.setEmitEvent(async (event: WinscopeEvent) => {
      await this.onWinscopeEvent(event);
    });

    this.abtChromeExtensionProtocol.setEmitEvent(
      async (event: WinscopeEvent) => {
        await this.onWinscopeEvent(event);
      },
    );
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
    this.collectTracesComponent?.setEmitEvent(async (event: WinscopeEvent) => {
      await this.onWinscopeEvent(event);
    });
  }

  setTraceViewComponent(
    component: (WinscopeEventEmitter & WinscopeEventListener) | undefined,
  ) {
    this.traceViewComponent = component;
    this.traceViewComponent?.setEmitEvent(async (event: WinscopeEvent) => {
      await this.onWinscopeEvent(event);
    });
  }

  setTimelineComponent(
    component: (WinscopeEventEmitter & WinscopeEventListener) | undefined,
  ) {
    this.timelineComponent = component;
    this.timelineComponent?.setEmitEvent(async (event: WinscopeEvent) => {
      await this.onWinscopeEvent(event);
    });
  }

  private async onAppInitialized(event: WinscopeEvent) {
    this.abtChromeExtensionProtocol.onWinscopeEvent(event);
  }

  private async onAppFilesUploaded(event: AppFilesUploaded) {
    this.currentProgressListener = this.uploadTracesComponent;
    await this.loadFiles(event.files, FilesSource.UPLOADED);

    UserNotifier.notify();
  }

  private async onAppFilesCollected(event: AppFilesCollected) {
    this.currentProgressListener = this.collectTracesComponent;
    if (event.files.collected.length > 0) {
      await this.loadFiles(event.files.collected, FilesSource.COLLECTED);
      const traces = this.tracePipeline.getTraces();
      if (traces.getSize() > 0) {
        const failedTraces: string[] = [];
        event.files.requested.forEach((requested: RequestedTraceTypes) => {
          if (
            !requested.types.some(
              (type: TraceType) => traces.getTraces(type).length > 0,
            )
          ) {
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
      } else {
        this.currentProgressListener?.onOperationFinished(false);
      }
    } else {
      UserNotifier.add(makeWarningNoValidFiles());
      this.currentProgressListener?.onOperationFinished(false);
    }
    UserNotifier.notify();
  }

  private async onAppResetRequest() {
    await this.resetAppToInitialState();
  }

  private async onAppRefreshDumpsRequest(event: AppRefreshDumpsRequest) {
    await this.resetAppToInitialState();
    await this.collectTracesComponent?.onWinscopeEvent(event);
  }

  private async onAppTraceViewRequest(event: AppTraceViewRequest) {
    await this.loadViewers(FilesSource.UPLOADED, event.discardLegacyTraces);
    UserNotifier.notify();
  }

  private async onRemoveToolDownloadStart() {
    Analytics.Tracing.logOpenFromABT();
    await this.resetAppToInitialState();
    this.currentProgressListener = this.uploadTracesComponent;
    this.currentProgressListener?.onProgressUpdate(
      'Downloading files...',
      undefined,
    );
    this.logger.info('App reset for remote tool download.');
  }

  private async onRemoveToolFilesReceived(event: RemoteToolFilesReceived) {
    this.logger.info('Remote tool files received.');
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
    const newActiveTrace = event.newFocusedView.traces[0];
    if (this.timelineData.trySetActiveTrace(newActiveTrace)) {
      const activeTraceChanged = new ActiveTraceChanged(newActiveTrace);
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
      (viewer) => viewer.getViews()[0].type === ViewType.GLOBAL_SEARCH,
    );
    const trace = await this.tracePipeline.tryCreateSearchTrace(event.query);
    this.timelineComponent?.onWinscopeEvent(new TraceSearchCompleted());
    if (!trace) {
      await searchViewer?.onWinscopeEvent(new TraceSearchFailed());
      return;
    }
    const newSearchTrace = new TraceAddRequest(trace);
    await searchViewer?.onWinscopeEvent(newSearchTrace);
    if (trace.lengthEntries > 0 && !trace.isDumpWithoutTimestamp()) {
      assertDefined(this.timelineData).getTraces().addTrace(trace);
      await this.timelineComponent?.onWinscopeEvent(newSearchTrace);
    }
  }

  private async onTraceRemoveRequest(event: TraceRemoveRequest) {
    this.tracePipeline.getTraces().deleteTrace(event.trace);
    if (this.timelineData.hasTrace(event.trace)) {
      this.timelineData.getTraces().deleteTrace(event.trace);
      await this.timelineComponent?.onWinscopeEvent(event);
    }
  }

  private async onInitializeTraceSearchRequest(event: WinscopeEvent) {
    await this.timelineComponent?.onWinscopeEvent(event);
    const traces = this.tracePipeline.getTraces();
    const views = await TraceSearchInitializer.createSearchViews(traces);
    const searchViewer = this.viewers.find(
      (viewer) => viewer.getViews()[0].type === ViewType.GLOBAL_SEARCH,
    );
    const initializedEvent = new TraceSearchInitialized(views);
    await searchViewer?.onWinscopeEvent(initializedEvent);
    await this.timelineComponent?.onWinscopeEvent(initializedEvent);
  }

  private async onBugreportFileSelected(event: BugreportFileSelected) {
    await this.tracePipeline.onWinscopeEvent(event);
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
      case RemoteToolDownloadStart:
        return await this.onRemoveToolDownloadStart();
      case RemoteToolFilesReceived:
        return await this.onRemoveToolFilesReceived(
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
    return this.focusedTabView?.traces[0]?.type;
  }

  getCurrentTimestamp(): Timestamp | undefined {
    return this.timelineData.getCurrentPosition()?.timestamp;
  }

  private async loadFiles(files: File[], source: FilesSource) {
    const startTimeMs = Date.now();
    const warnings = await this.tracePipeline.loadFiles(
      files,
      source,
      this.currentProgressListener,
    );
    Analytics.Loading.logLoadFilesTime(Date.now() - startTimeMs, source);

    for (const warning of warnings) {
      await this.uploadTracesComponent?.onWinscopeEvent(
        new ShowTraceUploadWarning(warning.message),
      );
    }
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

    return viewer.getViews().some((view) => {
      if (view === this.focusedTabView) {
        return true;
      }
      if (view.type === ViewType.OVERLAY) {
        // Nice to have: update viewer only if overlay view is actually visible (not minimized)
        return true;
      }
      return false;
    });
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
    await this.resetAppToInitialState();
    this.currentProgressListener = this.uploadTracesComponent;
    await this.loadFiles(files, source);
    UserNotifier.notify();
  }

  private async loadViewers(source: FilesSource, discardLegacyTraces: boolean) {
    const e2eStartTimeMs = Date.now();
    const timer = new Timer(10, 10);

    if (discardLegacyTraces) {
      this.tracePipeline.discardLegacyTraces();
    } else {
      this.currentProgressListener?.onProgressUpdate(
        'Converting legacy traces to perfetto...',
        undefined,
      );
      await timer.sleepMs(); // allow the UI to update before making the main thread very busy
      await this.tracePipeline.convertLegacyTracesToPerfetto();
      this.currentProgressListener?.onOperationFinished(true);
    }

    this.currentProgressListener?.onProgressUpdate(
      'Computing frame mapping...',
      undefined,
    );

    await timer.sleepMs(); // allow the UI to update before making the main thread very busy

    this.tracePipeline.filterTracesWithoutVisualization();
    if (this.tracePipeline.getTraces().getSize() === 0) {
      this.currentProgressListener?.onOperationFinished(false);
      return;
    }

    try {
      const startTimeMs = Date.now();
      await this.tracePipeline.buildTraces();
      Analytics.Loading.logFrameMapBuildTime(Date.now() - startTimeMs);
      Analytics.Memory.logUsage('frame_map_built');
      this.currentProgressListener?.onOperationFinished(true);
    } catch (e) {
      UserNotifier.add(makeWarningIncompleteFrameMapping((e as Error).message));
      this.currentProgressListener?.onOperationFinished(false);
    }

    this.currentProgressListener?.onProgressUpdate(
      'Initializing UI...',
      undefined,
    );

    // TODO: move this into the ProgressListener
    // allow the UI to update before making the main thread very busy
    await timer.sleepMs();

    try {
      await this.timelineData.initialize(
        this.tracePipeline.getTraces(),
        this.tracePipeline.getScreenRecordingTrace(),
        this.tracePipeline.getTimestampConverter(),
      );
    } catch {
      this.currentProgressListener?.onOperationFinished(false);
      UserNotifier.add(makeWarningFailedToInitializeTimelineData());
      return;
    }

    this.viewers = new ViewerFactory().createViewers(
      this.tracePipeline.getTraces(),
      this.storage,
      this.tracePipeline.getTimestampConverter(),
    );
    this.viewers.forEach((viewer) =>
      viewer.setEmitEvent(async (event: WinscopeEvent) => {
        await this.onWinscopeEvent(event);
      }),
    );

    // Set initial trace position as soon as UI is created
    const initialPosition = this.getInitialTracePosition();
    this.timelineData.setPosition(initialPosition);

    // Make sure all viewers are initialized and have performed the heavy pre-processing they need
    // at this stage, while the "initializing UI" progress message is still being displayed.
    // The viewers initialization is triggered by sending them a "trace position update".
    await this.propagateTracePosition(initialPosition, true, source);
    Analytics.Memory.logUsage('viewers_initialized');

    this.focusedTabView = this.viewers
      .find((v) => v.getViews()[0].type === ViewType.TRACE_TAB)
      ?.getViews()[0];
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
    this.initialTimelineTabTraceType = this.focusedTabView?.traces[0]?.type;
    await this.appComponent.onWinscopeEvent(new ViewersLoaded(this.viewers));
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

    const traces = this.tracePipeline.getTraces();
    if (!this.screenRecordingTrace) {
      this.screenRecordingTrace = traces.getTrace(TraceType.SCREEN_RECORDING);
    }

    const eventTrace = traces.getTrace(event.traceType);
    const traceGeometryData = this.tracePipeline.getTraceGeometryData();
    const trace = this.screenRecordingTrace ?? eventTrace;

    if (traceGeometryData === undefined) {
      return;
    }
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
    const firstEntries = this.tracePipeline
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
    this.tracePipeline.clear();
    this.timelineData.clear();
    this.viewers.forEach((viewer) => {
      viewer.onDestroy();
    });
    this.viewers = [];
    this.areViewersLoaded = false;
    this.lastRemoteToolDeferredTimestampReceived = undefined;
    this.focusedTabView = undefined;
    this.initialTimelineTabTraceType = undefined;
    await this.appComponent.onWinscopeEvent(new ViewersUnloaded());
  }

  private async propagateToOverlays(event: WinscopeEvent) {
    const overlayViewers = this.viewers.filter((viewer) =>
      viewer.getViews().some((view: View) => view.type === ViewType.OVERLAY),
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
}

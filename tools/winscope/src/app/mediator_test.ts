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

import {Mediator} from '@app/mediator';
import {TraceSearchInitializer} from '@app/search/trace_search_initializer';
import {ViewerStub} from '@app/shared/viewer_stub';
import {ViewerFactory} from '@app/viewer_factory';
import {ViewersLoaded, ViewersUnloaded} from '@app/viewers_events';
import {assertDefined} from '@common/assert';
import {Rect} from '@common/geometry/rect';
import {TransformMatrix} from '@common/geometry/transform_matrix';
import {mixin} from '@common/mixin_helpers';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {getFixtureFile} from '@common/testing/io_helpers';
import {makeRealTimestamp, makeZeroTimestamp,} from '@common/time/testing/test_helpers';
import {CrossToolProtocol} from '@cross_tool/cross_tool_protocol';
import {RemoteToolDownloadStart, RemoteToolFilesReceived, RemoteToolInitialized, RemoteToolTimestampReceived, RemoteToolWaitingForFiles,} from '@cross_tool/remote_tool_events';
import {LegacyToPerfettoConverter} from '@legacy_file_readers/common/legacy_to_perfetto_converter';
import {ProgressListener} from '@messaging/progress_listener';
import {ProgressListenerStub} from '@messaging/progress_listener_stub';
import {UserWarning} from '@messaging/user_warning';
import {WinscopeEventEmitter} from '@messaging/winscope_event_emitter';
import {WinscopeEventEmitterStub} from '@messaging/winscope_event_emitter_stub';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {WinscopeEventListenerStub} from '@messaging/winscope_event_listener_stub';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {makeWarningInvalidLegacyTrace, makeWarningInvalidPerfettoTrace,} from '@parsers/helpers/warnings';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {TraceBuilder} from '@trace_api/testing/trace_builder';
import {TraceEntry} from '@trace_api/trace';
import {ActiveTraceChanged, InitializeTraceSearchRequest, ScreenRecordingChange, TraceAddRequest, TracePositionUpdate, TraceRemoveRequest, TraceSearchCompleted, TraceSearchFailed, TraceSearchInitialized, TraceSearchRequest,} from '@trace_api/trace_events';
import {TracePosition} from '@trace_api/trace_position';
import {TraceType} from '@trace_api/trace_type';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {AppFilesCollected, AppFilesUploaded, AppInitialized, AppRefreshDumpsRequest, AppResetRequest, AppTraceViewRequest, AppTraceViewRequestHandled,} from '@ui/shared/events/app_events';
import {ActiveSearchQueriesUpdate, BookmarksChanged, BugreportFileSelected, BugreportFileSelectionRequest, DarkModeToggled, FilterPresetApplyRequest, FilterPresetSaveRequest, NoTraceTargetsSelectedEvent,} from '@ui/shared/events/misc_events';
import {TabbedViewSwitched, TabbedViewSwitchRequest,} from '@ui/shared/events/tabbed_view_events';
import {PlaybackSpeedChange, PlaybackStateChangeHandled, PlaybackStateChangeRequest,} from '@ui/shared/playback/events';
import {PlaybackState} from '@ui/shared/playback/playback_state';
import {ViewType} from '@ui/shared/viewers/viewer';
import {PlaybackStateChangePropagate} from '@ui/timeline/playback_events';
import {TimelineData} from '@ui/timeline/timeline_data';
import {ExpandedTimelineToggled} from '@ui/timeline/timeline_events';
import {FileLoader} from '@ui/trace_loading/file_loader';
import {LoadedFileData} from '@ui/trace_loading/loaded_file_data';
import {makeWarningNoTraceTargetsSelected, makeWarningNoValidFiles,} from '@ui/trace_loading/warnings';

describe('Mediator', () => {
  const TIMESTAMP_INVALID = makeRealTimestamp(-1n);
  const TIMESTAMP_10 = makeRealTimestamp(10n);
  const TIMESTAMP_11 = makeRealTimestamp(11n);

  const POSITION_10 = TracePosition.fromTimestamp(TIMESTAMP_10);
  const POSITION_11 = TracePosition.fromTimestamp(TIMESTAMP_11);

  const traceSf = new TraceBuilder<HierarchyTreeNode>()
    .setType(TraceType.SURFACE_FLINGER)
    .setTimestamps([TIMESTAMP_10])
    .build();
  const traceWm = new TraceBuilder<HierarchyTreeNode>()
    .setType(TraceType.WINDOW_MANAGER)
    .setTimestamps([TIMESTAMP_11])
    .build();
  const traceDump = new TraceBuilder<HierarchyTreeNode>()
    .setType(TraceType.SURFACE_FLINGER)
    .setTimestamps([makeZeroTimestamp()])
    .build();

  let inputFiles: File[];
  let shellTransitionFile: File;
  let perfettoFile: File;
  let wmDumpFile: File;
  let loadedFileData: LoadedFileData;
  let timelineData: TimelineData;
  let abtChromeExtensionProtocol: WinscopeEventEmitter & WinscopeEventListener;
  let crossToolProtocol: CrossToolProtocol;
  let appComponent: WinscopeEventListener;
  let timelineComponent: WinscopeEventEmitter & WinscopeEventListener;
  let uploadTracesComponent: WinscopeEventListenerStub & ProgressListenerStub;
  let collectTracesComponent: ProgressListenerStub &
    WinscopeEventEmitterStub &
    WinscopeEventListenerStub;
  let traceViewComponent: WinscopeEventEmitter & WinscopeEventListener;
  let mediator: Mediator;
  let spies: Array<jasmine.Spy<jasmine.Func>>;
  let userNotifierChecker: UserNotifierChecker;
  let createViewersSpy: jasmine.Spy;

  const viewerStub0 = new ViewerStub('Title0', undefined, traceSf);
  const viewerStub1 = new ViewerStub('Title1', undefined, traceWm);
  const viewerOverlay = new ViewerStub(
    'TitleOverlay',
    undefined,
    traceWm,
    ViewType.OVERLAY,
  );
  const viewerDump = new ViewerStub('TitleDump', undefined, traceDump);
  const viewers = [viewerStub0, viewerStub1, viewerOverlay, viewerDump];
  let tracePositionUpdateListeners: WinscopeEventListener[];

  beforeAll(async () => {
    inputFiles = [
      await getFixtureFile(
        'traces/elapsed_and_real_timestamp/SurfaceFlinger.pb',
      ),
      await getFixtureFile(
        'traces/elapsed_and_real_timestamp/WindowManager.pb',
      ),
      await getFixtureFile(
        'traces/elapsed_and_real_timestamp/screen_recording_metadata_v2.mp4',
      ),
    ];
    perfettoFile = await getFixtureFile(
      'traces/perfetto/layers_trace.perfetto-trace',
    );
    shellTransitionFile = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/shell_transition_trace.pb',
    );
    wmDumpFile = await getFixtureFile(
      'traces/elapsed_timestamp/dump_WindowManager.pb',
    );
    userNotifierChecker = new UserNotifierChecker();
  });

  beforeEach(() => {
    userNotifierChecker.reset();
    jasmine.addCustomEqualityTester(tracePositionUpdateEqualityTester);
    loadedFileData = new LoadedFileData();
    timelineData = new TimelineData();
    abtChromeExtensionProtocol = mixin(
      new WinscopeEventEmitterStub(),
      new WinscopeEventListenerStub(),
    );
    crossToolProtocol = new CrossToolProtocol(
      loadedFileData.getTimestampConverter(),
    );
    appComponent = new WinscopeEventListenerStub();
    timelineComponent = mixin(
      new WinscopeEventEmitterStub(),
      new WinscopeEventListenerStub(),
    );
    uploadTracesComponent = mixin(
      new ProgressListenerStub(),
      new WinscopeEventListenerStub(),
    );
    collectTracesComponent = mixin(
      mixin(new ProgressListenerStub(), new WinscopeEventListenerStub()),
      new WinscopeEventEmitterStub(),
    );
    traceViewComponent = mixin(
      new WinscopeEventEmitterStub(),
      new WinscopeEventListenerStub(),
    );
    mediator = new Mediator(
      loadedFileData,
      timelineData,
      abtChromeExtensionProtocol,
      crossToolProtocol,
      appComponent,
      new InMemoryStorage(),
    );
    mediator.setTimelineComponent(timelineComponent);
    mediator.setUploadTracesComponent(uploadTracesComponent);
    mediator.setCollectTracesComponent(collectTracesComponent);
    mediator.setTraceViewComponent(traceViewComponent);

    tracePositionUpdateListeners = [
      ...viewers,
      timelineComponent,
      crossToolProtocol,
    ];

    createViewersSpy = spyOn(
      ViewerFactory.prototype,
      'createViewers',
    ).and.returnValue(viewers);

    spies = [
      spyOn(abtChromeExtensionProtocol, 'onWinscopeEvent'),
      spyOn(appComponent, 'onWinscopeEvent'),
      spyOn(collectTracesComponent, 'onOperationFinished'),
      spyOn(collectTracesComponent, 'onProgressUpdate'),
      spyOn(collectTracesComponent, 'onWinscopeEvent'),
      spyOn(crossToolProtocol, 'onWinscopeEvent'),
      spyOn(timelineComponent, 'onWinscopeEvent'),
      spyOn(timelineData, 'initialize').and.callThrough(),
      spyOn(LegacyToPerfettoConverter.prototype, 'convert').and.callThrough(),
      spyOn(FileLoader.prototype, 'onWinscopeEvent'),
      spyOn(traceViewComponent, 'onWinscopeEvent'),
      spyOn(uploadTracesComponent, 'onWinscopeEvent'),
      spyOn(uploadTracesComponent, 'onProgressUpdate'),
      spyOn(uploadTracesComponent, 'onOperationFinished'),
      spyOn(viewerStub0, 'onWinscopeEvent'),
      spyOn(viewerStub1, 'onWinscopeEvent'),
      spyOn(viewerOverlay, 'onWinscopeEvent'),
      spyOn(viewerDump, 'onWinscopeEvent'),
    ];
  });

  it('notifies ABT chrome extension about app initialization', async () => {
    expect(abtChromeExtensionProtocol.onWinscopeEvent).not.toHaveBeenCalled();

    await mediator.onWinscopeEvent(new AppInitialized());
    expect(abtChromeExtensionProtocol.onWinscopeEvent).toHaveBeenCalledOnceWith(
      new AppInitialized(),
    );
  });

  it('handles uploaded traces from Winscope', async () => {
    await mediator.onWinscopeEvent(new AppFilesUploaded(inputFiles));

    expect(uploadTracesComponent.onProgressUpdate).toHaveBeenCalled();
    expect(uploadTracesComponent.onOperationFinished).toHaveBeenCalled();
    expect(timelineData.initialize).not.toHaveBeenCalled();
    expect(appComponent.onWinscopeEvent).not.toHaveBeenCalled();
    expect(viewerStub0.onWinscopeEvent).not.toHaveBeenCalled();

    resetSpyCalls();
    await mediator.onWinscopeEvent(new AppTraceViewRequest());
    checkLoadTraceViewEvents(uploadTracesComponent);
    userNotifierChecker.expectNotified([]);
  });

  it('handles uploaded traces discarding legacy traces with conversion option', async () => {
    await mediator.onWinscopeEvent(new AppFilesUploaded(inputFiles));
    resetSpyCalls();
    await mediator.onWinscopeEvent(new AppTraceViewRequest(true));
    checkLoadTraceViewEvents(uploadTracesComponent);
    userNotifierChecker.expectNotified([]);
  });

  it('handles collected traces from Winscope', async () => {
    await mediator.onWinscopeEvent(
      new AppFilesCollected({
        requested: [],
        collected: [inputFiles[0], inputFiles[1]],
      }),
    );
    userNotifierChecker.expectNone();
    checkLoadTraceViewEvents(collectTracesComponent);
    checkUploadTracesComponentTraceViewEvents();
  });

  it('handles invalid collected traces from Winscope', async () => {
    await mediator.onWinscopeEvent(
      new AppFilesCollected({
        requested: [],
        collected: [await getFixtureFile('invalid_files/empty.pb')],
      }),
    );
    expect(
      userNotifierChecker.expectNotified([
        makeWarningInvalidPerfettoTrace('empty.pb', [
          'Perfetto trace has no Winscope trace entries',
        ]),
      ]),
    );
    expect(appComponent.onWinscopeEvent).not.toHaveBeenCalled();
  });

  it('handles collected traces with no entries from Winscope', async () => {
    await mediator.onWinscopeEvent(
      new AppFilesCollected({
        requested: [],
        collected: [
          await getFixtureFile(
            'invalid_files/no_entries_InputMethodClients.pb',
          ),
        ],
      }),
    );
    expect(
      userNotifierChecker.expectNotified([
        makeWarningInvalidLegacyTrace(
          ['no_entries_InputMethodClients.pb'],
          'Trace is empty',
        ),
      ]),
    );
    expect(appComponent.onWinscopeEvent).not.toHaveBeenCalled();
  });

  it('handles collected trace with no visualization from Winscope', async () => {
    await mediator.onWinscopeEvent(
      new AppFilesCollected({
        requested: [],
        collected: [shellTransitionFile],
      }),
    );
    expect(userNotifierChecker.expectNone());
    expect(appComponent.onWinscopeEvent).not.toHaveBeenCalled();
    checkUploadTracesComponentTraceViewEvents();
  });

  it('handles empty collected traces from Winscope', async () => {
    await mediator.onWinscopeEvent(
      new AppFilesCollected({
        requested: [],
        collected: [],
      }),
    );
    expect(userNotifierChecker.expectNotified([makeWarningNoValidFiles()]));
    expect(appComponent.onWinscopeEvent).not.toHaveBeenCalled();
  });

  it('handles requested traces with missing collected traces from Winscope', async () => {
    await mediator.onWinscopeEvent(
      new AppFilesCollected({
        requested: [
          {
            name: 'Collected Trace',
            types: [TraceType.SURFACE_FLINGER],
          },
          {
            name: 'Uncollected Trace',
            types: [TraceType.TRANSITION],
          },
        ],
        collected: [inputFiles[0]],
      }),
    );
    expect(
      userNotifierChecker.expectNotified([
        makeWarningNoValidFiles(['Uncollected Trace']),
      ]),
    );
    expect(appComponent.onWinscopeEvent).toHaveBeenCalled();
    checkUploadTracesComponentTraceViewEvents();
  });

  it('handles app reset request', async () => {
    await mediator.onWinscopeEvent(
      new AppFilesUploaded(inputFiles.slice(0, 2)),
    );
    await loadTraceView();
    const clearSpies = [
      ...viewers.map((v) => {
        return spyOn(v, 'onDestroy');
      }),
    ];
    await mediator.onWinscopeEvent(new AppResetRequest());
    clearSpies.forEach((spy) => expect(spy).toHaveBeenCalled());
    expect(appComponent.onWinscopeEvent).toHaveBeenCalledOnceWith(
      new ViewersUnloaded(),
    );
  });

  it('handles request to refresh dumps', async () => {
    const dumpFiles = [
      await getFixtureFile(
        'traces/elapsed_and_real_timestamp/dump_SurfaceFlinger.pb',
      ),
      wmDumpFile,
    ];
    await loadFiles(dumpFiles);
    resetSpyCalls();
    await mediator.onWinscopeEvent(new AppTraceViewRequest());
    checkLoadTraceViewEvents(uploadTracesComponent);

    await mediator.onWinscopeEvent(new AppRefreshDumpsRequest());
    expect(collectTracesComponent.onWinscopeEvent).toHaveBeenCalled();
  });

  //TODO: test "bugreport data from cross-tool protocol" when file_utils is fully compatible with
  //      Node.js (b/262269229). unzipFile() currently can't execute on Node.js.

  //TODO: test "data from ABT chrome extension" when file_utils is fully compatible with Node.js
  //      (b/262269229).

  it('handles initialized event from remote tool', async () => {
    expect(uploadTracesComponent.onProgressUpdate).toHaveBeenCalledTimes(0);

    await mediator.onWinscopeEvent(new RemoteToolInitialized());
    expect(uploadTracesComponent.onProgressUpdate).not.toHaveBeenCalled();
    expect(appComponent.onWinscopeEvent).not.toHaveBeenCalled();
  });

  it('handles waiting for files event from remote tool', async () => {
    expect(uploadTracesComponent.onProgressUpdate).toHaveBeenCalledTimes(0);

    await mediator.onWinscopeEvent(new RemoteToolWaitingForFiles());
    expect(uploadTracesComponent.onProgressUpdate).toHaveBeenCalledTimes(1);
    expect(appComponent.onWinscopeEvent).not.toHaveBeenCalled();
  });

  it('handles start download event from remote tool', async () => {
    expect(uploadTracesComponent.onProgressUpdate).toHaveBeenCalledTimes(0);

    await mediator.onWinscopeEvent(new RemoteToolDownloadStart());
    expect(uploadTracesComponent.onProgressUpdate).toHaveBeenCalledTimes(1);
    expect(appComponent.onWinscopeEvent).not.toHaveBeenCalled();
  });

  it('handles empty downloaded files from remote tool', async () => {
    expect(uploadTracesComponent.onOperationFinished).toHaveBeenCalledTimes(0);

    // Pass files even if empty so that the upload component will update the progress bar
    // and display error messages
    await mediator.onWinscopeEvent(new RemoteToolFilesReceived([]));
    expect(uploadTracesComponent.onOperationFinished).toHaveBeenCalledTimes(1);
  });

  it('notifies overlay viewer of expanded timeline toggle change', async () => {
    await loadFiles();
    await loadTraceView();
    const event = new ExpandedTimelineToggled(true);
    await mediator.onWinscopeEvent(new ExpandedTimelineToggled(true));
    expect(viewerOverlay.onWinscopeEvent).toHaveBeenCalledWith(event);
  });

  it('propagates trace position update', async () => {
    await loadFiles();
    await loadTraceView();

    // notify position
    resetSpyCalls();
    await mediator.onWinscopeEvent(new TracePositionUpdate(POSITION_10));
    checkTracePositionUpdateEvents(
      [viewerStub0, viewerOverlay, timelineComponent, crossToolProtocol],
      [],
      POSITION_10,
    );

    // notify position
    resetSpyCalls();
    await mediator.onWinscopeEvent(new TracePositionUpdate(POSITION_11));
    checkTracePositionUpdateEvents(
      [viewerStub0, viewerOverlay, timelineComponent, crossToolProtocol],
      [],
      POSITION_11,
    );
  });

  it('propagates trace position update and updates timeline data', async () => {
    await loadFiles();
    await loadTraceView();

    // notify position
    resetSpyCalls();
    const finalTimestampNs = timelineData.getFullTimeRange().endNs;
    const timestamp = makeRealTimestamp(finalTimestampNs);
    const position = TracePosition.fromTimestamp(timestamp);

    await mediator.onWinscopeEvent(new TracePositionUpdate(position, true));
    checkTracePositionUpdateEvents(
      [viewerStub0, viewerOverlay, timelineComponent, crossToolProtocol],
      [],
      position,
    );
    expect(
      assertDefined(timelineData.getCurrentPosition()).timestamp.getValueNs(),
    ).toEqual(finalTimestampNs);
  });

  it('propagates trace position update including prefetchedEntry', async () => {
    await loadFiles();
    await loadTraceView();

    // notify position
    resetSpyCalls();
    const finalTimestampNs = timelineData.getFullTimeRange().endNs;
    const timestamp = makeRealTimestamp(finalTimestampNs);
    const position = TracePosition.fromTimestamp(timestamp);
    const prefetchedEntry = jasmine.createSpyObj<
      TraceEntry<HierarchyTreeNode, HierarchyTreeNode>
    >('prefetchedEntry', ['getValue']);

    const event = new TracePositionUpdate(position, undefined, {
      trace: prefetchedEntry,
      screenRecording: undefined,
      seek: timestamp,
    });
    await mediator.onWinscopeEvent(event);
    userNotifierChecker.expectNone();
    [viewerStub0, viewerOverlay, timelineComponent].forEach((listener) => {
      expect(listener.onWinscopeEvent).toHaveBeenCalledOnceWith(event);
    });
  });

  it('propagates trace position update including seekPos', async () => {
    await loadFiles();
    await loadTraceView();

    // notify position
    resetSpyCalls();
    const timelineRange = timelineData.getFullTimeRange();
    const positionTs = makeRealTimestamp(timelineRange.endNs);
    const position = TracePosition.fromTimestamp(positionTs);

    const event = new TracePositionUpdate(position, undefined, {
      trace: undefined,
      screenRecording: undefined,
      seek: makeRealTimestamp(timelineRange.startNs),
    });
    await mediator.onWinscopeEvent(event);
    userNotifierChecker.expectNone();
    [viewerStub0, viewerOverlay, timelineComponent].forEach((listener) => {
      expect(listener.onWinscopeEvent).toHaveBeenCalledOnceWith(event);
    });
  });

  it("initializes viewers' trace position also when loaded traces have no valid timestamps", async () => {
    await mediator.onWinscopeEvent(new AppFilesUploaded([wmDumpFile]));

    resetSpyCalls();
    await mediator.onWinscopeEvent(new AppTraceViewRequest());
    checkLoadTraceViewEvents(uploadTracesComponent);
    userNotifierChecker.expectNotified([]);
  });

  it('filters traces without visualization on loading viewers', async () => {
    const fileWithoutVisualization = shellTransitionFile;
    await loadFiles();
    await mediator.onWinscopeEvent(
      new AppFilesUploaded([fileWithoutVisualization]),
    );
    await loadTraceView();
  });

  describe('timestamp received from remote tool', () => {
    it('propagates trace position update', async () => {
      await loadFiles();
      await loadTraceView();
      const traceSfEntry = assertDefined(
        loadedFileData.getTraces().getTrace(TraceType.SURFACE_FLINGER),
      ).getEntry(2);

      // receive timestamp
      resetSpyCalls();
      await mediator.onWinscopeEvent(
        new RemoteToolTimestampReceived(() => traceSfEntry.getTimestamp()),
      );

      checkTracePositionUpdateEvents(
        [viewerStub0, viewerOverlay, timelineComponent],
        [],
        TracePosition.fromTraceEntry(traceSfEntry),
      );
    });

    it("doesn't propagate timestamp back to remote tool", async () => {
      await loadFiles();
      await loadTraceView();

      // receive timestamp
      resetSpyCalls();
      await mediator.onWinscopeEvent(
        new RemoteToolTimestampReceived(() => TIMESTAMP_10),
      );
      checkTracePositionUpdateEvents(
        [viewerStub0, viewerOverlay, timelineComponent],
        [],
      );
    });

    it('defers trace position propagation till traces are loaded and visualized', async () => {
      // ensure converter has been used to create real timestamps
      loadedFileData.getTimestampConverter().makeTimestampFromRealNs(0n);

      // load files but do not load trace view
      await loadFiles();
      expect(timelineComponent.onWinscopeEvent).not.toHaveBeenCalled();

      // keep timestamp for later
      await mediator.onWinscopeEvent(
        new RemoteToolTimestampReceived(() => {
          return makeRealTimestamp(1659107089233029344n);
        }),
      );
      expect(timelineComponent.onWinscopeEvent).not.toHaveBeenCalled();

      // keep timestamp for later (replace previous one)
      await mediator.onWinscopeEvent(
        new RemoteToolTimestampReceived(() => {
          return makeRealTimestamp(1659107090005226366n);
        }),
      );
      expect(timelineComponent.onWinscopeEvent).not.toHaveBeenCalled();

      // apply timestamp
      await loadTraceView();
      const traceSf = assertDefined(
        loadedFileData.getTraces().getTrace(TraceType.SURFACE_FLINGER),
      );

      expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledWith(
        makeExpectedTracePositionUpdate(
          TracePosition.fromTraceEntry(traceSf.getEntry(2)),
        ),
      );
    });
  });

  describe('tab view switches', () => {
    it('forwards switch notifications', async () => {
      await loadFiles();
      await loadTraceView();
      resetSpyCalls();

      await mediator.onWinscopeEvent(new TabbedViewSwitched(viewerStub1));
      expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledWith(
        new ActiveTraceChanged(viewerStub1.getTraces()[0]),
      );
      userNotifierChecker.expectNotified([]);
      userNotifierChecker.reset();
      await mediator.onWinscopeEvent(new TabbedViewSwitched(viewerDump));
      expect(timelineComponent.onWinscopeEvent).not.toHaveBeenCalledWith(
        new ActiveTraceChanged(viewerDump.getTraces()[0]),
      );
      userNotifierChecker.expectNotified([]);
    });

    it('forwards switch requests from viewers to trace view component', async () => {
      await loadFiles();
      await loadTraceView();
      expect(traceViewComponent.onWinscopeEvent).not.toHaveBeenCalled();

      await viewerStub0.emitAppEventForTesting(
        new TabbedViewSwitchRequest(traceSf, 'metadata'),
      );
      expect(traceViewComponent.onWinscopeEvent).toHaveBeenCalledOnceWith(
        new TabbedViewSwitchRequest(traceSf, 'metadata'),
      );
      userNotifierChecker.expectNotified([]);
    });
  });

  it('notifies only visible viewers about trace position updates', async () => {
    await loadFiles();
    await loadTraceView();

    // Position update -> update only visible viewers
    // Note: Viewer 0 is visible (gets focus) upon UI initialization
    resetSpyCalls();
    await mediator.onWinscopeEvent(new TracePositionUpdate(POSITION_10));
    checkTracePositionUpdateEvents(
      [viewerStub0, viewerOverlay, timelineComponent, crossToolProtocol],
      [],
      POSITION_10,
    );

    // Tab switch -> update only newly visible viewers
    // Note: overlay viewer is considered always visible
    resetSpyCalls();
    await mediator.onWinscopeEvent(new TabbedViewSwitched(viewerStub1));
    userNotifierChecker.expectNone();
    const tracePositionUpdate = makeExpectedTracePositionUpdate(undefined);
    const activeTraceChanged = new ActiveTraceChanged(
      viewerStub1.getTraces()[0],
    );
    expect(viewerStub0.onWinscopeEvent).toHaveBeenCalledOnceWith(
      activeTraceChanged,
    );
    expect(viewerDump.onWinscopeEvent).toHaveBeenCalledOnceWith(
      activeTraceChanged,
    );

    expect(viewerStub1.onWinscopeEvent).toHaveBeenCalledWith(
      tracePositionUpdate,
    );
    expect(viewerStub1.onWinscopeEvent).toHaveBeenCalledWith(
      activeTraceChanged,
    );

    expect(viewerOverlay.onWinscopeEvent).toHaveBeenCalledWith(
      tracePositionUpdate,
    );
    expect(viewerOverlay.onWinscopeEvent).toHaveBeenCalledWith(
      activeTraceChanged,
    );

    expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledWith(
      tracePositionUpdate,
    );
    expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledWith(
      activeTraceChanged,
    );

    expect(crossToolProtocol.onWinscopeEvent).toHaveBeenCalledOnceWith(
      tracePositionUpdate,
    );

    // Position update -> update only visible viewers
    // Note: overlay viewer is considered always visible
    resetSpyCalls();
    await mediator.onWinscopeEvent(new TracePositionUpdate(POSITION_10));
    checkTracePositionUpdateEvents(
      [viewerStub1, viewerOverlay, timelineComponent, crossToolProtocol],
      [],
    );
  });

  it('notifies timeline of dark mode toggle', async () => {
    const event = new DarkModeToggled(true);
    await mediator.onWinscopeEvent(event);
    expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledOnceWith(event);
  });

  it('notifies timeline and viewers of active trace change if successful', async () => {
    await loadFiles();
    await loadTraceView();
    resetSpyCalls();

    await mediator.onWinscopeEvent(new ActiveTraceChanged(traceDump));
    expect(timelineComponent.onWinscopeEvent).not.toHaveBeenCalled();
    viewers.forEach((viewer) => {
      expect(viewer.onWinscopeEvent).not.toHaveBeenCalled();
    });

    const activeTraceChanged = new ActiveTraceChanged(
      viewerStub1.getTraces()[0],
    );
    await mediator.onWinscopeEvent(activeTraceChanged);
    expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledOnceWith(
      activeTraceChanged,
    );
    viewers.forEach((viewer) =>
      expect(viewer.onWinscopeEvent).toHaveBeenCalledOnceWith(
        activeTraceChanged,
      ),
    );
  });

  it('notifies user of no trace targets selected', async () => {
    await mediator.onWinscopeEvent(new NoTraceTargetsSelectedEvent());
    userNotifierChecker.expectNotified([makeWarningNoTraceTargetsSelected()]);
  });

  it('notifies correct viewer of filter preset requests', async () => {
    await loadFiles();
    await loadTraceView();
    resetSpyCalls();

    const saveRequest = new FilterPresetSaveRequest(
      'test_preset',
      TraceType.SURFACE_FLINGER,
    );
    await mediator.onWinscopeEvent(saveRequest);

    const applyRequest = new FilterPresetApplyRequest(
      'test_preset',
      TraceType.WINDOW_MANAGER,
    );
    await mediator.onWinscopeEvent(applyRequest);

    await mediator.onWinscopeEvent(
      new FilterPresetSaveRequest('test_preset', TraceType.PROTO_LOG),
    );
    await mediator.onWinscopeEvent(
      new FilterPresetApplyRequest('test_preset', TraceType.PROTO_LOG),
    );

    expect(viewerStub0.onWinscopeEvent).toHaveBeenCalledOnceWith(saveRequest);
    expect(viewerStub1.onWinscopeEvent).toHaveBeenCalledOnceWith(applyRequest);
  });

  it('initializes trace search', async () => {
    const searchViewer = await loadPerfettoFilesAndReturnSearchViewer();
    const spy = spyOn(
      TraceSearchInitializer,
      'createSearchViews',
    ).and.returnValue(Promise.resolve(['test']));
    const initializeRequest = new InitializeTraceSearchRequest();
    await mediator.onWinscopeEvent(initializeRequest);
    expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledWith(
      initializeRequest,
    );
    expect(spy).toHaveBeenCalledTimes(1);
    const initializedEvent = new TraceSearchInitialized(['test']);
    expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledWith(
      initializedEvent,
    );
    expect(searchViewer.onWinscopeEvent).toHaveBeenCalledWith(initializedEvent);
  });

  it('handles trace search request for successful queries', async () => {
    const searchViewer = await loadPerfettoFilesAndReturnSearchViewer();
    await requestSearch('select ts from surfaceflinger_layers_snapshot');
    checkNewSearchTracePropagation(searchViewer, true);
    await requestSearch('select id from surfaceflinger_layers_snapshot');
    checkNewSearchTracePropagation(searchViewer, false);
  });

  it('handles trace search request for unsuccessful query', async () => {
    const searchViewer = await loadPerfettoFilesAndReturnSearchViewer();
    await requestSearch('select * from fake_table');
    expect(searchViewer.onWinscopeEvent).toHaveBeenCalledWith(
      new TraceSearchFailed(),
    );
    expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledWith(
      new TraceSearchCompleted(),
    );
  });

  it('handles trace removal requests', async () => {
    await loadPerfettoFilesAndReturnSearchViewer();
    await requestSearch('select ts from surfaceflinger_layers_snapshot');
    await removeSearchTraceAndCheckPropagation(true);
    await requestSearch('select id from surfaceflinger_layers_snapshot');
    await removeSearchTraceAndCheckPropagation(false);
  });

  it('handles BR file selection requests', async () => {
    const request = new BugreportFileSelectionRequest(['f1']);
    await mediator.onWinscopeEvent(request);
    expect(appComponent.onWinscopeEvent).toHaveBeenCalledOnceWith(request);

    const selection = new BugreportFileSelected('f1');
    await mediator.onWinscopeEvent(selection);
    expect(FileLoader.prototype.onWinscopeEvent).not.toHaveBeenCalled();

    const uploadPromise = mediator.onWinscopeEvent(
      new AppFilesUploaded(inputFiles),
    );
    await mediator.onWinscopeEvent(selection);
    expect(FileLoader.prototype.onWinscopeEvent).toHaveBeenCalledOnceWith(
      selection,
    );
    await uploadPromise;
  });

  it('sends warning banner event on file upload warning', async () => {
    const bugreport = await getFixtureFile('bugreports/bugreport_no_trace.zip');
    await mediator.onWinscopeEvent(new AppFilesUploaded([bugreport]));

    expect(uploadTracesComponent.onWinscopeEvent).toHaveBeenCalledWith(
      jasmine.objectContaining({
        message: jasmine.stringMatching(
          /^No Winscope Perfetto trace found in bug report/,
        ),
      }),
    );
  });

  describe('Playback state change event handling', () => {
    beforeEach(async () => {
      await loadFiles();
      await loadTraceView();
      resetSpyCalls();
    });

    it('propagates to the visible viewer matching the trace type', async () => {
      const traceGeometryData = new TraceGeometryData(
        new Map([[0n, new Rect(0, 0, 0, 0)]]),
        new Map([[0n, new TransformMatrix(1, 1, 1, 1, 1, 1)]]),
      );
      const event = new PlaybackStateChangeRequest(
        TraceType.SURFACE_FLINGER,
        PlaybackState.FORWARDS,
        0,
      );
      spyOn(loadedFileData, 'getTraceGeometryData').and.returnValue(
        traceGeometryData,
      );

      await mediator.onWinscopeEvent(event);

      expect(viewerStub0.onWinscopeEvent).toHaveBeenCalledOnceWith(
        new PlaybackStateChangePropagate(
          PlaybackState.FORWARDS,
          0,
          traceGeometryData,
        ),
      );
      expect(viewerStub1.onWinscopeEvent).not.toHaveBeenCalled();
    });

    it('does not propagate if the matching viewer is not visible', async () => {
      const event = new PlaybackStateChangeRequest(
        TraceType.WINDOW_MANAGER,
        PlaybackState.FORWARDS,
        0,
      );
      await mediator.onWinscopeEvent(event);

      expect(viewerStub0.onWinscopeEvent).not.toHaveBeenCalled();
      expect(viewerStub1.onWinscopeEvent).not.toHaveBeenCalled();
    });

    it('does not propagate if no viewer matches the trace type', async () => {
      const event = new PlaybackStateChangeRequest(
        TraceType.PROTO_LOG,
        PlaybackState.FORWARDS,
        0,
      );
      await mediator.onWinscopeEvent(event);

      expect(viewerStub0.onWinscopeEvent).not.toHaveBeenCalled();
      expect(viewerStub1.onWinscopeEvent).not.toHaveBeenCalled();
    });

    it('once handled propagates to the timeline component and overlays', async () => {
      const event = new PlaybackStateChangeHandled(PlaybackState.FORWARDS);
      await mediator.onWinscopeEvent(event);
      expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledWith(event);
      expect(viewerOverlay.onWinscopeEvent).toHaveBeenCalledWith(event);
    });
  });

  describe('PlaybackSpeedChange event handling', () => {
    beforeEach(async () => {
      await loadFiles();
      await loadTraceView();
      resetSpyCalls();
    });

    it('propagates to the viewer matching the trace type', async () => {
      const event = new PlaybackSpeedChange(TraceType.SURFACE_FLINGER, 2);
      await mediator.onWinscopeEvent(event);

      expect(viewerStub0.onWinscopeEvent).toHaveBeenCalledOnceWith(event);
      expect(viewerStub1.onWinscopeEvent).not.toHaveBeenCalled();
    });

    it('does not propagate if no viewer matches the trace type', async () => {
      const event = new PlaybackSpeedChange(TraceType.PROTO_LOG, 2);
      await mediator.onWinscopeEvent(event);

      expect(viewerStub0.onWinscopeEvent).not.toHaveBeenCalled();
      expect(viewerStub1.onWinscopeEvent).not.toHaveBeenCalled();
    });
  });

  it('notifies app component of bookmarks changed', async () => {
    const event = new BookmarksChanged([]);
    await mediator.onWinscopeEvent(event);
    expect(appComponent.onWinscopeEvent).toHaveBeenCalledOnceWith(event);
  });

  it('notifies app component of active search queries update and updates its internal state', async () => {
    const queries = ['query1', 'query2'];
    const event = new ActiveSearchQueriesUpdate(queries);
    expect(mediator.getActiveSearchQueries()).toEqual([]);
    await mediator.onWinscopeEvent(event);
    expect(appComponent.onWinscopeEvent).toHaveBeenCalledOnceWith(event);
    expect(mediator.getActiveSearchQueries()).toEqual(queries);
  });

  it('handles screen recording change', async () => {
    await loadFiles();
    await loadTraceView();
    const timelineDataSpy = spyOn(
      timelineData,
      'updateCurrentScreenRecordingTrace',
    );

    const trace = new TraceBuilder<MediaBasedTraceEntry>()
      .setEntries([])
      .setType(TraceType.SCREEN_RECORDING)
      .build();
    const event = new ScreenRecordingChange(trace);
    await mediator.onWinscopeEvent(event);

    expect(timelineDataSpy).toHaveBeenCalledOnceWith(trace);
    expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledWith(event);

    viewers.forEach((viewer) => {
      expect(viewer.onWinscopeEvent).toHaveBeenCalledWith(event);
    });
  });

  async function loadFiles(files = inputFiles) {
    for (const file of files) {
      await mediator.onWinscopeEvent(new AppFilesUploaded([file]));
    }
    userNotifierChecker.expectNone();
  }

  async function loadTraceView(
    expectedViewers = viewers,
    viewersToReassignTraces = [viewerStub0, viewerStub1],
  ) {
    // Simulate "View traces" button click
    resetSpyCalls();
    await mediator.onWinscopeEvent(new AppTraceViewRequest(false));

    checkLoadTraceViewEvents(uploadTracesComponent, expectedViewers);
    viewersToReassignTraces.forEach((viewer) =>
      reassignViewerStubTrace(viewer),
    );

    // Simulate notification of TraceViewComponent about initially selected/focused tab
    resetSpyCalls();
    await mediator.onWinscopeEvent(new TabbedViewSwitched(viewerStub0));

    expect(viewerStub0.onWinscopeEvent).toHaveBeenCalledOnceWith(
      makeExpectedTracePositionUpdate(),
    );
    expect(viewerStub1.onWinscopeEvent).not.toHaveBeenCalled();
    userNotifierChecker.expectNotified([]);
  }

  function reassignViewerStubTrace(viewerStub: ViewerStub) {
    const viewerStubTraces = viewerStub.getTraces();
    viewerStubTraces[0] = assertDefined(
      loadedFileData.getTraces().getTrace(viewerStubTraces[0].type),
    );
  }

  function checkLoadTraceViewEvents(
    progressListener: ProgressListener,
    expectedViewers = viewers,
    notifications: UserWarning[] = [],
  ) {
    expect(progressListener.onProgressUpdate).toHaveBeenCalled();
    // For successful loading we should never call onOperationFinished. The
    // UI should reflect the progress of a sequence of operations through calls
    // to onProgressUpdate before directly rendering the trace view.
    expect(progressListener.onOperationFinished).not.toHaveBeenCalled();
    expect(timelineData.initialize).toHaveBeenCalledTimes(1);
    expect(appComponent.onWinscopeEvent).toHaveBeenCalledOnceWith(
      new ViewersLoaded(
        expectedViewers,
        expectedViewers[0].getTraces()[0].type,
      ),
    );

    // Mediator triggers the viewers initialization
    // by sending them a "trace position update" event
    checkTracePositionUpdateEvents(
      (expectedViewers as WinscopeEventListener[]).concat([timelineComponent]),
      notifications,
    );
  }

  function checkUploadTracesComponentTraceViewEvents() {
    const uploadTracesSpy =
      uploadTracesComponent.onWinscopeEvent as jasmine.Spy;
    expect(uploadTracesSpy.calls.allArgs()).toEqual([
      [new AppTraceViewRequest()],
      [new AppTraceViewRequestHandled()],
    ]);
  }

  function checkTracePositionUpdateEvents(
    listenersToBeNotified: WinscopeEventListener[],
    userNotifications: UserWarning[],
    position?: TracePosition,
    crossToolProtocolPosition = position,
  ) {
    userNotifierChecker.expectNotified(userNotifications);
    const event = makeExpectedTracePositionUpdate(position);
    const crossToolProtocolEvent =
      crossToolProtocolPosition !== position
        ? makeExpectedTracePositionUpdate(crossToolProtocolPosition)
        : event;
    tracePositionUpdateListeners.forEach((listener) => {
      const isVisible = listenersToBeNotified.includes(listener);
      if (isVisible) {
        const expected =
          listener === crossToolProtocol ? crossToolProtocolEvent : event;
        expect(listener.onWinscopeEvent).toHaveBeenCalledOnceWith(expected);
      } else {
        expect(listener.onWinscopeEvent).not.toHaveBeenCalled();
      }
    });
  }

  function resetSpyCalls() {
    spies.forEach((spy) => {
      spy.calls.reset();
    });
    userNotifierChecker.reset();
  }

  async function loadPerfettoFilesAndReturnSearchViewer(): Promise<ViewerStub> {
    await loadFiles([perfettoFile]);
    const searchViewer = new ViewerStub(
      'search',
      undefined,
      undefined,
      ViewType.GLOBAL_SEARCH,
    );
    spyOn(searchViewer, 'onWinscopeEvent');
    const expectedViewers = [viewerStub0, searchViewer];
    createViewersSpy.and.returnValue(expectedViewers);
    await loadTraceView(expectedViewers, [viewerStub0]);
    resetSpyCalls();
    return searchViewer;
  }

  async function requestSearch(query: string) {
    const event = new TraceSearchRequest(query);
    await mediator.onWinscopeEvent(event);
    expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledWith(event);
  }

  function checkNewSearchTracePropagation(
    searchViewer: ViewerStub,
    hasTimestamps: boolean,
  ) {
    const searchTraces = loadedFileData.getTraces().getTraces(TraceType.SEARCH);
    const newTrace = searchTraces[searchTraces.length - 1];
    const newTraceEvent = new TraceAddRequest(newTrace);
    expect(searchViewer.onWinscopeEvent).toHaveBeenCalledWith(newTraceEvent);
    expect(timelineComponent.onWinscopeEvent).toHaveBeenCalledWith(
      new TraceSearchCompleted(),
    );
    expect(timelineData.hasTrace(newTrace)).toEqual(hasTimestamps);
    const timelineComponentSpy = timelineComponent.onWinscopeEvent;
    if (hasTimestamps) {
      expect(timelineComponentSpy).toHaveBeenCalledWith(newTraceEvent);
    } else {
      expect(timelineComponentSpy).not.toHaveBeenCalledWith(newTraceEvent);
    }
  }

  async function removeSearchTraceAndCheckPropagation(hasTimestamps: boolean) {
    const traces = loadedFileData.getTraces();
    const searchTraces = traces.getTraces(TraceType.SEARCH);
    const newTrace = searchTraces[searchTraces.length - 1];
    const removalRequest = new TraceRemoveRequest(newTrace);
    await mediator.onWinscopeEvent(removalRequest);
    expect(traces.hasTrace(newTrace)).toBeFalse();
    expect(timelineData.hasTrace(newTrace)).toBeFalse();
    const timelineComponentSpy = timelineComponent.onWinscopeEvent;
    if (hasTimestamps) {
      expect(timelineComponentSpy).toHaveBeenCalledWith(removalRequest);
    } else {
      expect(timelineComponentSpy).not.toHaveBeenCalledWith(removalRequest);
    }
  }

  function makeExpectedTracePositionUpdate(
    tracePosition: TracePosition = TracePosition.fromTimestamp(
      TIMESTAMP_INVALID,
    ),
  ): TracePositionUpdate {
    return new TracePositionUpdate(tracePosition, undefined);
  }

  function tracePositionUpdateEqualityTester(
    first: unknown,
    second: unknown,
  ): boolean | undefined {
    if (
      first instanceof TracePositionUpdate &&
      second instanceof TracePositionUpdate
    ) {
      return testTracePositionUpdates(first, second);
    }
    return undefined;
  }

  function testTracePositionUpdates(
    event: TracePositionUpdate,
    expectedEvent: TracePositionUpdate,
  ): boolean {
    if (expectedEvent.position.timestamp === TIMESTAMP_INVALID) {
      return true;
    }
    if (
      event.position.timestamp.getValueNs() !==
      expectedEvent.position.timestamp.getValueNs()
    ) {
      return false;
    }
    if (
      event.position.timestamp.format() !==
      expectedEvent.position.timestamp.format()
    ) {
      return false;
    }
    if (event.position.frame !== expectedEvent.position.frame) return false;
    if (
      event.prefetchedEntries?.trace !== expectedEvent.prefetchedEntries?.trace
    ) {
      return false;
    }
    if (
      event.prefetchedEntries?.screenRecording !==
      expectedEvent.prefetchedEntries?.screenRecording
    ) {
      return false;
    }
    if (
      event.prefetchedEntries?.seek !== expectedEvent.prefetchedEntries?.seek
    ) {
      return false;
    }
    return true;
  }
});

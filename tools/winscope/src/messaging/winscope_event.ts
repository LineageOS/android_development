/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {assertTrue} from 'common/assert';
import {Timestamp} from 'common/time/time';
import {Trace, TraceEntry} from 'trace_api/trace';
import {TracePosition} from 'trace_api/trace_position';
import {TraceType} from 'trace_api/trace_type';
import {AdbFiles} from 'trace_collection/adb_files';
import {View, Viewer, ViewType} from 'viewers/viewer';
import {PlaybackState} from 'viewers/common/playback/playback_state';

/**
 * An enum for Winscope event types.
 */
export enum WinscopeEventType {
  APP_INITIALIZED,
  APP_FILES_COLLECTED,
  APP_FILES_UPLOADED,
  APP_RESET_REQUEST,
  APP_TRACE_VIEW_REQUEST,
  APP_TRACE_VIEW_REQUEST_HANDLED,
  APP_REFRESH_DUMPS_REQUEST,
  BUGREPORT_FILE_SELECTED,
  BUGREPORT_FILE_SELECTION_REQUEST,
  REMOTE_TOOL_DOWNLOAD_START,
  REMOTE_TOOL_FILES_RECEIVED,
  REMOTE_TOOL_TIMESTAMP_RECEIVED,
  TABBED_VIEW_SWITCHED,
  TABBED_VIEW_SWITCH_REQUEST,
  TRACE_POSITION_UPDATE,
  VIEWERS_LOADED,
  VIEWERS_UNLOADED,
  EXPANDED_TIMELINE_TOGGLED,
  ACTIVE_TRACE_CHANGED,
  DARK_MODE_TOGGLED,
  NO_TRACE_TARGETS_SELECTED,
  FILTER_PRESET_SAVE_REQUEST,
  FILTER_PRESET_APPLY_REQUEST,
  TRACE_SEARCH_REQUEST,
  TRACE_SEARCH_FAILED,
  TRACE_SEARCH_COMPLETED,
  TRACE_ADD_REQUEST,
  TRACE_REMOVE_REQUEST,
  INITIALIZE_TRACE_SEARCH_REQUEST,
  TRACE_SEARCH_INITIALIZED,
  SHOW_TRACE_UPLOAD_WARNING,
  PLAYBACK_STATE_CHANGE_REQUEST,
  PLAYBACK_STATE_CHANGE_HANDLED,
  PLAYBACK_SPEED_CHANGE,
}

interface TypeMap {
  [WinscopeEventType.APP_INITIALIZED]: AppInitialized;
  [WinscopeEventType.APP_FILES_COLLECTED]: AppFilesCollected;
  [WinscopeEventType.APP_FILES_UPLOADED]: AppFilesUploaded;
  [WinscopeEventType.APP_RESET_REQUEST]: AppResetRequest;
  [WinscopeEventType.APP_TRACE_VIEW_REQUEST]: AppTraceViewRequest;
  [WinscopeEventType.APP_TRACE_VIEW_REQUEST_HANDLED]: AppTraceViewRequestHandled;
  [WinscopeEventType.APP_REFRESH_DUMPS_REQUEST]: AppRefreshDumpsRequest;
  [WinscopeEventType.BUGREPORT_FILE_SELECTED]: BugreportFileSelected;
  [WinscopeEventType.BUGREPORT_FILE_SELECTION_REQUEST]: BugreportFileSelectionRequest;
  [WinscopeEventType.REMOTE_TOOL_DOWNLOAD_START]: RemoteToolDownloadStart;
  [WinscopeEventType.REMOTE_TOOL_FILES_RECEIVED]: RemoteToolFilesReceived;
  [WinscopeEventType.REMOTE_TOOL_TIMESTAMP_RECEIVED]: RemoteToolTimestampReceived;
  [WinscopeEventType.TABBED_VIEW_SWITCHED]: TabbedViewSwitched;
  [WinscopeEventType.TABBED_VIEW_SWITCH_REQUEST]: TabbedViewSwitchRequest;
  [WinscopeEventType.TRACE_POSITION_UPDATE]: TracePositionUpdate;
  [WinscopeEventType.VIEWERS_LOADED]: ViewersLoaded;
  [WinscopeEventType.VIEWERS_UNLOADED]: ViewersUnloaded;
  [WinscopeEventType.EXPANDED_TIMELINE_TOGGLED]: ExpandedTimelineToggled;
  [WinscopeEventType.ACTIVE_TRACE_CHANGED]: ActiveTraceChanged;
  [WinscopeEventType.DARK_MODE_TOGGLED]: DarkModeToggled;
  [WinscopeEventType.NO_TRACE_TARGETS_SELECTED]: NoTraceTargetsSelected;
  [WinscopeEventType.FILTER_PRESET_SAVE_REQUEST]: FilterPresetSaveRequest;
  [WinscopeEventType.FILTER_PRESET_APPLY_REQUEST]: FilterPresetApplyRequest;
  [WinscopeEventType.TRACE_SEARCH_REQUEST]: TraceSearchRequest;
  [WinscopeEventType.TRACE_SEARCH_FAILED]: TraceSearchFailed;
  [WinscopeEventType.TRACE_ADD_REQUEST]: TraceAddRequest;
  [WinscopeEventType.TRACE_REMOVE_REQUEST]: TraceRemoveRequest;
  [WinscopeEventType.INITIALIZE_TRACE_SEARCH_REQUEST]: InitializeTraceSearchRequest;
  [WinscopeEventType.TRACE_SEARCH_INITIALIZED]: TraceSearchInitialized;
  [WinscopeEventType.TRACE_SEARCH_COMPLETED]: TraceSearchCompleted;
  [WinscopeEventType.SHOW_TRACE_UPLOAD_WARNING]: ShowTraceUploadWarning;
  [WinscopeEventType.PLAYBACK_STATE_CHANGE_REQUEST]: PlaybackStateChangeRequest;
  [WinscopeEventType.PLAYBACK_STATE_CHANGE_HANDLED]: PlaybackStateChangeHandled;
  [WinscopeEventType.PLAYBACK_SPEED_CHANGE]: PlaybackSpeedChange;
}

/**
 * An abstract class for Winscope events.
 */
export abstract class WinscopeEvent {
  abstract readonly type: WinscopeEventType;

  /**
   * Visits the event if it is of the given type.
   *
   * @param type The type of the event to visit.
   * @param callback The callback to execute if the event is of the given type.
   */
  async visit<T extends WinscopeEventType>(
    type: T,
    callback: (event: TypeMap[T]) => Promise<void>,
  ) {
    if (this.type === type) {
      const event = this as unknown as TypeMap[T];
      await callback(event);
    }
  }
}

/**
 * An event for when the application has been initialized.
 */
export class AppInitialized extends WinscopeEvent {
  override readonly type = WinscopeEventType.APP_INITIALIZED;
}

/**
 * An event for when files have been collected from a device.
 */
export class AppFilesCollected extends WinscopeEvent {
  override readonly type = WinscopeEventType.APP_FILES_COLLECTED;

  constructor(readonly files: AdbFiles) {
    super();
  }
}

/**
 * An event for when files have been uploaded by the user.
 */
export class AppFilesUploaded extends WinscopeEvent {
  override readonly type = WinscopeEventType.APP_FILES_UPLOADED;

  constructor(readonly files: File[]) {
    super();
  }
}

/**
 * An event for when a request has been made to reset the application.
 */
export class AppResetRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.APP_RESET_REQUEST;
}

/**
 * An event for when a request has been made to view traces.
 */
export class AppTraceViewRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.APP_TRACE_VIEW_REQUEST;
  constructor(readonly discardLegacyTraces = false) {
    super();
  }
}

/**
 * An event for when a request to view traces has been handled.
 */
export class AppTraceViewRequestHandled extends WinscopeEvent {
  override readonly type = WinscopeEventType.APP_TRACE_VIEW_REQUEST_HANDLED;
}

/**
 * An event for when a request has been made to refresh dumps.
 */
export class AppRefreshDumpsRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.APP_REFRESH_DUMPS_REQUEST;
}

/**
 * An event for when a download from a remote tool has started.
 */
export class RemoteToolDownloadStart extends WinscopeEvent {
  override readonly type = WinscopeEventType.REMOTE_TOOL_DOWNLOAD_START;
}

/**
 * An event for when files have been received from a remote tool.
 */
export class RemoteToolFilesReceived extends WinscopeEvent {
  override readonly type = WinscopeEventType.REMOTE_TOOL_FILES_RECEIVED;

  constructor(
    readonly files: File[],
    readonly deferredTimestamp?: () => Timestamp | undefined,
  ) {
    super();
  }
}

/**
 * An event for when a timestamp has been received from a remote tool.
 */
export class RemoteToolTimestampReceived extends WinscopeEvent {
  override readonly type = WinscopeEventType.REMOTE_TOOL_TIMESTAMP_RECEIVED;

  constructor(readonly deferredTimestamp: () => Timestamp | undefined) {
    super();
  }
}

/**
 * An event for when the tabbed view has been switched.
 */
export class TabbedViewSwitched extends WinscopeEvent {
  override readonly type = WinscopeEventType.TABBED_VIEW_SWITCHED;
  readonly newFocusedView: View;

  constructor(view: View) {
    super();
    assertTrue(
      view.type === ViewType.TRACE_TAB || view.type === ViewType.GLOBAL_SEARCH,
    );
    this.newFocusedView = view;
  }
}

/**
 * An event for when a request has been made to switch the tabbed view.
 */
export class TabbedViewSwitchRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.TABBED_VIEW_SWITCH_REQUEST;

  readonly newActiveTrace: Trace<object>;

  constructor(newActiveTrace: Trace<object>) {
    super();
    this.newActiveTrace = newActiveTrace;
  }
}

/**
 * An event for when the trace position has been updated.
 */
export class TracePositionUpdate extends WinscopeEvent {
  override readonly type = WinscopeEventType.TRACE_POSITION_UPDATE;
  readonly position: TracePosition;
  readonly updateTimeline: boolean;

  constructor(position: TracePosition, updateTimeline = false) {
    super();
    this.position = position;
    this.updateTimeline = updateTimeline;
  }

  /**
   * Creates a new TracePositionUpdate event from a timestamp.
   *
   * @param timestamp The timestamp.
   * @param updateTimeline Whether to update the timeline.
   * @return The new event.
   */
  static fromTimestamp(
    timestamp: Timestamp,
    updateTimeline = false,
  ): TracePositionUpdate {
    const position = TracePosition.fromTimestamp(timestamp);
    return new TracePositionUpdate(position, updateTimeline);
  }

  /**
   * Creates a new TracePositionUpdate event from a trace entry.
   *
   * @param entry The trace entry.
   * @param updateTimeline Whether to update the timeline.
   * @return The new event.
   */
  static fromTraceEntry(
    entry: TraceEntry<{}>,
    updateTimeline = false,
  ): TracePositionUpdate {
    const position = TracePosition.fromTraceEntry(entry);
    return new TracePositionUpdate(position, updateTimeline);
  }
}

/**
 * An event for when the viewers have been loaded.
 */
export class ViewersLoaded extends WinscopeEvent {
  override readonly type = WinscopeEventType.VIEWERS_LOADED;

  constructor(readonly viewers: Viewer[]) {
    super();
  }
}

/**
 * An event for when the viewers have been unloaded.
 */
export class ViewersUnloaded extends WinscopeEvent {
  override readonly type = WinscopeEventType.VIEWERS_UNLOADED;
}

/**
 * An event for when the expanded timeline has been toggled.
 */
export class ExpandedTimelineToggled extends WinscopeEvent {
  override readonly type = WinscopeEventType.EXPANDED_TIMELINE_TOGGLED;
  constructor(readonly isTimelineExpanded: boolean) {
    super();
  }
}

/**
 * An event for when the active trace has changed.
 */
export class ActiveTraceChanged extends WinscopeEvent {
  override readonly type = WinscopeEventType.ACTIVE_TRACE_CHANGED;
  constructor(readonly trace: Trace<object>) {
    super();
  }
}

/**
 * An event for when dark mode has been toggled.
 */
export class DarkModeToggled extends WinscopeEvent {
  override readonly type = WinscopeEventType.DARK_MODE_TOGGLED;
  constructor(readonly isDarkMode: boolean) {
    super();
  }
}

/**
 * An event for when no trace targets have been selected.
 */
export class NoTraceTargetsSelected extends WinscopeEvent {
  override readonly type = WinscopeEventType.NO_TRACE_TARGETS_SELECTED;
}

/**
 * An event for when a request has been made to save a filter preset.
 */
export class FilterPresetSaveRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.FILTER_PRESET_SAVE_REQUEST;
  constructor(
    readonly name: string,
    readonly traceType: TraceType,
  ) {
    super();
  }
}

/**
 * An event for when a request has been made to apply a filter preset.
 */
export class FilterPresetApplyRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.FILTER_PRESET_APPLY_REQUEST;
  constructor(
    readonly name: string,
    readonly traceType: TraceType,
  ) {
    super();
  }
}

/**
 * An event for when a trace search request has been made.
 */
export class TraceSearchRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.TRACE_SEARCH_REQUEST;
  constructor(readonly query: string) {
    super();
  }
}

/**
 * An event for when a trace search has failed.
 */
export class TraceSearchFailed extends WinscopeEvent {
  override readonly type = WinscopeEventType.TRACE_SEARCH_FAILED;
}

/**
 * An event for when a request has been made to add a trace.
 */
export class TraceAddRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.TRACE_ADD_REQUEST;
  constructor(readonly trace: Trace<object>) {
    super();
  }
}

/**
 * An event for when a request has been made to remove a trace.
 */
export class TraceRemoveRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.TRACE_REMOVE_REQUEST;
  constructor(readonly trace: Trace<object>) {
    super();
  }
}

/**
 * An event for when a request has been made to initialize trace search.
 */
export class InitializeTraceSearchRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.INITIALIZE_TRACE_SEARCH_REQUEST;
}

/**
 * An event for when trace search has been initialized.
 */
export class TraceSearchInitialized extends WinscopeEvent {
  override readonly type = WinscopeEventType.TRACE_SEARCH_INITIALIZED;

  constructor(readonly views: string[]) {
    super();
  }
}

/**
 * An event for when a trace search has been completed.
 */
export class TraceSearchCompleted extends WinscopeEvent {
  override readonly type = WinscopeEventType.TRACE_SEARCH_COMPLETED;
}

/**
 * An event for when a bugreport file has been selected.
 */
export class BugreportFileSelected extends WinscopeEvent {
  override readonly type = WinscopeEventType.BUGREPORT_FILE_SELECTED;

  constructor(readonly filename: string | undefined) {
    super();
  }
}

/**
 * An event for when a request has been made to select a bugreport file.
 */
export class BugreportFileSelectionRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.BUGREPORT_FILE_SELECTION_REQUEST;

  constructor(readonly filenames: string[]) {
    super();
  }
}

/**
 * An event for when a trace upload warning should be shown.
 */
export class ShowTraceUploadWarning extends WinscopeEvent {
  override readonly type = WinscopeEventType.SHOW_TRACE_UPLOAD_WARNING;

  constructor(readonly message: string) {
    super();
  }
}

/**
 * An event for when the playback state change is requested.
 *
 * @param traceType The type of the trace.
 * @param state The desired playback state (FORWARDS, BACKWARDS, or PAUSE).
 * @param currentTraceIndex Current position in the trace (relevant for FORWARDS/BACKWARDS states).
 */
export class PlaybackStateChangeRequest extends WinscopeEvent {
  override readonly type = WinscopeEventType.PLAYBACK_STATE_CHANGE_REQUEST;
  readonly traceType: TraceType;
  readonly currentTraceIndex?: number;
  readonly state: PlaybackState;

  constructor(
    traceType: TraceType,
    state: PlaybackState,
    currentTraceIndex?: number,
  ) {
    super();
    this.traceType = traceType;
    this.state = state;
    this.currentTraceIndex = currentTraceIndex;
  }
}

/**
 * An event for when the playback state change is reflected back to timeline.
 *
 * @param stateToReflect The reflected playback state (FORWARDS, BACKWARDS, or PAUSE).
 */
export class PlaybackStateChangeHandled extends WinscopeEvent {
  override readonly type = WinscopeEventType.PLAYBACK_STATE_CHANGE_HANDLED;
  readonly stateToReflect: PlaybackState;

  constructor(stateToReflect: PlaybackState) {
    super();
    this.stateToReflect = stateToReflect;
  }
}

/**
 * An event for when playback's speed should change.
 *
 * @param traceType The type of the trace.
 * @param speedValue The new speed value.
 */
export class PlaybackSpeedChange extends WinscopeEvent {
  override readonly type = WinscopeEventType.PLAYBACK_SPEED_CHANGE;
  readonly traceType: TraceType;
  readonly speedValue: number;

  constructor(traceType: TraceType, speedValue: number) {
    super();
    this.traceType = traceType;
    this.speedValue = speedValue;
  }
}

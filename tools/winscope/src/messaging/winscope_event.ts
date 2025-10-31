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
  SCREEN_RECORDING_CHANGE,
  PLAYBACK_STATE_CHANGE_PROPAGATE,
  ACTIVE_SEARCH_QUERIES_UPDATE,
  BOOKMARKS_CHANGED,
}

/**
 * An abstract class for Winscope events.
 */
export interface WinscopeEvent {}

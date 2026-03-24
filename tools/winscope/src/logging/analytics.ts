/*
 * Copyright (C) 2024 The Android Open Source Project
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

import {analyticsLogEvent} from '@common/analytics';
import {CoarseVersion} from '@trace_api/coarse_version';
import {FilesSource} from '@trace_api/files_source';
import {Parser} from '@trace_api/parser';
import {TraceType} from '@trace_api/trace_type';

const BUGANIZER_OPENED = 'buganizer_opened';
const CROSS_TOOL_SYNC = 'cross_tool_sync';
const DARK_MODE_ENABLED = 'dark_mode_enabled';
const DIFF_COMPUTATION_TIME = 'diff_computation_time';
const DOCUMENTATION_OPENED = 'documentation_opened';
const EXPANDED_TIMELINE_OPENED = 'expanded_timeline_opened';
const FETCH_COMPONENT_DATA_TIME = 'fetch_component_data_time';
const FILE_EXTRACTION_TIME = 'file_extraction_time';
const FILE_PARSING_TIME = 'file_parsing_time';
const FRAME_MAP_BUILD_TIME = 'frame_map_build_time';
const FRAME_MAP_ERROR = 'frame_map_error';
const GLOBAL_EXCEPTION = 'global_exception';
const HIERARCHY_SETTINGS = 'hierarchy_settings';
const JS_MEMORY_USAGE = 'js_memory_usage';
const LOAD_FILES_TIME = 'load_files_time';
const LOAD_VIEWERS_TIME = 'load_viewer_time';
const NAVIGATION_ZOOM_EVENT = 'navigation_zoom';
const PLAYBACK_START_REQUEST = 'playback_start_request';
const PLAYBACK_ERROR = 'playback_error';
const PROPERTIES_SETTINGS = 'properties_settings';
const PROXY_ERROR = 'proxy_error';
const PROXY_SERVER_NOT_FOUND = 'proxy_server_not_found';
const PROXY_NO_FILES_FOUND = 'proxy_no_files_found';
const RECT_SETTINGS = 'rect_settings';
const REFRESH_DUMPS = 'refresh_dumps';
const TP_GENERAL_QUERY_TIME = 'tp_general_query_time';
const TP_QUERY_EXECUTION_TIME = 'tp_query_execution_time';
const TP_QUERY_REQUESTED = 'tp_query_requested';
const TP_QUERY_FAILED = 'tp_query_failed';
const TP_QUERY_SAVED = 'tp_query_saved';
const TP_QUERY_EXPORTED_TO_CSV = 'tp_query_exported_to_csv';
const TP_QUERY_EXPORT_FAILED = 'tp_query_export_failed';
const TP_SEARCH_INITIALIZATION_TIME = 'tp_search_initialization_time';
const TIME_BOOKMARK = 'time_bookmark';
const TIME_COPIED = 'time_copied';
const TIME_INPUT = 'time_input';
const TIME_PROPAGATED = 'time_propagated';
const TRACE_TAB_SWITCHED = 'trace_tab_switched';
const TRACE_TIMELINE_DESELECTED = 'trace_timeline_deselected';
const TRACING_COLLECT_DUMP = 'tracing_collect_dump';
const TRACING_COLLECT_TRACE = 'tracing_collect_trace';
const TRACING_LOADED_EVENT = 'tracing_trace_loaded';
const TRACING_OPEN_FROM_ABT = 'tracing_from_abt';
const TRACING_OPEN_FROM_REMOTE_TOOL = 'tracing_from_remote_tool';
const TRACING_START_TIME = 'tracing_start_time';
const USER_WARNING = 'user_warning';
const VIEWER_INITIALIZATION_TIME = 'viewer_initialization_time';

export const Analytics = {
  Error: {
    logGlobalException(description: string) {
      analyticsLogEvent(GLOBAL_EXCEPTION, {
        description,
      } as Gtag.CustomParams);
    },
    logProxyError(description: string) {
      analyticsLogEvent(PROXY_ERROR, {
        description,
      } as Gtag.CustomParams);
    },
    logFrameMapError(description: string) {
      analyticsLogEvent(FRAME_MAP_ERROR, {
        description,
      } as Gtag.CustomParams);
    },
    logPlaybackError(description: string) {
      analyticsLogEvent(PLAYBACK_ERROR, {
        description,
      } as Gtag.CustomParams);
    },
  },

  Help: {
    logDocumentationOpened() {
      analyticsLogEvent(DOCUMENTATION_OPENED);
    },

    logBuganizerOpened() {
      analyticsLogEvent(BUGANIZER_OPENED);
    },
  },

  Loading: {
    logFileExtractionTime(
      type: 'bugreport' | 'device',
      ms: number,
      file_size: number,
    ) {
      logTimeMs(FILE_EXTRACTION_TIME, ms, {
        type,
        file_size,
      });
    },

    logFileParsingTime(
      type: 'perfetto' | 'legacy' | 'non_perfetto',
      files_source: FilesSource,
      ms: number,
    ) {
      logTimeMs(FILE_PARSING_TIME, ms, {
        files_source,
        type,
      });
    },

    logFrameMapBuildTime(ms: number) {
      logTimeMs(FRAME_MAP_BUILD_TIME, ms);
    },

    logLoadFilesTime(ms: number, files_source: FilesSource) {
      logTimeMs(LOAD_FILES_TIME, ms, {files_source});
    },

    logLoadViewersTime(ms: number) {
      logTimeMs(LOAD_VIEWERS_TIME, ms);
    },

    logViewerInitializationTime(
      traceType: string,
      files_source: FilesSource,
      ms: number,
    ) {
      logTimeMs(VIEWER_INITIALIZATION_TIME, ms, {
        files_source,
        traceType,
      });
    },
  },

  Memory: {
    logUsage(stage: string, params: object = {}) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const memory: Memory | undefined = (performance as any).memory;
      if (memory) {
        Object.assign(params, {
          stage,
          heapSizeLimit: memory.jsHeapSizeLimit,
          allocatedHeapSize: memory.totalJSHeapSize,
          fractionAllocated: memory.totalJSHeapSize / memory.jsHeapSizeLimit,
          usedHeapSize: memory.usedJSHeapSize,
          fractionUsed: memory.usedJSHeapSize / memory.jsHeapSizeLimit,
        });
        analyticsLogEvent(JS_MEMORY_USAGE, params);
      }
    },
  },

  Navigation: {
    logDiffComputationTime(
      component: 'hierarchy' | 'properties',
      traceType: string,
      ms: number,
    ) {
      logTimeMs(DIFF_COMPUTATION_TIME, ms, {
        component,
        traceType,
      });
    },

    logExpandedTimelineOpened() {
      analyticsLogEvent(EXPANDED_TIMELINE_OPENED);
    },

    logFetchComponentDataTime(
      component: 'hierarchy' | 'properties' | 'rects',
      traceType: string,
      withDiffs: boolean,
      ms: number,
    ) {
      logTimeMs(FETCH_COMPONENT_DATA_TIME, ms, {
        component,
        traceType,
        withDiffs,
      });
    },

    logHierarchySettingsChanged(
      option: string,
      value: boolean,
      traceType: string,
    ) {
      analyticsLogEvent(HIERARCHY_SETTINGS, {
        option,
        value,
        traceType,
      } as Gtag.CustomParams);
    },

    logPropertiesSettingsChanged(
      option: string,
      value: boolean,
      traceType: string,
    ) {
      analyticsLogEvent(PROPERTIES_SETTINGS, {
        option,
        value,
        traceType,
      } as Gtag.CustomParams);
    },

    logRectSettingsChanged(
      option: string,
      value: string | number | boolean,
      traceType: string,
    ) {
      analyticsLogEvent(RECT_SETTINGS, {
        option,
        value,
        traceType,
      } as Gtag.CustomParams);
    },

    logTabSwitched(tabTraceType: string, ms: number, first_switch: boolean) {
      logTimeMs(TRACE_TAB_SWITCHED, ms, {
        type: tabTraceType,
        first_switch,
      });
    },

    logTimeBookmark() {
      analyticsLogEvent(TIME_BOOKMARK);
    },

    logTimeCopied(type: 'ns' | 'human') {
      analyticsLogEvent(TIME_COPIED, {
        type,
      } as Gtag.CustomParams);
    },

    logTimeInput(type: 'ns' | 'human') {
      analyticsLogEvent(TIME_INPUT, {
        type,
      } as Gtag.CustomParams);
    },

    logTimePropagated(target: string, ms: number) {
      logTimeMs(TIME_PROPAGATED, ms, {target});
    },

    logTraceTimelineDeselected(type: string) {
      analyticsLogEvent(TRACE_TIMELINE_DESELECTED, {
        type,
      } as Gtag.CustomParams);
    },

    logZoom(
      type: 'scroll' | 'button' | 'reset' | 'key',
      component: 'rects' | 'timeline',
      direction?: 'in' | 'out',
    ) {
      analyticsLogEvent(NAVIGATION_ZOOM_EVENT, {
        direction,
        component,
        type,
      } as Gtag.CustomParams);
    },
  },

  Playback: {
    logStartRequest(type: 'forwards' | 'backwards') {
      analyticsLogEvent(PLAYBACK_START_REQUEST, {
        type,
      });
    },
  },

  Proxy: {
    logServerNotFound(connectionType: string) {
      analyticsLogEvent(PROXY_SERVER_NOT_FOUND, {
        connectionType,
      });
    },

    logNoFilesFound() {
      analyticsLogEvent(PROXY_NO_FILES_FOUND);
    },
  },

  Settings: {
    logDarkModeEnabled() {
      analyticsLogEvent(DARK_MODE_ENABLED);
    },
    logCrossToolSync(value: boolean) {
      analyticsLogEvent(CROSS_TOOL_SYNC, {
        value,
      } as Gtag.CustomParams);
    },
  },

  TraceProcessor: {
    logQueryExecutionTime(ms: number) {
      logTimeMs(TP_GENERAL_QUERY_TIME, ms);
    },
  },

  TraceSearch: {
    logInitializationTime(traceType: string, ms: number) {
      logTimeMs(TP_SEARCH_INITIALIZATION_TIME, ms, {
        traceType,
      });
    },
    logQueryExecutionTime(ms: number) {
      logTimeMs(TP_QUERY_EXECUTION_TIME, ms);
    },
    logQueryFailure() {
      analyticsLogEvent(TP_QUERY_FAILED);
    },
    logQueryRequested(type: 'new' | 'saved' | 'recent') {
      analyticsLogEvent(TP_QUERY_REQUESTED, {
        type,
      } as Gtag.CustomParams);
    },
    logQuerySaved() {
      analyticsLogEvent(TP_QUERY_SAVED);
    },
    logQueryExportedToCsv() {
      analyticsLogEvent(TP_QUERY_EXPORTED_TO_CSV);
    },
    logQueryExportFailed() {
      analyticsLogEvent(TP_QUERY_EXPORT_FAILED);
    },
  },

  Tracing: {
    logTraceLoaded(parser: Parser<unknown>) {
      analyticsLogEvent(TRACING_LOADED_EVENT, {
        type: TraceType[parser.getTraceType()],
        coarse_version: CoarseVersion[parser.getCoarseVersion()],
      } as Gtag.CustomParams);
    },

    logCollectDumps(requestedDumps: string[], connectionType?: string) {
      requestedDumps.forEach((dumpType) => {
        analyticsLogEvent(TRACING_COLLECT_DUMP, {
          type: dumpType,
          connectionType,
        } as Gtag.CustomParams);
      });
    },

    logCollectTraces(requestedTraces: string[], connectionType?: string) {
      requestedTraces.forEach((traceType) => {
        analyticsLogEvent(TRACING_COLLECT_TRACE, {
          type: traceType,
          connectionType,
        } as Gtag.CustomParams);
      });
    },

    logStartTime(ms: number) {
      logTimeMs(TRACING_START_TIME, ms);
    },

    logOpenFromABT() {
      analyticsLogEvent(TRACING_OPEN_FROM_ABT);
    },

    logOpenFromRemoteTool() {
      analyticsLogEvent(TRACING_OPEN_FROM_REMOTE_TOOL);
    },

    logRefreshDumps() {
      analyticsLogEvent(REFRESH_DUMPS);
    },
  },

  UserNotification: {
    logUserWarning(description: string, message: string) {
      analyticsLogEvent(USER_WARNING, {
        description,
        message,
      } as Gtag.CustomParams);
    },
  },
};

function logTimeMs(eventName: string, ms: number, params?: Gtag.CustomParams) {
  if (ms > 0) {
    const finalParams = Object.assign({value: ms}, params);
    analyticsLogEvent(eventName, finalParams);
  }
}

// https://developer.mozilla.org/en-US/docs/Web/API/Performance/memory
// This feature is deprecated so may not work in all browsers. We collect
// metrics from the field based on the JS heap because the replacement API,
// measureUserAgentSpecificMemory(), requires the app to be cross-origin
// isolated, which is incompatible with Winscope cross-tool integration.

interface Memory {
  jsHeapSizeLimit: number; // Maximum heap size, in bytes, available to the context.
  totalJSHeapSize: number; // Total allocated heap size, in bytes.
  usedJSHeapSize: number; // Currently active segment of JS heap, in bytes.
}

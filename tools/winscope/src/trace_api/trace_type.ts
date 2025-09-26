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

import {QueryResult} from 'trace_processor/query_result';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {PropertyTreeNode} from 'tree_node/property_tree_node';
import {MediaBasedTraceEntry} from './media_based_trace_entry';

/**
 * An enum representing the different types of traces that can be loaded and
 * visualized in Winscope. Each value corresponds to a specific data source
 * or analysis output (e.g., Window Manager trace, Surface Flinger trace,
 * screenshot, etc.).
 */
export enum TraceType {
  WINDOW_MANAGER,
  SURFACE_FLINGER,
  SCREEN_RECORDING,
  SCREENSHOT,
  TRANSACTIONS,
  WAYLAND,
  WAYLAND_DUMP,
  PROTO_LOG,
  SYSTEM_UI,
  INPUT_METHOD_CLIENTS,
  INPUT_METHOD_MANAGER_SERVICE,
  INPUT_METHOD_SERVICE,
  EVENT_LOG,
  WM_TRANSITION,
  SHELL_TRANSITION,
  TRANSITION,
  CUJS,
  TEST_TRACE_STRING,
  TEST_TRACE_NUMBER,
  VIEW_CAPTURE,
  INPUT_MOTION_EVENT,
  INPUT_KEY_EVENT,
  INPUT_EVENT_MERGED,
  SEARCH,
}

/**
 * Represents the set of trace types that are related to the Input Method Editor (IME).
 * This type is useful for grouping and easily referencing all IME-related traces
 * within Winscope, allowing for type-safe operations on these specific trace types.
 */
export type ImeTraceType =
  | TraceType.INPUT_METHOD_CLIENTS
  | TraceType.INPUT_METHOD_MANAGER_SERVICE
  | TraceType.INPUT_METHOD_SERVICE;

/**
 * Maps each {@link TraceType} to the expected type of its corresponding trace entry data.
 *
 * This interface is used to enforce type safety when working with trace entries.
 * For example, when accessing data for a `TraceType.SURFACE_FLINGER`,
 * TypeScript will know that the entry is of type `HierarchyTreeNode`.
 * This prevents runtime errors and improves code maintainability by ensuring
 * that trace data is used according to its defined structure.
 */
export declare interface TraceEntryTypeMap {
  [TraceType.PROTO_LOG]: HierarchyTreeNode;
  [TraceType.SURFACE_FLINGER]: HierarchyTreeNode;
  [TraceType.SCREEN_RECORDING]: MediaBasedTraceEntry;
  [TraceType.SCREENSHOT]: MediaBasedTraceEntry;
  [TraceType.SYSTEM_UI]: object;
  [TraceType.TRANSACTIONS]: HierarchyTreeNode;
  [TraceType.WAYLAND]: object;
  [TraceType.WAYLAND_DUMP]: object;
  [TraceType.WINDOW_MANAGER]: HierarchyTreeNode;
  [TraceType.INPUT_METHOD_CLIENTS]: HierarchyTreeNode;
  [TraceType.INPUT_METHOD_MANAGER_SERVICE]: HierarchyTreeNode;
  [TraceType.INPUT_METHOD_SERVICE]: HierarchyTreeNode;
  [TraceType.EVENT_LOG]: PropertyTreeNode;
  [TraceType.WM_TRANSITION]: object;
  [TraceType.SHELL_TRANSITION]: object;
  [TraceType.TRANSITION]: HierarchyTreeNode;
  [TraceType.CUJS]: HierarchyTreeNode;
  [TraceType.TEST_TRACE_STRING]: string;
  [TraceType.TEST_TRACE_NUMBER]: number;
  [TraceType.VIEW_CAPTURE]: HierarchyTreeNode;
  [TraceType.INPUT_MOTION_EVENT]: HierarchyTreeNode;
  [TraceType.INPUT_KEY_EVENT]: HierarchyTreeNode;
  [TraceType.INPUT_EVENT_MERGED]: HierarchyTreeNode;
  [TraceType.SEARCH]: QueryResult;
}

export class TraceTypeUtils {
  private static UI_PIPELINE_ORDER = [
    TraceType.INPUT_EVENT_MERGED,
    TraceType.INPUT_METHOD_CLIENTS,
    TraceType.INPUT_METHOD_SERVICE,
    TraceType.INPUT_METHOD_MANAGER_SERVICE,
    TraceType.PROTO_LOG,
    TraceType.WINDOW_MANAGER,
    TraceType.TRANSACTIONS,
    TraceType.SURFACE_FLINGER,
    TraceType.SCREEN_RECORDING,
  ];

  private static TRACES_WITH_VIEWERS_DISPLAY_ORDER = [
    TraceType.SEARCH,
    TraceType.SCREEN_RECORDING,
    TraceType.SCREENSHOT,
    TraceType.SURFACE_FLINGER,
    TraceType.WINDOW_MANAGER,
    TraceType.INPUT_EVENT_MERGED,
    TraceType.INPUT_METHOD_CLIENTS,
    TraceType.INPUT_METHOD_MANAGER_SERVICE,
    TraceType.INPUT_METHOD_SERVICE,
    TraceType.TRANSACTIONS,
    TraceType.PROTO_LOG,
    TraceType.VIEW_CAPTURE,
    TraceType.TRANSITION,
    TraceType.CUJS,
  ];

  // TODO(b/322805621) add other traces once support is provided
  private static TRACES_SUPPORTING_PLAYBACK = [TraceType.SURFACE_FLINGER];

  static supportsPlayback(t: TraceType): boolean {
    return TraceTypeUtils.TRACES_SUPPORTING_PLAYBACK.includes(t);
  }

  static isTraceTypeWithViewer(t: TraceType): boolean {
    return TraceTypeUtils.TRACES_WITH_VIEWERS_DISPLAY_ORDER.includes(t);
  }

  static compareByUiPipelineOrder(t: TraceType, u: TraceType): boolean {
    const tIndex = TraceTypeUtils.findIndexInOrder(
      t,
      TraceTypeUtils.UI_PIPELINE_ORDER,
    );
    const uIndex = TraceTypeUtils.findIndexInOrder(
      u,
      TraceTypeUtils.UI_PIPELINE_ORDER,
    );
    return tIndex >= 0 && uIndex >= 0 && tIndex < uIndex;
  }

  static compareByDisplayOrder(t: TraceType, u: TraceType): number {
    const tIndex = TraceTypeUtils.findIndexInOrder(
      t,
      TraceTypeUtils.TRACES_WITH_VIEWERS_DISPLAY_ORDER,
    );
    const uIndex = TraceTypeUtils.findIndexInOrder(
      u,
      TraceTypeUtils.TRACES_WITH_VIEWERS_DISPLAY_ORDER,
    );
    return tIndex - uIndex;
  }

  static getReasonForNoTraceVisualization(t: TraceType): string {
    switch (t) {
      case TraceType.WM_TRANSITION:
        return 'Must also upload a shell transitions trace to visualize transitions.';
      case TraceType.SHELL_TRANSITION:
        return 'Must also upload a wm transitions trace to visualize transitions.';
      case TraceType.EVENT_LOG:
        return 'Uploaded file does not contain CUJs. Only CUJ visualization is supported in Winscope.';
      default:
        return 'Visualization for this trace is not supported in Winscope.';
    }
  }

  private static findIndexInOrder(
    traceType: TraceType,
    order: TraceType[],
  ): number {
    return order.findIndex((type) => {
      return type === traceType;
    });
  }
}

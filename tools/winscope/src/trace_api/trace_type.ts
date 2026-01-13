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

/**
 * An enum representing the different types of traces that can be loaded and
 * visualized in Winscope. Each value corresponds to a specific data source
 * or analysis output (e.g., Window Manager trace, Surface Flinger trace,
 * screenshot, etc.).
 */
export enum TraceType {
  /**
   * Represents a Window Manager trace, which provides information about
   * window management activities, such as window creation, destruction,
   * and state changes.
   */
  WINDOW_MANAGER,
  /**
   * Represents a Surface Flinger trace, which captures information about
   * surface composition, layer management, and display updates.
   */
  SURFACE_FLINGER,
  /**
   * Represents a screen recording trace, typically in MP4 format, which
   * provides a visual record of the device's screen activity.
   */
  SCREEN_RECORDING,
  /**
   * Represents a screenshot trace, which is a single image capture of the
   * device's screen at a specific moment.
   */
  SCREENSHOT,
  /**
   * Represents a transactions trace, which contains information about
   * Surface Flinger transactions, including buffer updates and display
   * state changes.
   */
  TRANSACTIONS,
  /**
   * Represents a Wayland trace, which captures events and states from the
   * Wayland display server, used in some Android environments.
   */
  WAYLAND,
  /**
   * Represents a Wayland dump, which is a snapshot of the Wayland server's
   * state at a particular time.
   */
  WAYLAND_DUMP,
  /**
   * Represents a ProtoLog trace, which contains log messages from the
   * ProtoLog logging system used in various Android components.
   */
  PROTO_LOG,
  /**
   * Represents a trace from Input Method Editor (IME) clients, which
   * captures interactions between applications and the input method.
   */
  INPUT_METHOD_CLIENTS,
  /**
   * Represents a trace from the Input Method Manager Service, which
   * provides information about the overall state and management of IMEs.
   */
  INPUT_METHOD_MANAGER_SERVICE,
  /**
   * Represents a trace from the Input Method Service, which captures
   * events and states within a specific IME.
   */
  INPUT_METHOD_SERVICE,
  /**
   * Represents a Window Manager transition trace, which provides
   * information about window transitions and animations.
   */
  WM_TRANSITION,
  /**
   * Represents a Shell transition trace, which captures information about
   * transitions and animations within the shell.
   */
  SHELL_TRANSITION,
  /**
   * Represents a combined transition trace, which merges information from
   * both Window Manager and Shell transition traces.
   */
  TRANSITION,
  /**
   * Represents a Critical User Journey (CUJ) trace, which provides
   * information about the performance and state of important user
   * interactions.
   */
  CUJS,
  /**
   * A test trace type used for development and testing, containing string data.
   */
  TEST_TRACE_STRING,
  /**
   * A test trace type used for development and testing, containing numeric data.
   */
  TEST_TRACE_NUMBER,
  /**
   * Represents a View Capture trace, which provides a hierarchical dump of
   * the views in a window.
   */
  VIEW_CAPTURE,
  /**
   * Represents a trace of input motion events, such as touch gestures.
   */
  INPUT_MOTION_EVENT,
  /**
   * Represents a trace of input key events, such as key presses.
   */
  INPUT_KEY_EVENT,
  /**
   * Represents a merged trace of input events, combining motion and key events.
   */
  INPUT_EVENT_MERGED,
  /**
   * Represents a search trace, used for searching within other traces.
   */
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

const UI_PIPELINE_ORDER = [
  TraceType.INPUT_EVENT_MERGED,
  TraceType.INPUT_KEY_EVENT,
  TraceType.INPUT_MOTION_EVENT,
  TraceType.INPUT_METHOD_CLIENTS,
  TraceType.INPUT_METHOD_SERVICE,
  TraceType.INPUT_METHOD_MANAGER_SERVICE,
  TraceType.PROTO_LOG,
  TraceType.WINDOW_MANAGER,
  TraceType.TRANSACTIONS,
  TraceType.SURFACE_FLINGER,
  TraceType.SCREEN_RECORDING,
];

const TRACES_WITH_VIEWERS_DISPLAY_ORDER = [
  TraceType.SEARCH,
  TraceType.SCREEN_RECORDING,
  TraceType.SCREENSHOT,
  TraceType.SURFACE_FLINGER,
  TraceType.WINDOW_MANAGER,
  TraceType.INPUT_EVENT_MERGED,
  TraceType.INPUT_KEY_EVENT,
  TraceType.INPUT_MOTION_EVENT,
  TraceType.INPUT_METHOD_CLIENTS,
  TraceType.INPUT_METHOD_MANAGER_SERVICE,
  TraceType.INPUT_METHOD_SERVICE,
  TraceType.TRANSACTIONS,
  TraceType.PROTO_LOG,
  TraceType.VIEW_CAPTURE,
  TraceType.TRANSITION,
  TraceType.CUJS,
];

// TODO(b/449929778) add other traces once support is provided
const TRACES_SUPPORTING_PLAYBACK = [
  TraceType.SURFACE_FLINGER,
  TraceType.WINDOW_MANAGER,
];

/**
 * Checks if a given {@link TraceType} supports playback.
 *
 * This function is useful to determine whether a specific trace can be
 * controlled by playback features in the Winscope UI, allowing users to
 * navigate through the trace data over time. For example, Surface Flinger
 * traces support playback, enabling frame-by-frame analysis.
 *
 * @param t The {@link TraceType} to check.
 * @return True if the trace type supports playback, false otherwise.
 */
export function supportsPlayback(t: TraceType): boolean {
  return TRACES_SUPPORTING_PLAYBACK.includes(t);
}

/**
 * Checks if a given {@link TraceType} has an associated viewer in Winscope.
 *
 * This function helps in organizing and displaying trace types that can be
 * visualized within the application. Trace types without a dedicated viewer
 * might still be loadable but won't be shown in the main viewing area.
 *
 * @param t The {@link TraceType} to check.
 * @return True if the trace type has a viewer, false otherwise.
 */
export function isTraceTypeWithViewer(t: TraceType): boolean {
  return TRACES_WITH_VIEWERS_DISPLAY_ORDER.includes(t);
}

/**
 * Compares two {@link TraceType} values based on their order in the
 * `UI_PIPELINE_ORDER`.
 *
 * This function is used to establish a consistent ordering of trace types
 * within the Winscope UI, reflecting the typical flow or dependency between
 * different trace data in the system's pipeline (e.g., input events -> IME ->
 * Window Manager -> Surface Flinger).
 *
 * @param t The first {@link TraceType}.
 * @param u The second {@link TraceType}.
 * @return True if `t` appears before `u` in the `UI_PIPELINE_ORDER`, false otherwise.
 */
export function compareByUiPipelineOrder(t: TraceType, u: TraceType): boolean {
  const tIndex = findIndexInOrder(t, UI_PIPELINE_ORDER);
  const uIndex = findIndexInOrder(u, UI_PIPELINE_ORDER);
  return tIndex >= 0 && uIndex >= 0 && tIndex < uIndex;
}

/**
 * Compares two {@link TraceType} values based on their order in the
 * `TRACES_WITH_VIEWERS_DISPLAY_ORDER`.
 *
 * This function is used to sort trace types that have associated viewers
 * within the Winscope UI. It ensures a consistent and user-friendly display
 * order for the different trace viewers, making it easier for users to
 * navigate between them.
 *
 * @param t The first {@link TraceType}.
 * @param u The second {@link TraceType}.
 * @return A negative number if `t` comes before `u`, a positive number if `t`
 *     comes after `u`, or 0 if they are considered equal in order.
 */
export function compareByDisplayOrder(t: TraceType, u: TraceType): number {
  const tIndex = findIndexInOrder(t, TRACES_WITH_VIEWERS_DISPLAY_ORDER);
  const uIndex = findIndexInOrder(u, TRACES_WITH_VIEWERS_DISPLAY_ORDER);
  return tIndex - uIndex;
}

/**
 * Returns a human-readable string explaining why a specific {@link TraceType}
 * cannot be visualized in Winscope.
 *
 * This function is used to provide feedback to the user when a trace type
 * is uploaded but cannot be displayed in a viewer. It covers cases where
 * a trace type requires another trace to be present (e.g., WM transitions
 * need Shell transitions) or when visualization for a specific type is
 * not yet supported. This helps guide the user on what might be missing
 * or why a certain trace isn't being shown.
 *
 * @param t The {@link TraceType} for which to get the reason.
 * @return A string explaining why the trace cannot be visualized.
 */
export function getReasonForNoTraceVisualization(t: TraceType): string {
  switch (t) {
    case TraceType.WM_TRANSITION:
      return 'Must also upload a shell transitions trace to visualize transitions.';
    case TraceType.SHELL_TRANSITION:
      return 'Must also upload a wm transitions trace to visualize transitions.';
    default:
      return 'Visualization for this trace is not supported in Winscope.';
  }
}

function findIndexInOrder(traceType: TraceType, order: TraceType[]): number {
  return order.findIndex((type) => {
    return type === traceType;
  });
}

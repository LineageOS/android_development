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

import {assertTrue} from '@common/assert';
import {Store} from '@common/store/store';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {Trace} from '@trace_api/trace';
import {compareByDisplayOrder, TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {ViewerInputMethodClients} from '@viewers/viewer_input_method_clients/viewer_input_method_clients';
import {ViewerInputMethodManagerService} from '@viewers/viewer_input_method_manager_service/viewer_input_method_manager_service';
import {ViewerInputMethodService} from '@viewers/viewer_input_method_service/viewer_input_method_service';
import {ViewerInput} from '@viewers/viewer_input/viewer_input';
import {ViewerJankCujs} from '@viewers/viewer_jank_cujs/viewer_jank_cujs';
import {ViewerScreenRecording} from '@viewers/viewer_media_based/viewer_screen_recording';
import {ViewerScreenshot} from '@viewers/viewer_media_based/viewer_screenshot';
import {ViewerProtoLog} from '@viewers/viewer_protolog/viewer_protolog';
import {ViewerSearch} from '@viewers/viewer_search/viewer_search';
import {ViewerSurfaceFlinger} from '@viewers/viewer_surface_flinger/viewer_surface_flinger';
import {ViewerTransactions} from '@viewers/viewer_transactions/viewer_transactions';
import {ViewerTransitions} from '@viewers/viewer_transitions/viewer_transitions';
import {ViewerViewCapture} from '@viewers/viewer_view_capture/viewer_view_capture';
import {ViewerWindowManager} from '@viewers/viewer_window_manager/viewer_window_manager';

import {Viewer, ViewType} from './viewer';

export class ViewerFactory {
  static readonly SINGLE_TRACE_VIEWERS = [
    ViewerSurfaceFlinger,
    ViewerWindowManager,
    ViewerInputMethodClients,
    ViewerInputMethodManagerService,
    ViewerInputMethodService,
    ViewerTransactions,
    ViewerProtoLog,
    ViewerTransitions,
    ViewerJankCujs,
  ];

  static readonly MULTI_TRACE_VIEWERS = [
    ViewerViewCapture,
    ViewerInput,
    ViewerScreenRecording,
    ViewerScreenshot,
  ];

  createViewers(
    traces: Traces,
    store: Store,
    timestampConverter: TimestampConverter,
  ): Viewer[] {
    const viewers: Viewer[] = [];

    for (const trace of traces) {
      if (trace.isPerfetto()) {
        viewers.push(new ViewerSearch(traces, store, timestampConverter));
        break;
      }
    }

    // instantiate one viewer for one trace
    traces.forEachTrace((trace) => {
      ViewerFactory.SINGLE_TRACE_VIEWERS.forEach((Viewer) => {
        assertTrue(Viewer.DEPENDENCIES.length === 1);
        const isViewerDepSatisfied = trace.type === Viewer.DEPENDENCIES[0];
        if (isViewerDepSatisfied) {
          viewers.push(
            new Viewer(trace as Trace<HierarchyTreeNode>, traces, store),
          );
        }
      });
    });

    // instantiate one viewer for N traces
    const availableTraceTypes = new Set(traces.mapTrace((trace) => trace.type));

    ViewerFactory.MULTI_TRACE_VIEWERS.forEach((Viewer) => {
      const isViewerDepSatisfied = Viewer.DEPENDENCIES.some(
        (traceType: TraceType) => availableTraceTypes.has(traceType),
      );
      if (isViewerDepSatisfied) {
        viewers.push(new Viewer(traces, store));
      }
    });

    // Note:
    // the final order of tabs/views in the UI corresponds the order of the
    // respective viewers below
    return viewers.sort((a, b) => {
      const aViewType = a.getViewType();
      const bViewType = b.getViewType();
      if (
        aViewType === ViewType.TRACE_TAB &&
        bViewType === ViewType.TRACE_TAB
      ) {
        return compareByDisplayOrder(
          a.getTraces()[0].type,
          b.getTraces()[0].type,
        );
      } else if (
        aViewType === ViewType.GLOBAL_SEARCH &&
        bViewType !== ViewType.GLOBAL_SEARCH
      ) {
        return -1;
      } else if (
        aViewType !== ViewType.GLOBAL_SEARCH &&
        bViewType === ViewType.GLOBAL_SEARCH
      ) {
        return 1;
      } else {
        return a.getTitle() < b.getTitle() ? -1 : 1;
      }
    });
  }
}

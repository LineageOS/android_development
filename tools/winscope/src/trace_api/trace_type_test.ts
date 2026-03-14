/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {compareByDisplayOrder, compareByUiPipelineOrder, getReasonForNoTraceVisualization, isTraceTypeWithViewer, supportsPlayback, TraceType,} from './trace_type';

describe('TraceType', () => {
  it('supportsPlayback', () => {
    expect(supportsPlayback(TraceType.SURFACE_FLINGER)).toBeTrue();
    expect(supportsPlayback(TraceType.TRANSACTIONS)).toBeFalse();
  });

  it('isTraceTypeWithViewer', () => {
    expect(isTraceTypeWithViewer(TraceType.SURFACE_FLINGER)).toBeTrue();
    expect(isTraceTypeWithViewer(TraceType.WM_TRANSITION)).toBeFalse();
  });

  it('compareByUiPipelineOrder', () => {
    expect(
      compareByUiPipelineOrder(
        TraceType.INPUT_EVENT_MERGED,
        TraceType.SURFACE_FLINGER,
      ),
    ).toBeTrue();
    expect(
      compareByUiPipelineOrder(
        TraceType.SURFACE_FLINGER,
        TraceType.INPUT_EVENT_MERGED,
      ),
    ).toBeFalse();
    expect(
      compareByUiPipelineOrder(
        TraceType.SURFACE_FLINGER,
        TraceType.SURFACE_FLINGER,
      ),
    ).toBeFalse();
    expect(
      compareByUiPipelineOrder(TraceType.CUJS, TraceType.SURFACE_FLINGER),
    ).toBeFalse();
  });

  it('compareByDisplayOrder', () => {
    expect(
      compareByDisplayOrder(
        TraceType.SURFACE_FLINGER,
        TraceType.WINDOW_MANAGER,
      ),
    ).toBeLessThan(0);
    expect(
      compareByDisplayOrder(
        TraceType.WINDOW_MANAGER,
        TraceType.SURFACE_FLINGER,
      ),
    ).toBeGreaterThan(0);
    expect(
      compareByDisplayOrder(
        TraceType.SURFACE_FLINGER,
        TraceType.SURFACE_FLINGER,
      ),
    ).toBe(0);
    expect(
      compareByDisplayOrder(TraceType.WM_TRANSITION, TraceType.SURFACE_FLINGER),
    ).toBeLessThan(0);
  });

  it('getReasonForNoTraceVisualization', () => {
    expect(getReasonForNoTraceVisualization(TraceType.WM_TRANSITION)).toContain(
      'Must also upload a shell transitions trace to visualize transitions.',
    );
    expect(
      getReasonForNoTraceVisualization(TraceType.SHELL_TRANSITION),
    ).toContain(
      'Must also upload a wm transitions trace to visualize transitions.',
    );
    expect(
      getReasonForNoTraceVisualization(TraceType.TEST_TRACE_NUMBER),
    ).toContain('Visualization for this trace is not supported in Winscope.');
  });
});

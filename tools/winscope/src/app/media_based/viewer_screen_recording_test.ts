/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {ComponentRef} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {makeEmptyTrace} from '@trace_api/testing/trace_test_helpers';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {Presenter} from '@ui/media_based/presenter';

import {ViewerMediaBasedComponent} from './viewer_media_based_component';
import {ViewerScreenRecording} from './viewer_screen_recording';

describe('ViewerScreenRecording', () => {
  const trace: Trace<MediaBasedTraceEntry> = makeEmptyTrace(
    TraceType.SCREEN_RECORDING,
  );

  let viewer: ViewerScreenRecording;
  let componentRef: ComponentRef<ViewerMediaBasedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewerMediaBasedComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(ViewerMediaBasedComponent);
    componentRef = fixture.componentRef;
    const traces = new Traces();
    traces.addTrace(trace);
    viewer = new ViewerScreenRecording(traces, new InMemoryStorage());
    viewer.setComponentRef(componentRef);
  });

  it('adds component output listener for onOverlayDblClick', async () => {
    const spy = spyOn(Presenter.prototype, 'onOverlayDblClick');
    componentRef.instance.onOverlayDblClick.emit(1);
    expect(spy).toHaveBeenCalledOnceWith(1);
  });

  it('adds component output listener for onOverlayMediaBasedTraceChange', async () => {
    const spy = spyOn(Presenter.prototype, 'onOverlayScreenRecordingChange');
    componentRef.instance.onOverlayMediaBasedTraceChange.emit(1);
    expect(spy).toHaveBeenCalledOnceWith(1);
  });
});

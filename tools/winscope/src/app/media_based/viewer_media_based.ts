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

import {AbstractViewer} from '@app/shared/abstract_viewer';
import {assertDefined} from '@common/assert';
import {Store} from '@common/store/store';
import {Trace} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {MediaBasedTraceEntry} from '@trace/media_based/media_based_trace_entry';
import {Presenter} from '@ui/media_based/presenter';
import {UiData} from '@ui/media_based/ui_data';
import {ViewType} from '@ui/shared/viewers/viewer';

import {ViewerMediaBasedComponent} from './viewer_media_based_component';

export abstract class ViewerMediaBased extends AbstractViewer<
  MediaBasedTraceEntry,
  UiData,
  Presenter
> {
  private traces: Array<Trace<MediaBasedTraceEntry>> | undefined;

  constructor(traces: Traces, store: Store) {
    super(undefined, traces, ViewerMediaBasedComponent, store);
  }

  override getTraces(): Array<Trace<MediaBasedTraceEntry>> {
    return assertDefined(this.traces);
  }

  protected override createPresenter(
    trace: undefined,
    traces: Traces,
  ): Presenter {
    const type = this.getTraceTypeForViewTitle();
    this.traces = traces.getTraces(type) as Array<Trace<MediaBasedTraceEntry>>;
    const notifyViewCallback = (uiData: UiData) => {
      const component = this.componentRef;
      if (!component) {
        return;
      }
      if (type === TraceType.SCREEN_RECORDING) {
        component.setInput('enableDoubleClick', true);
      }
      component.setInput('titles', uiData.titles);
      component.setInput('currentTraceEntries', uiData.currentTraceEntries);
      component.setInput('forceMinimize', uiData.forceMinimize);
      component.setInput('isFetchingEntries', uiData.isFetchingEntries);
      component.setInput('isInPlaybackMode', uiData.isInPlaybackMode);
      component.changeDetectorRef.detectChanges();
    };
    return new Presenter(this.traces, notifyViewCallback);
  }

  override getViewType(): ViewType {
    return ViewType.OVERLAY;
  }

  protected override addOutputListeners(component: ViewerMediaBasedComponent) {
    component.onOverlayDblClick.subscribe((detail) => {
      this.presenter.onOverlayDblClick(detail);
    });
    this.addViewerSpecificListeners(component);
  }

  protected addViewerSpecificListeners(_: ViewerMediaBasedComponent) {
    // do nothing
  }
}

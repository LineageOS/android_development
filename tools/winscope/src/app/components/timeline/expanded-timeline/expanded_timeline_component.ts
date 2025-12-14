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

import {CommonModule} from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
  QueryList,
  ViewChildren,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {TimelineData} from '@app/timeline_data';
import {assertDefined} from '@common/assert';
import {Trace} from '@trace_api/trace';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TracePosition} from '@trace_api/trace_position';
import {TraceType, compareByDisplayOrder} from '@trace_api/trace_type';
import {AbstractTimelineRowComponent} from './abstract_timeline_row_component';
import {DefaultTimelineRowComponent} from './default_timeline_row_component';
import {TransitionTimelineComponent} from './transition_timeline_component';

/**
 * A component for displaying the expanded timeline view.
 */
@Component({
  selector: 'expanded-timeline',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatTooltipModule,
    TransitionTimelineComponent,
    DefaultTimelineRowComponent,
  ],
  templateUrl: './expanded_timeline_component.ng.html',
  styleUrls: ['expanded_timeline_component.css'],
})
export class ExpandedTimelineComponent {
  @Input() timelineData: TimelineData | undefined;
  @Output() readonly onTracePositionUpdate = new EventEmitter<TracePosition>();
  @Output() readonly onScrollEvent = new EventEmitter<WheelEvent>();
  @Output() readonly onTraceClicked = new EventEmitter<Trace<unknown>>();
  @Output() readonly onMouseXRatioUpdate = new EventEmitter<
    number | undefined
  >();

  @ViewChildren(DefaultTimelineRowComponent)
  singleTimelines: QueryList<DefaultTimelineRowComponent> | undefined;

  @ViewChildren(TransitionTimelineComponent)
  transitionTimelines: QueryList<TransitionTimelineComponent> | undefined;

  TRACE_INFO = TRACE_INFO;
  TraceType = TraceType;

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.resizeCanvases();
  }

  getTracesSortedByDisplayOrder(): Array<Trace<unknown>> {
    const traces = assertDefined(this.timelineData)
      .getTraces()
      .mapTrace((trace) => trace);
    return traces.sort((a, b) => compareByDisplayOrder(a.type, b.type));
  }

  updateScroll(event: WheelEvent) {
    this.onScrollEvent.emit(event);
  }

  isActiveTrace(trace: Trace<unknown>) {
    return trace === this.timelineData?.getActiveTrace();
  }

  private resizeCanvases() {
    // Reset any size before computing new size to avoid it interfering with size computations.
    // Needs to be done together because otherwise the sizes of each timeline will interfere with
    // each other, since if one timeline is still too big the container will stretch to that size.
    const timelines = [
      ...(this.transitionTimelines as QueryList<
        AbstractTimelineRowComponent<unknown>
      >),
      ...(this.singleTimelines as QueryList<
        AbstractTimelineRowComponent<unknown>
      >),
    ];
    for (const timeline of timelines) {
      timeline.getCanvas().width = 0;
      timeline.getCanvas().height = 0;
      timeline.getCanvas().style.width = 'auto';
      timeline.getCanvas().style.height = 'auto';
    }

    for (const timeline of timelines) {
      timeline.initializeCanvas();
      timeline.getCanvas().height = 0;
      timeline.getCanvas().style.width = 'auto';
      timeline.getCanvas().style.height = 'auto';
    }
  }
}

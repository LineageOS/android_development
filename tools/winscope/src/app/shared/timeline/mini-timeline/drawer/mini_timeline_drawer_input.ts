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

import {TimelineSegment} from '@app/shared/timeline/common/segment';
import {convertLifecycle, getLifecycleForTransition,} from '@app/shared/timeline/common/transition_timeline_helpers';
import {TimeRange, Timestamp} from '@common/time/time';
import {Trace, TraceEntry} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {TimelineData} from '@ui/timeline/timeline_data';

import {MiniCanvasDrawerData, TimelineTrace, TimelineTraces,} from './mini_canvas_drawer_data';
import {RenderedRange} from './rendered_range';
import {Transformer} from './transformer';

/**
 * Input data for the mini timeline drawer.
 */
export class MiniTimelineDrawerInput {
  constructor(
    public fullRange: TimeRange,
    public selectedPosition: Timestamp,
    public selection: TimeRange,
    public zoomRange: TimeRange,
    public traces: Array<Trace<unknown>>,
    public timelineData: TimelineData,
    public bookmarks: Timestamp[],
    public isDarkMode: boolean,
  ) {}

  transform(mapToRange: RenderedRange): MiniCanvasDrawerData {
    const transformer = new Transformer(
      this.zoomRange,
      mapToRange,
      this.timelineData.getTimestampConverter(),
    );

    return new MiniCanvasDrawerData(
      transformer.transform(this.selectedPosition),
      {
        from: transformer.transform(this.selection.from),
        to: transformer.transform(this.selection.to),
      },
      () => {
        return this.transformTracesTimestamps(transformer);
      },
      transformer,
      this.transformBookmarks(transformer),
    );
  }

  private async transformTracesTimestamps(
    transformer: Transformer,
  ): Promise<TimelineTraces> {
    const transformedTraceSegments = new Map<Trace<unknown>, TimelineTrace>();

    this.traces.forEach((trace) => {
      const activeEntry = this.timelineData.findCurrentEntryFor(trace);

      if (trace.type === TraceType.TRANSITION) {
        // Transition trace is a special case, with entries with time ranges
        const timeline = this.transformTransitionTraceTimestamps(
          transformer,
          trace as Trace<HierarchyTreeNode>,
          activeEntry as TraceEntry<HierarchyTreeNode> | undefined,
        );
        transformedTraceSegments.set(trace, timeline);
      } else {
        const timeline = this.transformTraceTimestamps(
          transformer,
          trace as Trace<HierarchyTreeNode>,
          activeEntry,
        );
        transformedTraceSegments.set(trace, timeline);
      }
    });

    return transformedTraceSegments;
  }

  private transformTransitionTraceTimestamps(
    transformer: Transformer,
    trace: Trace<HierarchyTreeNode>,
    activeEntry: TraceEntry<HierarchyTreeNode> | undefined,
  ): TimelineTrace {
    const segments = trace
      .mapEntry((entry) =>
        entry !== activeEntry
          ? this.transformTransitionEntry(transformer, entry)
          : undefined,
      )
      .filter((it) => it !== undefined)
      .flat();
    const activeSegments = activeEntry
      ? this.transformTransitionEntry(transformer, activeEntry)
      : [];
    return {
      segments,
      activeSegments,
      points: [],
      activePoint: undefined,
    };
  }

  private transformBookmarks(transformer: Transformer): number[] {
    return this.bookmarks.map((bookmarkedTimestamp) =>
      transformer.transform(bookmarkedTimestamp),
    );
  }

  private transformTransitionEntry(
    transformer: Transformer,
    entry: TraceEntry<HierarchyTreeNode>,
  ): Array<TimelineSegment<RenderedRange>> {
    const transition: HierarchyTreeNode | undefined = this.timelineData
      .getTransitionEntries()
      .at(entry.getIndex());
    if (!transition) {
      return [];
    }

    const lifecycle = getLifecycleForTransition(
      transition,
      this.selection,
      this.timelineData.getTimestampConverter(),
    );

    if (!lifecycle) {
      return [];
    }

    const convertStageStrategy = (stage: TimelineSegment<TimeRange>) => {
      return {
        from: transformer.transform(stage.segment.from),
        to: transformer.transform(stage.segment.to),
      };
    };

    const totalDurationStrategy = (
      stages: Array<TimelineSegment<RenderedRange>>,
    ) => {
      const firstStage = stages[0];
      const lastStage = stages[stages.length - 1];
      return {
        from: firstStage.segment.from,
        to: lastStage.segment.to,
      };
    };

    const lifecycleToRender = convertLifecycle(
      convertStageStrategy,
      totalDurationStrategy,
      lifecycle,
    );
    return lifecycleToRender.stages;
  }

  private transformTraceTimestamps(
    transformer: Transformer,
    trace: Trace<unknown>,
    activeEntry: TraceEntry<unknown> | undefined,
  ): TimelineTrace {
    const points: number[] = [];
    let activePoint: number | undefined;

    trace.forEachEntry((entry) => {
      const timestamp = entry.getTimestamp();
      if (activeEntry === entry) {
        activePoint = transformer.transform(timestamp);
      } else {
        points.push(transformer.transform(timestamp));
      }
    });

    return {points, activePoint, segments: [], activeSegments: []};
  }
}

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

import {Component, input} from '@angular/core';
import {MatTooltipModule} from '@angular/material/tooltip';
import {TimelineSegment} from '@app/shared/timeline/common/segment';
import {convertLifecycle, getLifecycleForTransition, TransitionLifecycle,} from '@app/shared/timeline/common/transition_timeline_helpers';
import {assertDefined, assertTrue} from '@common/assert';
import {Point} from '@common/geometry/point';
import {Rect} from '@common/geometry/rect';
import {TimeRange, Timestamp} from '@common/time/time';
import {AbsoluteEntryIndex} from '@trace_api/index_types';
import {TraceEntry} from '@trace_api/trace';
import {TraceType} from '@trace_api/trace_type';
import {TransitionStatus} from '@trace/transitions/status';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {AbstractTimelineRowComponent} from './abstract_timeline_row_component';

/**
 * A component for displaying a timeline of transitions.
 */
@Component({
  selector: 'transition-timeline',
  standalone: true,
  imports: [MatTooltipModule],
  templateUrl: './transition_timeline_component.ng.html',
  styleUrls: ['transition_timeline_component.scss'],
})
export class TransitionTimelineComponent extends AbstractTimelineRowComponent<HierarchyTreeNode> {
  transitionEntries = input.required<Array<HierarchyTreeNode | undefined>>();
  fullRange = input.required<TimeRange>();

  hoveringEntry?: TraceEntry<HierarchyTreeNode>;
  rowsToUse = new Map<number, number>();
  maxRowsRequires = 0;
  shouldNotRenderEntries: number[] = [];

  ngOnInit() {
    assertTrue(this.trace().type === TraceType.TRANSITION);
    this.computeRowsToUse();
  }

  getAvailableWidth() {
    return this.canvasDrawer.getScaledCanvasWidth();
  }

  override onHover(mousePoint: Point) {
    this.drawSegmentHover(mousePoint);
  }

  override handleMouseOut(_: MouseEvent) {
    if (this.hoveringEntry) {
      // If undefined there is no current hover effect so no need to clear
      this.redraw();
    }
    this.hoveringEntry = undefined;
  }

  override drawTimeline() {
    let selectedRect: Rect | undefined;
    this.trace().forEachEntry((entry) => {
      const index = entry.getIndex();
      const rects = this.getRectsFromIndex(entry.getIndex());
      if (!rects) {
        return;
      }
      const transition = assertDefined(this.transitionEntries().at(index));
      this.drawRects(rects, transition);
      if (index === this.selectedEntry()?.getIndex()) {
        selectedRect = rects.totalDuration;
      }
    });
    if (selectedRect) {
      this.canvasDrawer.drawRectBorder(selectedRect);
    }
  }

  private getRectsFromIndex(
    entryIndex: AbsoluteEntryIndex,
  ): TransitionLifecycle<Rect> | undefined {
    if (this.shouldNotRenderEntries.includes(entryIndex)) {
      return undefined;
    }
    const transition = this.transitionEntries().at(entryIndex);
    if (!transition) {
      return undefined;
    }
    const lifecycle = getLifecycleForTransition(
      transition,
      this.selectionRange(),
      this.timestampConverter(),
    );
    if (!lifecycle) {
      return undefined;
    }
    const row = this.getRowToUseFor(entryIndex);

    const totalDurationStrategy = (stages: Array<TimelineSegment<Rect>>) => {
      const firstRect = stages[0].segment;
      const lastRect = stages[stages.length - 1].segment;
      return new Rect(
        firstRect.x,
        firstRect.y,
        lastRect.x + lastRect.w - firstRect.x,
        firstRect.h,
      );
    };
    return convertLifecycle(
      (stage) => this.getSegmentRect(stage.segment, row),
      totalDurationStrategy,
      lifecycle,
    );
  }

  protected override getEntryAt(
    mousePoint: Point,
  ): TraceEntry<HierarchyTreeNode> | undefined {
    const transitionEntries = this.trace().mapEntry((entry) => entry);

    for (const entry of transitionEntries) {
      const rects = this.getRectsFromIndex(entry.getIndex());
      if (rects?.totalDuration?.containsPoint(mousePoint)) {
        return entry;
      }
    }
    return undefined;
  }

  private drawSegmentHover(mousePoint: Point) {
    const currentHoverEntry = this.getEntryAt(mousePoint);

    if (this.hoveringEntry) {
      this.redraw();
    }

    this.hoveringEntry = currentHoverEntry;

    if (!this.hoveringEntry) {
      return;
    }

    const rects = this.getRectsFromIndex(this.hoveringEntry.getIndex());
    if (rects) {
      this.canvasDrawer.drawRectBorder(rects.totalDuration);
    }
  }

  private getXPosOf(entry: Timestamp): number {
    const selectionRange = this.selectionRange();
    const start = selectionRange.startNs;
    const end = selectionRange.endNs;

    return Number(
      (BigInt(this.getAvailableWidth()) * (entry.getValueNs() - start)) /
        (end - start),
    );
  }

  private getSegmentRect(segment: TimeRange, rowToUse: number): Rect {
    const xPosStart = this.getXPosOf(segment.from);
    const selectionRange = this.selectionRange();
    const selectionStart = selectionRange.startNs;
    const selectionEnd = selectionRange.endNs;

    const borderPadding = 5;
    let totalRowHeight =
      (this.canvasDrawer.getScaledCanvasHeight() - 2 * borderPadding) /
      this.maxRowsRequires;
    if (totalRowHeight < 10) {
      totalRowHeight = 10;
    }
    if (this.maxRowsRequires === 1) {
      totalRowHeight = 30;
    }

    const padding = 5;
    const rowHeight = totalRowHeight - padding;

    const width = Math.max(
      Number(
        (BigInt(this.getAvailableWidth()) *
          BigInt(segment.endNs - segment.startNs)) /
          BigInt(selectionEnd - selectionStart),
      ),
      rowHeight,
    );

    return new Rect(
      xPosStart,
      borderPadding + rowToUse * totalRowHeight,
      width,
      rowHeight,
    );
  }

  private drawRects(
    lifecycle: TransitionLifecycle<Rect>,
    transition: HierarchyTreeNode,
  ) {
    const aborted =
      transition.getEagerPropertyByName('status')?.formattedValue() ===
      TransitionStatus.ABORTED;
    const alpha = aborted ? 0.25 : 1.0;

    lifecycle.stages.forEach((rect) => {
      this.canvasDrawer.drawRect(
        rect.segment,
        rect.color ?? this.color(),
        alpha,
        rect.unknownStart,
        rect.unknownEnd,
      );
    });
  }

  private getRowToUseFor(entryIndex: AbsoluteEntryIndex): number {
    const rowToUse = this.rowsToUse.get(entryIndex);
    if (rowToUse === undefined) {
      throw new Error(`Could not find entry ${entryIndex} in rowsToUse`);
    }
    return rowToUse;
  }

  private computeRowsToUse(): void {
    const rowAvailableFrom: Array<bigint | undefined> = [];
    this.trace().forEachEntry((entry) => {
      const index = entry.getIndex();
      const transition = this.transitionEntries().at(entry.getIndex());
      if (!transition) {
        return;
      }

      const lifecycle = getLifecycleForTransition(
        transition,
        this.fullRange(),
        this.timestampConverter(),
      );

      if (lifecycle === undefined) {
        this.shouldNotRenderEntries.push(index);
        return;
      }

      let rowToUse = 0;
      while (
        (rowAvailableFrom[rowToUse] ?? 0n) > lifecycle.totalDuration.startNs
      ) {
        rowToUse++;
      }

      rowAvailableFrom[rowToUse] = lifecycle.totalDuration.endNs;

      if (rowToUse + 1 > this.maxRowsRequires) {
        this.maxRowsRequires = rowToUse + 1;
      }
      this.rowsToUse.set(index, rowToUse);
    });
  }
}

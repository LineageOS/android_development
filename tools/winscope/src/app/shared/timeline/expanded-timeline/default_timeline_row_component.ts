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

import {Component} from '@angular/core';
import {Point} from '@common/geometry/point';
import {Rect} from '@common/geometry/rect';
import {Timestamp} from '@common/time/time';
import {TraceEntry} from '@trace_api/trace';

import {AbstractTimelineRowComponent} from './abstract_timeline_row_component';

/**
 * A component for displaying a single timeline row with entries rendered as vertical bars.
 */
@Component({
  selector: 'single-timeline',
  standalone: true,
  templateUrl: './default_timeline_row_component.ng.html',
  styleUrls: ['default_timeline_row_component.scss'],
})
export class DefaultTimelineRowComponent extends AbstractTimelineRowComponent<unknown> {
  hoveringEntry?: Timestamp;

  getEntryWidth() {
    return this.canvasDrawer.getScaledCanvasHeight();
  }

  getAvailableWidth() {
    return Math.floor(
      this.canvasDrawer.getScaledCanvasWidth() - this.getEntryWidth(),
    );
  }

  override onHover(mousePoint: Point) {
    this.drawEntryHover(mousePoint);
  }

  override handleMouseOut(_: MouseEvent) {
    if (this.hoveringEntry) {
      // If undefined there is no current hover effect so no need to clear
      this.redraw();
    }
    this.hoveringEntry = undefined;
  }

  override drawTimeline() {
    const selectionRange = this.selectionRange();
    this.trace()
      .sliceTime(selectionRange.from, selectionRange.to.add(1n))
      .forEachTimestamp((entry) => {
        this.drawEntry(entry);
      });
    this.drawSelectedEntry();
  }

  protected override getEntryAt(
    mousePoint: Point,
  ): TraceEntry<unknown> | undefined {
    const timestampOfClick = this.getTimestampOf(mousePoint.x);
    const candidateEntry =
      this.trace().findLastLowerOrEqualEntry(timestampOfClick);

    if (candidateEntry !== undefined) {
      const timestamp = candidateEntry.getTimestamp();
      const rect = this.entryRect(timestamp);
      if (rect.containsPoint(mousePoint)) {
        return candidateEntry;
      }
    }

    return undefined;
  }

  private drawEntryHover(mousePoint: Point) {
    const currentHoverEntry = this.getEntryAt(mousePoint)?.getTimestamp();

    if (this.hoveringEntry === currentHoverEntry) {
      return;
    }

    if (this.hoveringEntry) {
      // If null there is no current hover effect so no need to clear
      this.redraw();
    }

    this.hoveringEntry = currentHoverEntry;

    if (!this.hoveringEntry) {
      return;
    }

    const rect = this.entryRect(this.hoveringEntry);

    this.canvasDrawer.drawRect(rect, this.color(), 1.0);
    this.canvasDrawer.drawRectBorder(rect);
  }

  private entryRect(entry: Timestamp, padding = 0): Rect {
    const xPos = this.getXPosOf(entry);

    return new Rect(
      xPos + padding,
      padding,
      this.getEntryWidth() - 2 * padding,
      this.getEntryWidth() - 2 * padding,
    );
  }

  private getXPosOf(entry: Timestamp): number {
    const selectionRange = this.selectionRange();
    const start = selectionRange.startNs;
    const end = selectionRange.endNs;

    return Number(
      (BigInt(this.getAvailableWidth()) * BigInt(entry.getValueNs() - start)) /
        BigInt(end - start),
    );
  }

  private getTimestampOf(x: number): Timestamp {
    const selectionRange = this.selectionRange();
    const start = selectionRange.startNs;
    const end = selectionRange.endNs;
    const ts =
      (BigInt(Math.floor(x)) * BigInt(end - start)) /
        BigInt(this.getAvailableWidth()) +
      start;
    return this.timestampConverter().makeTimestampFromNs(ts);
  }

  private drawEntry(entry: Timestamp) {
    const rect = this.entryRect(entry);
    this.canvasDrawer.drawRect(rect, this.color(), 0.2);
  }

  private drawSelectedEntry() {
    const selectedEntry = this.selectedEntry();
    if (selectedEntry === undefined) {
      return;
    }
    const rect = this.entryRect(selectedEntry.getTimestamp(), 1);
    this.canvasDrawer.drawRect(rect, this.color(), 1.0);
    this.canvasDrawer.drawRectBorder(rect);
  }
}

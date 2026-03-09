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

import {assertDefined} from '@common/assert';
import {getMax, getMin} from '@common/bigint_math';
import {TimeRange, Timestamp} from '@common/time/time';
import {ComponentTimestampConverter} from '@common/time/timestamp_converter';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {TimelineSegment} from './segment';

function getTimestamp(
  transition: HierarchyTreeNode,
  name: string,
): Timestamp | undefined {
  return transition.getEagerPropertyByName(name)?.getValue<Timestamp>();
}

export declare interface TransitionLifecycle<T> {
  stages: Array<TimelineSegment<T>>;
  totalDuration: T;
}

/**
 * Converts a transition lifecycle from TimeRange segments to another type.
 *
 * @param convertStageStrategy The strategy to convert a lifecycle stage.
 * @param calculateTotalDurationStrategy The strategy to calculate lifecycle duration.
 * @param lifecycle The lifecycle to convert.
 */
export function convertLifecycle<T>(
  convertStageStrategy: (stage: TimelineSegment<TimeRange>) => T,
  calculateTotalDurationStrategy: (stages: Array<TimelineSegment<T>>) => T,
  lifecycle: TransitionLifecycle<TimeRange>,
): TransitionLifecycle<T> {
  const newStages = lifecycle.stages.map((stage) => {
    return {
      segment: convertStageStrategy(stage),
      unknownStart: stage.unknownStart,
      unknownEnd: stage.unknownEnd,
      color: stage.color,
      activeColor: stage.activeColor,
    };
  });
  const totalDuration = calculateTotalDurationStrategy(newStages);
  const newLifecycle = {
    stages: newStages,
    totalDuration,
  };
  return newLifecycle;
}

/**
 * Gets the lifecycle of a transition through time ranges for each stage.
 *
 * @param transition The transition to get the lifecycle for.
 * @param visibleTimeRange The visible time range of the timeline.
 * @param converter The timestamp converter.
 */
export function getLifecycleForTransition(
  transition: HierarchyTreeNode,
  visibleTimeRange: TimeRange,
  converter: ComponentTimestampConverter,
): TransitionLifecycle<TimeRange> | undefined {
  // TODO (b/324056564): Visualize transition lifecycle in timeline

  // Currently, we only render transitions during 'pending-to-play' or 'play'
  // stages, so do not render if transition created but not sent. Also do not
  // render if the transition is merged to avoid confusion in UX between played
  // and merged transitions.

  if (getTimestamp(transition, 'mergeTimeNs')) {
    return;
  }

  const createTs = getTimestamp(transition, 'createTimeNs');
  const finishTs = getTimestamp(transition, 'finishTimeNs');
  const abortTs =
    getTimestamp(transition, 'shellAbortTimeNs') ??
    getTimestamp(transition, 'wmAbortTimeNs');
  const sendTs = getTimestamp(transition, 'sendTimeNs');
  const dispatchTs = getTimestamp(transition, 'dispatchTimeNs');

  const pendingStartTs = sendTs;
  const playingStartTs = dispatchTs;

  let pendingEndTs: Timestamp | undefined;
  if (pendingStartTs) {
    pendingEndTs = playingStartTs ?? finishTs ?? abortTs;
  } else if (createTs && !playingStartTs) {
    pendingEndTs = finishTs ?? abortTs;
  } else if (!createTs && abortTs) {
    pendingEndTs = abortTs;
  }

  const playingEndTs = playingStartTs ? finishTs : undefined;

  if (!pendingStartTs && !pendingEndTs && !playingStartTs && !playingEndTs) {
    // start and end times unknown for both stages
    return undefined;
  }

  if (
    !isLifecycleVisible(
      pendingStartTs,
      pendingEndTs,
      playingStartTs,
      playingEndTs,
      visibleTimeRange,
    )
  ) {
    return undefined;
  }

  const stages = [];

  const pendingToPlayRange = makeClampedTimeRange(
    pendingStartTs,
    pendingEndTs,
    converter,
    visibleTimeRange,
  );
  if (pendingToPlayRange) {
    const pendingToPlay = {
      segment: pendingToPlayRange,
      unknownStart: sendTs === undefined,
      unknownEnd: (dispatchTs ?? abortTs ?? finishTs) === undefined,
      color: PENDING_TO_PLAY_COLOR,
      activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
    };
    stages.push(pendingToPlay);
  }

  const playingRange = makeClampedTimeRange(
    playingStartTs,
    playingEndTs,
    converter,
    visibleTimeRange,
  );
  if (playingRange) {
    const playing = {
      segment: playingRange,
      unknownStart: dispatchTs === undefined,
      unknownEnd: finishTs === undefined,
    };
    stages.push(playing);
  }

  const start = assertDefined(pendingToPlayRange?.from ?? playingRange?.from);
  const end = assertDefined(playingRange?.to ?? pendingToPlayRange?.to);
  const totalDuration = new TimeRange(start, end);

  return {
    stages,
    totalDuration,
  };
}

function makeClampedTimeRange(
  startTs: Timestamp | undefined,
  endTs: Timestamp | undefined,
  converter: ComponentTimestampConverter,
  visible: TimeRange,
): TimeRange | undefined {
  if (startTs === undefined && endTs === undefined) {
    return undefined;
  }

  // if start or end time is unknown, we render a short segment in the timeline
  // at the known timestamp with width equivalent to 1 ns
  let start = startTs?.getValueNs() ?? assertDefined(endTs).getValueNs() - 1n;
  let end = endTs?.getValueNs() ?? assertDefined(startTs).getValueNs() + 1n;

  // clamp the transition's rendered range to the visible timeline range
  start = assertDefined(getMax([start, visible.startNs]));
  end = assertDefined(getMin([end, visible.endNs]));

  return new TimeRange(
    converter.makeTimestampFromNs(start),
    converter.makeTimestampFromNs(end),
  );
}

function isLifecycleVisible(
  pendingStart: Timestamp | undefined,
  pendingEnd: Timestamp | undefined,
  playingStart: Timestamp | undefined,
  playingEnd: Timestamp | undefined,
  visible: TimeRange,
): boolean {
  if (playingEnd && playingEnd < visible.from) {
    // playing finishes before visible time range
    return false;
  }

  if (!playingStart && pendingEnd && pendingEnd < visible.from) {
    // no playing stage and pending finishes before visible time range
    return false;
  }

  if (!pendingStart && !playingStart && pendingEnd && pendingEnd > visible.to) {
    // no playing stage, unknown start for pending and pending finishes before visible time range
    return false;
  }

  if (!playingEnd && playingStart && playingStart < visible.from) {
    // playing starts before visible time range and finish time unknown
    return false;
  }

  if (
    !playingEnd &&
    !pendingEnd &&
    pendingStart &&
    pendingStart < visible.from
  ) {
    // no playing stage and pending starts before visible time range and finish time unknown
    return false;
  }

  if (pendingStart && pendingStart > visible.to) {
    // pending starts after visible time range
    return false;
  }

  if (!pendingStart && playingStart && playingStart > visible.to) {
    // no pending and playing starts after visible time range
    return false;
  }

  return true;
}

export const PENDING_TO_PLAY_COLOR = '#F583C2';
export const PENDING_TO_PLAY_ACTIVE_COLOR = '#3d7dd4';

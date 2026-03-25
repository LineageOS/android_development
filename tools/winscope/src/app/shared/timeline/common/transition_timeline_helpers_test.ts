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
import {makeConverterZeroRteOffsets} from '@common/time/testing/test_helpers';
import {TimeRange} from '@common/time/time';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {TransitionStatus} from '@trace/transitions/status';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from '@tree_node/testing/hierarchy_tree_builder';

import {TimelineSegment} from './segment';
import {convertLifecycle, getLifecycleForTransition, PENDING_TO_PLAY_ACTIVE_COLOR, PENDING_TO_PLAY_COLOR,} from './transition_timeline_helpers';

describe('transition_timeline_helpers', () => {
  const converter = makeConverterZeroRteOffsets();
  const ts8 = converter.makeTimestampFromRealNs(8n);
  const ts9 = converter.makeTimestampFromRealNs(9n);
  const ts10 = converter.makeTimestampFromRealNs(10n);
  const ts12 = converter.makeTimestampFromRealNs(12n);
  const ts16 = converter.makeTimestampFromRealNs(16n);
  const ts17 = converter.makeTimestampFromRealNs(17n);
  const ts20 = converter.makeTimestampFromRealNs(20n);
  const ts21 = converter.makeTimestampFromRealNs(21n);
  const ts22 = converter.makeTimestampFromRealNs(22n);
  const fullTimeRange = new TimeRange(ts10, ts20);

  describe('getLifecycleForTransition', () => {
    it('returns undefined if merge time present', () => {
      const transition = makeTransition({
        dispatchTimeNs: ts10,
        mergeTimeNs: ts12,
        finishTimeNs: ts17,
      });
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns undefined if send, dispatch, finish and abort times missing', () => {
      const transition = makeTransition({});
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns undefined if dispatch and finish time before full time range', () => {
      const transition = makeTransition({
        dispatchTimeNs: ts8,
        finishTimeNs: ts9,
      });
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns undefined if send and finish time before full time range', () => {
      const transition = makeTransition({
        sendTimeNs: ts8,
        finishTimeNs: ts9,
      });
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns undefined if shell abort time before full time range', () => {
      const transition = makeTransition({
        sendTimeNs: ts8,
        status: TransitionStatus.ABORTED,
        shellAbortTimeNs: ts9,
      });
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns undefined if wm abort time before full time range', () => {
      const transition = makeTransition({
        sendTimeNs: ts8,
        status: TransitionStatus.ABORTED,
        wmAbortTimeNs: ts9,
      });
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns undefined if finish time missing and dispatch time before full time range', () => {
      const transition = makeTransition({dispatchTimeNs: ts8});
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns undefined if finish and dispatch time missing and send time before full time range', () => {
      const transition = makeTransition({sendTimeNs: ts8});
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns undefined if send time after full time range', () => {
      const transition = makeTransition({
        sendTimeNs: ts21,
        finishTimeNs: ts22,
      });
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns undefined if send time missing and dispatch time after full time range', () => {
      const transition = makeTransition({
        dispatchTimeNs: ts21,
        finishTimeNs: ts22,
      });
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns undefined if dispatch time after full time range and abort time present', () => {
      const transition = makeTransition({
        dispatchTimeNs: ts21,
        status: TransitionStatus.ABORTED,
        shellAbortTimeNs: ts22,
      });
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns undefined if only finish time present', () => {
      const transition = makeTransition({finishTimeNs: ts17});
      expect(getLifecycle(transition)).toBeUndefined();
    });

    it('returns valid playing range', () => {
      const transition = makeTransition({
        dispatchTimeNs: ts12,
        finishTimeNs: ts17,
      });
      const expectedRange = new TimeRange(ts12, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns valid pending-to-play range - send time to shell abort time', () => {
      const transition = makeTransition({
        sendTimeNs: ts12,
        status: TransitionStatus.ABORTED,
        shellAbortTimeNs: ts17,
      });
      const expectedRange = new TimeRange(ts12, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns valid pending-to-play range - send time to wm abort time', () => {
      const transition = makeTransition({
        sendTimeNs: ts12,
        status: TransitionStatus.ABORTED,
        wmAbortTimeNs: ts17,
      });
      const expectedRange = new TimeRange(ts12, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns valid pending-to-play range - send time to finish time', () => {
      const transition = makeTransition({
        sendTimeNs: ts12,
        status: TransitionStatus.ABORTED,
        wmAbortTimeNs: ts16,
        shellAbortTimeNs: ts16,
        finishTimeNs: ts17,
      });
      const expectedRange = new TimeRange(ts12, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns playing range from visible start to finish time', () => {
      const transition = makeTransition({
        dispatchTimeNs: ts8,
        finishTimeNs: ts17,
      });
      const expectedRange = new TimeRange(ts10, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns pending-to-play range from visible start to shell abort time', () => {
      const transition = makeTransition({
        sendTimeNs: ts8,
        shellAbortTimeNs: ts17,
      });
      const expectedRange = new TimeRange(ts10, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns pending-to-play range from visible start to wm abort time', () => {
      const transition = makeTransition({sendTimeNs: ts8, wmAbortTimeNs: ts17});
      const expectedRange = new TimeRange(ts10, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns pending-to-play range from visible start to finish time', () => {
      const transition = makeTransition({
        sendTimeNs: ts8,
        wmAbortTimeNs: ts16,
        finishTimeNs: ts17,
      });
      const expectedRange = new TimeRange(ts10, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns pending-to-play range from unknown start to finish time', () => {
      const transition = makeTransition({
        createTimeNs: ts8,
        finishTimeNs: ts17,
      });
      const expectedRange = new TimeRange(ts16, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: true,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns pending-to-play range from unknown start to shell abort time', () => {
      const transition = makeTransition({shellAbortTimeNs: ts17});
      const expectedRange = new TimeRange(ts16, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: true,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns pending-to-play range from unknown start to wm abort time', () => {
      const transition = makeTransition({wmAbortTimeNs: ts17});
      const expectedRange = new TimeRange(ts16, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: true,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns playing range from start to visible end', () => {
      const transition = makeTransition({
        dispatchTimeNs: ts17,
        finishTimeNs: ts22,
      });
      const expectedRange = new TimeRange(ts17, ts20);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns playing range from start to unknown end', () => {
      const transition = makeTransition({dispatchTimeNs: ts16});
      const expectedRange = new TimeRange(ts16, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            unknownStart: false,
            unknownEnd: true,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns pending range from start to visible end', () => {
      const transition = makeTransition({sendTimeNs: ts16, finishTimeNs: ts21});
      const expectedRange = new TimeRange(ts16, ts20);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns pending range from start to unknown end', () => {
      const transition = makeTransition({sendTimeNs: ts16});
      const expectedRange = new TimeRange(ts16, ts17);
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: expectedRange,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: true,
          },
        ],
        totalDuration: expectedRange,
      });
    });

    it('returns valid pending and playing ranges - full ranges', () => {
      const transition = makeTransition({
        sendTimeNs: ts10,
        status: TransitionStatus.ABORTED,
        abortTimeNs: ts12,
        dispatchTimeNs: ts16,
        finishTimeNs: ts17,
      });
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: new TimeRange(ts10, ts16),
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
          {
            segment: new TimeRange(ts16, ts17),
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: new TimeRange(ts10, ts17),
      });
    });

    it('returns valid pending and playing ranges - pending range before visible min', () => {
      const transition = makeTransition({
        sendTimeNs: ts8,
        status: TransitionStatus.ABORTED,
        abortTimeNs: ts12,
        dispatchTimeNs: ts16,
        finishTimeNs: ts17,
      });
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: new TimeRange(ts10, ts16),
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
          {
            segment: new TimeRange(ts16, ts17),
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: new TimeRange(ts10, ts17),
      });
    });

    it('returns valid pending and playing ranges - playing end after visible max', () => {
      const transition = makeTransition({
        sendTimeNs: ts10,
        status: TransitionStatus.ABORTED,
        abortTimeNs: ts12,
        dispatchTimeNs: ts16,
        finishTimeNs: ts22,
      });
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: new TimeRange(ts10, ts16),
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
          {
            segment: new TimeRange(ts16, ts20),
            unknownStart: false,
            unknownEnd: false,
          },
        ],
        totalDuration: new TimeRange(ts10, ts20),
      });
    });

    it('returns valid pending and playing ranges - playing end unknown', () => {
      const transition = makeTransition({
        sendTimeNs: ts10,
        status: TransitionStatus.ABORTED,
        abortTimeNs: ts12,
        dispatchTimeNs: ts16,
      });
      expect(getLifecycle(transition)).toEqual({
        stages: [
          {
            segment: new TimeRange(ts10, ts16),
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
          {
            segment: new TimeRange(ts16, ts17),
            unknownStart: false,
            unknownEnd: true,
          },
        ],
        totalDuration: new TimeRange(ts10, ts17),
      });
    });
  });

  describe('convertLifecycle', () => {
    it('converts lifecycle', () => {
      const transition = makeTransition({
        sendTimeNs: ts10,
        dispatchTimeNs: ts16,
      });
      const lifecycle = assertDefined(getLifecycle(transition));
      const stageStrategy = (stage: TimelineSegment<TimeRange>) =>
        stage.segment.startNs;
      const durationStrategy = (stages: Array<TimelineSegment<bigint>>) => {
        return stages.reduce((tot, curr) => (tot += curr.segment), 0n);
      };
      const newLifecycle = convertLifecycle(
        stageStrategy,
        durationStrategy,
        lifecycle,
      );
      expect(newLifecycle).toEqual({
        stages: [
          {
            segment: 10n,
            color: PENDING_TO_PLAY_COLOR,
            activeColor: PENDING_TO_PLAY_ACTIVE_COLOR,
            unknownStart: false,
            unknownEnd: false,
          },
          {
            segment: 16n,
            color: undefined,
            activeColor: undefined,
            unknownStart: false,
            unknownEnd: true,
          },
        ],
        totalDuration: 26n,
      });
    });
  });

  function getLifecycle(transition: HierarchyTreeNode) {
    return getLifecycleForTransition(transition, fullTimeRange, converter);
  }

  function makeTransition(properties: object): HierarchyTreeNode {
    return new HierarchyTreeBuilder()
      .setRootNodeFormatter(new SetFormatters())
      .setId('')
      .setName('')
      .setProperties(properties)
      .build();
  }
});

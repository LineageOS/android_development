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

import {PlaybackPresenter} from './playback_presenter';
import {EmitEvent} from 'messaging/winscope_event_emitter';
import {Trace} from 'trace_api/trace';
import {makeElapsedTimestamp} from 'test/unit/time_test_helpers';
import {TraceBuilder} from 'test/unit/trace_builder';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from 'test/unit/hierarchy_tree_builder';
import {TraceType} from 'trace_api/trace_type';
import {Timer} from 'common/time/timer';
import {makeEmptyTrace} from 'test/unit/trace_utils';
import {
  PlaybackStateChangeHandled,
  TracePositionUpdate,
} from 'messaging/winscope_event';
import {PlaybackState} from './playback_state';
import {MediaBasedTraceEntry} from 'trace_api/media_based_trace_entry';
import {TracesBuilder} from 'test/unit/traces_builder';
import {assertDefined} from 'common/assert';

describe('PlaybackPresenter', () => {
  const timestamp0 = makeElapsedTimestamp(0n);
  const timestamp2 = makeElapsedTimestamp(2n);
  const timestamp3 = makeElapsedTimestamp(3n);
  const timestamp4 = makeElapsedTimestamp(4n);
  const timestamp5 = makeElapsedTimestamp(5n);
  const traces = new TracesBuilder()
    .setTimestamps(TraceType.SCREEN_RECORDING, [
      timestamp0,
      timestamp2,
      timestamp3,
      timestamp5,
    ])
    .build();

  let trace: Trace<HierarchyTreeNode>;
  let screenRecordingTrace: Trace<MediaBasedTraceEntry>;
  let presenter: PlaybackPresenter;
  let mockEmitWinscopeEvent: jasmine.Spy<EmitEvent>;

  beforeAll(() => {
    trace = new TraceBuilder<HierarchyTreeNode>()
      .setType(TraceType.SURFACE_FLINGER)
      .setEntries([
        new HierarchyTreeBuilder()
          .setId('Test Trace')
          .setName('entry1')
          .build(),
        new HierarchyTreeBuilder()
          .setId('Test Trace2')
          .setName('entry2')
          .build(),
        new HierarchyTreeBuilder()
          .setId('Test Trace3')
          .setName('entry3')
          .build(),
      ])
      .setTimestamps([timestamp2, timestamp3, timestamp4])
      .build();
    screenRecordingTrace = assertDefined(
      traces.getTrace(TraceType.SCREEN_RECORDING),
    );
  });

  beforeEach(() => {
    mockEmitWinscopeEvent = jasmine.createSpy('emitWinscopeEvent');
    mockEmitWinscopeEvent.and.resolveTo();
    presenter = new PlaybackPresenter(mockEmitWinscopeEvent);
  });

  it('initializes in a paused state', () => {
    expect(presenter.isPlaying()).toBeFalse();
  });

  describe('play', () => {
    describe('with no SR trace', async () => {
      it('starts playback', async () => {
        await presenter.play(trace, 0, PlaybackState.FORWARDS, undefined);
        expect(presenter.isPlaying()).toBeTrue();

        presenter.play(trace, 0, PlaybackState.BACKWARDS, undefined);
        expect(presenter.isPlaying()).toBeTrue();
      });

      it('in reverse starts at the last position of the trace if starting index is 0', async () => {
        await presenter.play(trace, 0, PlaybackState.BACKWARDS, undefined);
        const update = mockEmitWinscopeEvent.calls.argsFor(1)[0];
        expect(update).toBeInstanceOf(TracePositionUpdate);
        expect(
          (update as TracePositionUpdate).position.entry?.getIndex(),
        ).toEqual(2);
      });

      it('plays through all the entries in the trace', async () => {
        await presenter.play(trace, 0, PlaybackState.FORWARDS, undefined);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const allUpdates = mockEmitWinscopeEvent.calls.all();
        for (let i = 1; i < trace.lengthEntries + 1; i++) {
          expect(allUpdates[i].args[0]).toBeInstanceOf(TracePositionUpdate);
        }
        expect(allUpdates[trace.lengthEntries + 1].args[0]).toBeInstanceOf(
          PlaybackStateChangeHandled,
        );
      });

      it('in reverse plays through all the entries in the trace', async () => {
        await presenter.play(trace, 0, PlaybackState.BACKWARDS, undefined);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const allUpdates = mockEmitWinscopeEvent.calls.all();
        for (let i = 1; i < trace.lengthEntries + 1; i++) {
          expect(allUpdates[i].args[0]).toBeInstanceOf(TracePositionUpdate);
        }
        expect(allUpdates[trace.lengthEntries + 1].args[0]).toBeInstanceOf(
          PlaybackStateChangeHandled,
        );
      });

      it('plays from specific starting entry', async () => {
        await presenter.play(trace, 1, PlaybackState.FORWARDS, undefined);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const update = mockEmitWinscopeEvent.calls.all()[2].args[0];
        expect(update).toBeInstanceOf(TracePositionUpdate);
        expect(
          (update as TracePositionUpdate).position.entry?.getIndex(),
        ).toEqual(2);
      });

      it('plays from specific starting entry in reverse', async () => {
        await presenter.play(trace, 1, PlaybackState.BACKWARDS, undefined);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const reverseUpdate = mockEmitWinscopeEvent.calls.all()[2].args[0];
        expect(reverseUpdate).toBeInstanceOf(TracePositionUpdate);
        expect(
          (reverseUpdate as TracePositionUpdate).position.entry?.getIndex(),
        ).toEqual(0);
      });

      it('does not throw for an empty trace', async () => {
        await presenter.play(
          makeEmptyTrace(TraceType.SURFACE_FLINGER),
          0,
          PlaybackState.FORWARDS,
          undefined,
        );
        expect(mockEmitWinscopeEvent).not.toHaveBeenCalled();
      });

      it('does not play if the starting index is out of bounds', async () => {
        await presenter.play(
          trace,
          trace.lengthEntries + 1,
          PlaybackState.FORWARDS,
          undefined,
        );
        expect(mockEmitWinscopeEvent).not.toHaveBeenCalled();
      });
    });

    describe('with SR trace', async () => {
      it('plays through all the SR entries in the trace', async () => {
        await presenter.play(
          trace,
          0,
          PlaybackState.FORWARDS,
          screenRecordingTrace,
        );
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const allUpdates = mockEmitWinscopeEvent.calls.all();
        for (let i = 1; i < screenRecordingTrace.lengthEntries + 1; i++) {
          expect(allUpdates[i].args[0]).toBeInstanceOf(TracePositionUpdate);
        }
      });

      it('plays through all the SR entries in reverse in the trace', async () => {
        await presenter.play(
          trace,
          0,
          PlaybackState.BACKWARDS,
          screenRecordingTrace,
        );
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const allUpdates = mockEmitWinscopeEvent.calls.all();
        for (let i = 1; i < screenRecordingTrace.lengthEntries + 1; i++) {
          expect(allUpdates[i].args[0]).toBeInstanceOf(TracePositionUpdate);
        }
      });
    });
  });

  describe('pause', () => {
    it('stops the playback loop', async () => {
      await presenter.play(trace, 0, PlaybackState.FORWARDS, undefined);
      expect(presenter.isPlaying()).toBeTrue();
      await presenter.pause();
      expect(presenter.isPlaying()).toBeFalse();
    });

    it('has no effect when already paused', async () => {
      expect(presenter.isPlaying()).toBeFalse();
      await presenter.pause();
      expect(mockEmitWinscopeEvent).not.toHaveBeenCalled();
    });
  });

  describe('speed change', () => {
    it('does not skip entries while playing through the trace', async () => {
      await presenter.play(trace, 0, PlaybackState.FORWARDS, undefined);
      presenter.changeSpeed(2);
      await new Timer(1000).wait(() => !presenter.isPlaying());
      expect(mockEmitWinscopeEvent).toHaveBeenCalledTimes(5);
    });
  });
});

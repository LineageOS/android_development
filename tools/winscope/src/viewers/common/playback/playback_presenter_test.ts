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
import {EmitEvent} from '@messaging/winscope_event_emitter';
import {
  CustomTraceEntryLazy,
  Trace,
  TraceEntryEager,
  TraceEntryLazy,
} from '@trace_api/trace';
import {makeRealTimestamp} from '@test/unit/time_test_helpers';
import {TraceBuilder} from '@test/unit/trace_builder';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {TraceType} from '@trace_api/trace_type';
import {Timer} from '@common/time/timer';
import {makeEmptyTrace} from '@test/unit/trace_test_helpers';
import {PlaybackStateChangeHandled} from '@app/components/timeline/playback_events';
import {TracePositionUpdate} from '@trace/trace_events';
import {PlaybackState} from './playback_state';

import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {TransformMatrix} from '@common/geometry/transform_matrix';
import {
  MediaBasedTraceEntry,
  VideoEntry,
} from '@trace/media_based/media_based_trace_entry';
import {TracePosition} from '@trace_api/trace_position';
import {CornerRadii} from '@common/geometry/corner_radii';
import {assertDefined} from '@common/assert';
import {VideoFrameCache} from './video_frame_cache';
import {getPerfettoParser} from '@test/unit/fixture_utils';
import {Parser} from '@trace_api/parser';

describe('PlaybackPresenter', () => {
  const blob = new Blob();
  const timestamp1 = makeRealTimestamp(1n);
  let screenRecordingTrace: Trace<MediaBasedTraceEntry>;

  let parser: Parser<HierarchyTreeNode>;
  let trace: Trace<HierarchyTreeNode>;
  let traceGeometryData: TraceGeometryData;
  let presenter: PlaybackPresenter;
  let emitEventSpy: jasmine.Spy<EmitEvent>;
  let cache: jasmine.SpyObj<VideoFrameCache>;

  beforeAll(async () => {
    const res = await getPerfettoParser(
      TraceType.SURFACE_FLINGER,
      'traces/perfetto/layers_trace.perfetto-trace',
    );
    parser = res.parser;
    traceGeometryData = res.traceGeometryData;

    const parserTimestamps = res.parser.getTimestamps();
    const lastTs = parserTimestamps[parserTimestamps.length - 1].getValueNs();

    screenRecordingTrace = new TraceBuilder<MediaBasedTraceEntry>()
      .setType(TraceType.SCREEN_RECORDING)
      .setEntries(Array.from({length: 5}, (_, i) => new VideoEntry(blob, i)))
      .setTimestamps([
        timestamp1,
        ...parserTimestamps.slice(0, 2),
        makeRealTimestamp(lastTs + 1n),
        makeRealTimestamp(lastTs + 2n),
      ])
      .build();
  });

  describe('play', () => {
    describe('with no SR trace', async () => {
      beforeEach(() => {
        setUpTestEnvironment();
      });

      it('starts playback', async () => {
        await presenter.play(0, PlaybackState.FORWARDS, undefined);
        expect(presenter.isPlaying()).toBeTrue();

        await presenter.play(0, PlaybackState.BACKWARDS, undefined);
        expect(presenter.isPlaying()).toBeTrue();
      });

      it('starts reverse playback at the last position if starting index is 0', async () => {
        await presenter.play(0, PlaybackState.BACKWARDS, undefined);
        const update = emitEventSpy.calls.argsFor(1)[0];
        expect(
          (update as TracePositionUpdate).position.entry?.getIndex(),
        ).toEqual(2);
      });

      it('plays through all the entries in the trace', async () => {
        await checkAllTraceEntriesPlayed(PlaybackState.FORWARDS);
      });

      it('in reverse plays through all the entries in the trace', async () => {
        await checkAllTraceEntriesPlayed(PlaybackState.BACKWARDS);
      });

      it('plays from specific starting entry', async () => {
        await presenter.play(1, PlaybackState.FORWARDS, undefined);
        await new Timer(500).sleepMs();
        const update = emitEventSpy.calls.argsFor(2)[0];
        expect(
          (update as TracePositionUpdate).position.entry?.getIndex(),
        ).toEqual(2);
      });

      it('plays from specific starting entry in reverse', async () => {
        await presenter.play(1, PlaybackState.BACKWARDS, undefined);
        await new Timer(500).sleepMs();
        const reverseUpdate = emitEventSpy.calls.argsFor(2)[0];
        expect(
          (reverseUpdate as TracePositionUpdate).position.entry?.getIndex(),
        ).toEqual(0);
      });

      it('does not throw for an empty trace', async () => {
        trace = makeEmptyTrace(TraceType.SURFACE_FLINGER);
        presenter = new PlaybackPresenter(emitEventSpy, trace);
        await presenter.play(0, PlaybackState.FORWARDS, undefined);
        expect(emitEventSpy).not.toHaveBeenCalled();
      });

      it('does not play if the starting index is out of bounds', async () => {
        await presenter.play(
          trace.lengthEntries + 1,
          PlaybackState.FORWARDS,
          undefined,
        );
        expect(emitEventSpy).not.toHaveBeenCalled();
      });

      async function checkAllTraceEntriesPlayed(stateToReflect: PlaybackState) {
        await presenter.play(0, stateToReflect, undefined);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const allUpdates = emitEventSpy.calls.all();
        const eagerUpdates = Array.from({length: 3}, (_, i) => {
          return {traceIndex: i, srIndex: undefined, seekTrace: true};
        });
        checkAllEntriesPlayed(allUpdates, stateToReflect, eagerUpdates);
        checkPrototypesAdded();
      }

      function checkPrototypesAdded() {
        const positionUpdates = emitEventSpy.calls
          .all()
          .filter(
            (c) =>
              c.args[0] instanceof TracePositionUpdate &&
              c.args[0].prefetchedEntries?.trace !== undefined,
          )
          .map((c) => {
            return assertDefined(
              (c.args[0] as TracePositionUpdate).prefetchedEntries?.trace,
            );
          });

        const nodeWithRects = assertDefined(
          positionUpdates[0].getValue().findDfs((node) => {
            return node.name === 'com.android.systemui.ImageWallpaper#76';
          }),
        );
        nodeWithRects
          .getRects()
          .concat(nodeWithRects.getSecondaryRects())
          .forEach((rect) => {
            if (rect.cornerRadii) {
              expect(rect.cornerRadii).toBeInstanceOf(CornerRadii);
            }
            expect(rect.transform).toBeInstanceOf(TransformMatrix);
          });

        const secondTree = positionUpdates[1].getValue();
        expect(secondTree.getEagerPropertyByName('argSetId')).toBeDefined();
        expect(
          secondTree
            .getChildByName('Display 0 name="Built-in Screen"#3')
            ?.getEagerPropertyByName('isVisible'),
        ).toBeDefined();
      }
    });

    describe('with SR trace', async () => {
      beforeEach(() => {
        setUpTestEnvironment();
        cache.get.and.returnValue(
          Promise.resolve({
            frame: jasmine.createSpyObj<ImageBitmap>('image', ['close']),
            rotationAngle: 0,
          }),
        );
      });

      it('plays through all SR entries before/after trace', async () => {
        await checkAllSrEntriesBeforeAndAfterTrace(PlaybackState.FORWARDS);
      });

      it('plays through all SR entries before/after trace in reverse', async () => {
        await checkAllSrEntriesBeforeAndAfterTrace(PlaybackState.BACKWARDS);
      });

      it('plays through all trace entries before/after SR', async () => {
        await checkAllTraceEntriesBeforeAndAfterSr(PlaybackState.FORWARDS);
      });

      it('plays through all trace entries before/after SR in reverse', async () => {
        await checkAllTraceEntriesBeforeAndAfterSr(PlaybackState.BACKWARDS);
      });

      async function checkAllSrEntriesBeforeAndAfterTrace(
        stateToReflect: PlaybackState,
      ) {
        await presenter.play(0, stateToReflect, screenRecordingTrace);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const allUpdates = emitEventSpy.calls.all();
        const eagerUpdates = [
          {srIndex: 0, traceIndex: undefined, seekTrace: false},
          {srIndex: 1, traceIndex: undefined, seekTrace: false},
          {srIndex: 2, traceIndex: 0, seekTrace: true},
          {srIndex: 3, traceIndex: 1, seekTrace: true},
          {srIndex: 3, traceIndex: 2, seekTrace: true},
          {srIndex: 4, traceIndex: 2, seekTrace: false},
        ];
        checkAllEntriesPlayed(allUpdates, stateToReflect, eagerUpdates);
      }

      async function checkAllTraceEntriesBeforeAndAfterSr(
        stateToReflect: PlaybackState,
      ) {
        const srTrace = new TraceBuilder<MediaBasedTraceEntry>()
          .setType(TraceType.SCREEN_RECORDING)
          .setEntries(
            Array.from({length: 2}, (_, i) => {
              return new VideoEntry(blob, i);
            }),
          )
          .setTimestamps(parser.getTimestamps().slice(0, 2))
          .build();
        await presenter.play(0, stateToReflect, srTrace);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const allUpdates = emitEventSpy.calls.all();
        const eagerUpdates = [
          {srIndex: 0, traceIndex: undefined, seekTrace: false},
          {srIndex: 1, traceIndex: 0, seekTrace: true},
          {srIndex: 1, traceIndex: 1, seekTrace: true},
          {srIndex: undefined, traceIndex: 2, seekTrace: true},
        ];
        checkAllEntriesPlayed(
          allUpdates,
          stateToReflect,
          eagerUpdates,
          srTrace,
        );
      }
    });

    describe('with large trace', () => {
      let presenterLargeTrace: PlaybackPresenter;
      let largeTrace: Trace<HierarchyTreeNode>;
      let parserLargeTrace: Parser<HierarchyTreeNode>;
      let geometryDataLargeTrace: TraceGeometryData;

      beforeAll(async () => {
        const res = await getPerfettoParser(
          TraceType.SURFACE_FLINGER,
          'archives/deployment_full_trace_phone_perfetto.zip',
          undefined,
          'combined_winscope_trace.perfetto-trace',
        );
        geometryDataLargeTrace = res.traceGeometryData;
        parserLargeTrace = res.parser;
      });

      beforeEach(() => {
        initializePresenterAndLargeTrace();
      });

      it('handles large trace in forwards direction', async () => {
        await handlesBufferBoundary(145, 155, PlaybackState.FORWARDS);
        await handlesBufferBoundary(245, 255, PlaybackState.FORWARDS);
        await handlesBufferBoundary(257, undefined, PlaybackState.FORWARDS);
      });

      it('handles large trace in backwards direction', async () => {
        await handlesBufferBoundary(155, 145, PlaybackState.BACKWARDS);
        await handlesBufferBoundary(255, 245, PlaybackState.BACKWARDS);
        await handlesBufferBoundary(0, 257, PlaybackState.BACKWARDS);
        await handlesBufferBoundary(10, undefined, PlaybackState.BACKWARDS);
      });

      function initializePresenterAndLargeTrace() {
        emitEventSpy = jasmine.createSpy('emitWinscopeEvent');
        cache = jasmine.createSpyObj('cache', ['get', 'onDestroy']);
        largeTrace = Trace.fromParser(parserLargeTrace);
        presenterLargeTrace = new PlaybackPresenter(
          emitEventSpy,
          largeTrace,
          async () => cache,
        );
        presenterLargeTrace.setTraceGeometryData(geometryDataLargeTrace);
      }

      async function handlesBufferBoundary(
        startIndex: number,
        finishIndex: number | undefined,
        state: PlaybackState,
      ) {
        emitEventSpy.calls.reset();
        if (finishIndex !== undefined) {
          stopAtIndex(finishIndex, presenterLargeTrace);
        }
        await presenterLargeTrace.play(startIndex, state, undefined);
        await new Timer(5000).wait(() => !presenterLargeTrace.isPlaying());

        const allUpdates = emitEventSpy.calls
          .all()
          .map((c) => c.args[0])
          .filter((event) => event instanceof TracePositionUpdate);
        expect(allUpdates.length).toEqual(12); // 11 updates + 1 handled event
        const lazyIndex =
          finishIndex ?? (state === PlaybackState.FORWARDS ? 267 : 0);
        expect(allUpdates[allUpdates.length - 1]).toEqual(
          new TracePositionUpdate(
            TracePosition.fromTraceEntry(largeTrace.getEntry(lazyIndex)),
            true,
          ),
        );
      }
    });
  });

  describe('pause', () => {
    beforeEach(() => {
      setUpTestEnvironment();
    });

    it('initializes in a paused state', () => {
      expect(presenter.isPlaying()).toBeFalse();
    });

    it('stops the playback loop and emits handled event', async () => {
      await presenter.play(0, PlaybackState.FORWARDS, undefined);
      expect(presenter.isPlaying()).toBeTrue();
      await presenter.pause();
      expect(presenter.isPlaying()).toBeFalse();
      expect(emitEventSpy).toHaveBeenCalledWith(
        new PlaybackStateChangeHandled(PlaybackState.PAUSED, trace.type),
      );
    });

    it('has no effect when already paused', async () => {
      expect(presenter.isPlaying()).toBeFalse();
      await presenter.pause();
      expect(emitEventSpy).not.toHaveBeenCalled();
    });

    it('does not emit handled event if flag set to false', async () => {
      await presenter.play(0, PlaybackState.FORWARDS, undefined);
      expect(presenter.isPlaying()).toBeTrue();
      await presenter.pause(false);
      expect(presenter.isPlaying()).toBeFalse();
      expect(emitEventSpy).not.toHaveBeenCalledWith(
        new PlaybackStateChangeHandled(PlaybackState.PAUSED, trace.type),
      );
    });

    it('emits last updated entry as position update with lazy entry', async () => {
      stopAtIndex(1, presenter);
      await presenter.play(0, PlaybackState.FORWARDS, undefined);
      await new Timer(1000, 100).wait(() => {
        return emitEventSpy.calls.all().length === 4;
      });
      expect(emitEventSpy.calls.mostRecent().args[0]).toEqual(
        new TracePositionUpdate(
          TracePosition.fromTraceEntry(trace.getEntry(1)),
          true,
        ),
      );
    });
  });

  describe('speed change', () => {
    beforeEach(() => {
      setUpTestEnvironment();
    });

    it('increases speed', async () => {
      const finish1 = await getExecutionTime();
      presenter.changeSpeed(2);
      const finish2 = await getExecutionTime();
      expect(finish2).toBeLessThan(finish1);
    });

    it('decreases speed', async () => {
      const finish1 = await getExecutionTime();
      presenter.changeSpeed(0.25);
      const finish2 = await getExecutionTime();
      expect(finish2).toBeGreaterThan(finish1);
    });

    it('does not skip entries while playing through the trace', async () => {
      presenter.changeSpeed(2);
      await presenter.play(0, PlaybackState.FORWARDS, undefined);
      await new Timer(1000).wait(() => !presenter.isPlaying());
      expect(emitEventSpy).toHaveBeenCalledTimes(6);
    });

    async function getExecutionTime(): Promise<number> {
      const start = Date.now();
      await presenter.play(0, PlaybackState.FORWARDS, undefined);
      await new Timer(1000, 20).wait(() => !presenter.isPlaying());
      return Date.now() - start;
    }
  });

  function checkAllEntriesPlayed(
    allUpdates: ReadonlyArray<jasmine.CallInfo<EmitEvent>>,
    stateToReflect: PlaybackState,
    eagerUpdates: ExpectedEagerUpdate[],
    srTrace = screenRecordingTrace,
  ) {
    const startEvent = allUpdates[0].args[0] as PlaybackStateChangeHandled;
    expect(startEvent.stateToReflect).toEqual(stateToReflect);

    if (stateToReflect === PlaybackState.BACKWARDS) {
      eagerUpdates.reverse();
    }

    const checkTracePositionEntry = (i: number, j: number) => {
      const exp = eagerUpdates[i];
      const event = allUpdates[j].args[0] as TracePositionUpdate;
      const entry = event.position.entry;
      expect(entry?.getIndex()).toEqual(exp.srIndex ?? exp.traceIndex);
      expect(entry?.getFullTrace()).toEqual(
        exp.srIndex !== undefined ? srTrace : trace,
      );
      return {event, entry, exp};
    };

    const checkPrefetchedEntry = (
      event: TracePositionUpdate,
      exp: ExpectedEagerUpdate,
    ) => {
      const prefetchedEntry = event.prefetchedEntries?.trace;
      expect(prefetchedEntry === undefined).toEqual(
        exp.traceIndex === undefined,
      );
      if (prefetchedEntry && exp.traceIndex !== undefined) {
        expect(prefetchedEntry.getIndex()).toEqual(exp.traceIndex);
        expect(prefetchedEntry.getFullTrace()).toEqual(trace);
      }
    };

    const checkSeekPos = (
      event: TracePositionUpdate,
      exp: ExpectedEagerUpdate,
    ) => {
      const seekPos = event.prefetchedEntries?.seek;
      if (exp.seekTrace) {
        if (exp.traceIndex === undefined) {
          expect(seekPos).toBeUndefined();
        } else {
          const ts = trace.getEntry(exp.traceIndex).getTimestamp();
          expect(seekPos).toEqual(ts);
        }
      } else {
        if (exp.srIndex === undefined) {
          expect(seekPos).toBeUndefined();
        } else {
          const ts = srTrace.getEntry(exp.srIndex).getTimestamp();
          expect(seekPos).toEqual(ts);
        }
      }
    };

    for (let i = 1; i < eagerUpdates.length + 1; i++) {
      const {event, entry, exp} = checkTracePositionEntry(i - 1, i);
      expect(entry).toBeInstanceOf(
        exp.srIndex !== undefined ? CustomTraceEntryLazy : TraceEntryEager,
      );
      checkPrefetchedEntry(event, exp);
      checkSeekPos(event, exp);
    }

    const pauseEvent = allUpdates[allUpdates.length - 2]
      .args[0] as PlaybackStateChangeHandled;
    expect(pauseEvent.stateToReflect).toEqual(PlaybackState.PAUSED);

    const {event, entry} = checkTracePositionEntry(
      eagerUpdates.length - 1,
      allUpdates.length - 1,
    );
    expect(entry).toBeInstanceOf(TraceEntryLazy);
    expect(event.prefetchedEntries).toBeUndefined();
  }

  function stopAtIndex(index: number, p: PlaybackPresenter) {
    emitEventSpy.and.callFake(async (event) => {
      if (
        event instanceof TracePositionUpdate &&
        event.position.entry?.getIndex() === index
      ) {
        await p.pause(false);
      }
    });
  }

  function setUpTestEnvironment() {
    emitEventSpy = jasmine.createSpy('emitWinscopeEvent');
    cache = jasmine.createSpyObj('cache', ['get', 'onDestroy']);
    spyOn(parser, 'getLengthEntries').and.returnValue(3);
    trace = Trace.fromParser(parser);
    presenter = new PlaybackPresenter(emitEventSpy, trace, async () => cache);
    presenter.setTraceGeometryData(traceGeometryData);
  }
});

interface ExpectedEagerUpdate {
  srIndex?: number;
  traceIndex?: number;
  seekTrace: boolean;
}

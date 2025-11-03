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
import {Trace, TraceEntryEager, TraceEntryLazy} from 'trace_api/trace';
import {makeElapsedTimestamp} from 'test/unit/time_test_helpers';
import {TraceBuilder} from 'test/unit/trace_builder';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {HierarchyTreeBuilder} from 'test/unit/hierarchy_tree_builder';
import {TraceType} from 'trace_api/trace_type';
import {Timer} from 'common/time/timer';
import {makeEmptyTrace} from 'test/unit/trace_test_helpers';
import {PlaybackStateChangeHandled} from 'app/components/timeline/playback_events';
import {TracePositionUpdate} from 'trace/trace_events';
import {PlaybackState} from './playback_state';
import {QueryResult, QueryResults} from 'trace_processor/query_result';
import {RawDataQueryResult} from 'trace_processor/raw_data_query_result';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {Rect} from 'common/geometry/rect';
import {TransformMatrix} from 'common/geometry/transform_matrix';
import {Parser} from 'trace_api/parser';
import {MediaBasedTraceEntry} from 'trace_api/media_based_trace_entry';
import {TracePosition} from 'trace_api/trace_position';
import {TraceRectBuilder} from 'tree_node/trace_rect_builder';
import {CornerRadii} from 'common/geometry/corner_radii';
import {assertDefined} from 'common/assert';
import {RectsForTrace} from 'parsers/rect_extractor_result';

describe('PlaybackPresenter', () => {
  const timestamp0 = makeElapsedTimestamp(0n);
  const timestamp2 = makeElapsedTimestamp(2n);
  const timestamp3 = makeElapsedTimestamp(3n);
  const timestamp4 = makeElapsedTimestamp(4n);
  const timestamp5 = makeElapsedTimestamp(5n);
  const timestamp6 = makeElapsedTimestamp(6n);
  const screenRecordingTrace = new TraceBuilder<MediaBasedTraceEntry>()
    .setType(TraceType.SCREEN_RECORDING)
    .setEntries([
      new MediaBasedTraceEntry(),
      new MediaBasedTraceEntry(),
      new MediaBasedTraceEntry(),
      new MediaBasedTraceEntry(),
      new MediaBasedTraceEntry(),
    ])
    .setTimestamps([timestamp0, timestamp2, timestamp3, timestamp5, timestamp6])
    .build();
  const traceGeometryData = new TraceGeometryData(
    new Map([[0n, new Rect(0, 0, 0, 0)]]),
    new Map([[0n, new TransformMatrix(1, 1, 1, 1, 1, 1)]]),
  );

  let trace: Trace<HierarchyTreeNode>;
  let presenter: PlaybackPresenter;
  let emitEventSpy: jasmine.Spy<EmitEvent>;
  let postMessageSpy: jasmine.Spy;

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
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const update = emitEventSpy.calls.argsFor(2)[0];
        expect(
          (update as TracePositionUpdate).position.entry?.getIndex(),
        ).toEqual(2);
      });

      it('plays from specific starting entry in reverse', async () => {
        await presenter.play(1, PlaybackState.BACKWARDS, undefined);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const reverseUpdate = emitEventSpy.calls.argsFor(2)[0];
        expect(
          (reverseUpdate as TracePositionUpdate).position.entry?.getIndex(),
        ).toEqual(0);
      });

      it('starts reverse playback at end of trace', async () => {
        await presenter.play(1, PlaybackState.BACKWARDS, undefined);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const reverseUpdate = emitEventSpy.calls.all()[2].args[0];
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

      it('handles worker returning empty buffer', async () => {
        postMessageSpy.and.callFake(() => {
          presenter['workerPromiseResolve']?.([]);
        });
        await presenter.play(0, PlaybackState.FORWARDS, undefined);
        expect(emitEventSpy).not.toHaveBeenCalled();
        expect(presenter.isPlaying()).toBeFalse();
      });

      it('emits last updated entry as position update with lazy entry', async () => {
        await presenter.play(0, PlaybackState.FORWARDS, undefined);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        expect(emitEventSpy).toHaveBeenCalledWith(
          new TracePositionUpdate(
            TracePosition.fromTraceEntry(trace.getEntry(2)),
            true,
          ),
        );
      });

      it('applies prototypes to entry values', async () => {
        postMessageSpy.and.callFake((message) => {
          const mockTrees = makeTrees(message);
          const rect = new TraceRectBuilder()
            .setX(1)
            .setY(1)
            .setWidth(200)
            .setHeight(400)
            .setId('1')
            .setName('rect')
            .setTransform(TransformMatrix.IDENTITY)
            .setGroupId(0)
            .setIsVisible(true)
            .setIsDisplay(false)
            .setDepth(0)
            .setCornerRadii(new CornerRadii(0.1, 0.1, 0, 0))
            .setIsSpy(false)
            .build();
          mockTrees[0].setRects([rect]);
          mockTrees[0].setSecondaryRects([rect]);
          mockTrees[1].addOrReplaceChild(
            new HierarchyTreeBuilder()
              .setId(`TreeChild`)
              .setName(`NodeChild`)
              .setProperties({prop1: true})
              .build(),
          );

          presenter['workerPromiseResolve']?.(mockTrees);
        });

        await presenter.play(0, PlaybackState.FORWARDS, undefined);
        await new Timer(1000).wait(() => !presenter.isPlaying());

        const positionUpdates = emitEventSpy.calls
          .all()
          .filter(
            (c) =>
              c.args[0] instanceof TracePositionUpdate &&
              c.args[0].prefetchedEntry !== undefined,
          )
          .map((c) => {
            return assertDefined(
              (c.args[0] as TracePositionUpdate).prefetchedEntry,
            );
          }) as Array<TraceEntryEager<HierarchyTreeNode, HierarchyTreeNode>>;

        const firstTree = positionUpdates[0].getValue();
        assertDefined(firstTree.getRects())
          .concat(assertDefined(firstTree.getSecondaryRects()))
          .forEach((rect) => {
            expect(rect.transform).toBeInstanceOf(TransformMatrix);
            expect(rect.cornerRadii).toBeInstanceOf(CornerRadii);
          });

        const secondTree = positionUpdates[1].getValue();
        expect(secondTree.getEagerPropertyByName('prop1')).toBeDefined();
        expect(
          secondTree
            .getChildByName('NodeChild')
            ?.getEagerPropertyByName('prop1'),
        ).toBeDefined();
      });

      async function checkAllTraceEntriesPlayed(stateToReflect: PlaybackState) {
        await presenter.play(0, stateToReflect, undefined);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const allUpdates = emitEventSpy.calls.all();
        const eagerUpdates = [
          {traceIndex: 0, srIndex: undefined},
          {traceIndex: 1, srIndex: undefined},
          {traceIndex: 2, srIndex: undefined},
        ];
        checkAllEntriesPlayed(allUpdates, stateToReflect, eagerUpdates);
      }
    });

    describe('with SR trace', async () => {
      beforeEach(() => {
        setUpTestEnvironment();
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
          {srIndex: 0, traceIndex: 0},
          {srIndex: 1, traceIndex: 0},
          {srIndex: 2, traceIndex: 0},
          {srIndex: 3, traceIndex: 1},
          {srIndex: 3, traceIndex: 2},
          {srIndex: 4, traceIndex: 2},
        ];
        checkAllEntriesPlayed(allUpdates, stateToReflect, eagerUpdates);
      }

      async function checkAllTraceEntriesBeforeAndAfterSr(
        stateToReflect: PlaybackState,
      ) {
        const srTrace = new TraceBuilder<MediaBasedTraceEntry>()
          .setType(TraceType.SCREEN_RECORDING)
          .setEntries([new MediaBasedTraceEntry(), new MediaBasedTraceEntry()])
          .setTimestamps([timestamp2, timestamp3])
          .build();
        await presenter.play(0, stateToReflect, srTrace);
        await new Timer(1000).wait(() => !presenter.isPlaying());
        const allUpdates = emitEventSpy.calls.all();
        const eagerUpdates = [
          {srIndex: 0, traceIndex: 0},
          {srIndex: 1, traceIndex: 0},
          {srIndex: 1, traceIndex: 1},
          {srIndex: undefined, traceIndex: 2},
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

      beforeEach(() => {
        setUpTestEnvironment();
        initializePresenterAndLargeTrace(320);
      });

      it('handles large trace in forwards direction', async () => {
        await handlesBufferBoundary(145, 155, PlaybackState.FORWARDS);
        await handlesBufferBoundary(295, 305, PlaybackState.FORWARDS);
        await handlesBufferBoundary(309, undefined, PlaybackState.FORWARDS);
      });

      it('handles large trace in backwards direction', async () => {
        await handlesBufferBoundary(155, 145, PlaybackState.BACKWARDS);
        await handlesBufferBoundary(305, 295, PlaybackState.BACKWARDS);
        await handlesBufferBoundary(0, 309, PlaybackState.BACKWARDS);
        await handlesBufferBoundary(10, undefined, PlaybackState.BACKWARDS);
      });

      function initializePresenterAndLargeTrace(length: number) {
        let prevTs = 1n;
        largeTrace = new TraceBuilder<HierarchyTreeNode>()
          .setType(TraceType.SURFACE_FLINGER)
          .setEntries(
            Array.from({length}, () => {
              return new HierarchyTreeBuilder()
                .setId('Test Trace')
                .setName('entry1')
                .build();
            }),
          )
          .setTimestamps(
            Array.from({length}, () => {
              prevTs += 1n;
              return makeElapsedTimestamp(prevTs);
            }),
          )
          .build();
        setTraceSpies(largeTrace);
        presenterLargeTrace = new PlaybackPresenter(emitEventSpy, largeTrace);
        presenterLargeTrace.setTraceGeometryData(traceGeometryData);
        spyOn(
          presenterLargeTrace['playbackWorker'],
          'postMessage',
        ).and.callFake((message) => {
          const mockTrees = makeTrees(message);
          presenterLargeTrace['workerPromiseResolve']?.(mockTrees);
        });
      }

      async function handlesBufferBoundary(
        startIndex: number,
        finishIndex: number | undefined,
        state: PlaybackState,
      ) {
        emitEventSpy.calls.reset();
        if (finishIndex !== undefined) {
          emitEventSpy.and.callFake(async (event) => {
            if (
              event instanceof TracePositionUpdate &&
              event.position.entry?.getIndex() === finishIndex
            ) {
              await presenterLargeTrace.pause(false);
            }
          });
        }
        await presenterLargeTrace.play(startIndex, state, undefined);
        await new Timer(1000).wait(() => !presenterLargeTrace.isPlaying());

        const allUpdates = emitEventSpy.calls
          .all()
          .map((c) => c.args[0])
          .filter((event) => event instanceof TracePositionUpdate);
        expect(allUpdates.length).toEqual(12); // 11 updates + 1 handled event
        const lazyIndex =
          finishIndex ?? (state === PlaybackState.FORWARDS ? 319 : 0);
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
      emitEventSpy.and.callFake(async (event) => {
        if (
          event instanceof TracePositionUpdate &&
          event.position.entry?.getIndex() === 1
        ) {
          await presenter.pause(false);
        }
      });
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
    eagerUpdates: Array<{srIndex?: number; traceIndex?: number}>,
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

    for (let i = 1; i < eagerUpdates.length + 1; i++) {
      const {event, entry, exp} = checkTracePositionEntry(i - 1, i);
      expect(entry).toBeInstanceOf(
        exp.srIndex !== undefined ? TraceEntryLazy : TraceEntryEager,
      );
      expect(event.prefetchedEntry).toBeDefined();
      expect(event.prefetchedEntry?.getIndex()).toEqual(exp.traceIndex);
      expect(event.prefetchedEntry?.getFullTrace()).toEqual(trace);
    }

    const pauseEvent = allUpdates[allUpdates.length - 2]
      .args[0] as PlaybackStateChangeHandled;
    expect(pauseEvent.stateToReflect).toEqual(PlaybackState.PAUSED);

    const {event, entry} = checkTracePositionEntry(
      eagerUpdates.length - 1,
      allUpdates.length - 1,
    );
    expect(entry).toBeInstanceOf(TraceEntryLazy);
    expect(event.prefetchedEntry).toBeUndefined();
  }

  function setTraceSpies(traceToSpy: Trace<HierarchyTreeNode>) {
    const mockParser = {
      getRectsMap: async () => new Map(),
    };
    spyOn(traceToSpy, 'getParser').and.returnValue(
      mockParser as Parser<HierarchyTreeNode>,
    );
    spyOn(traceToSpy, 'getQueryResults').and.callFake(async () => {
      return Promise.resolve({
        snapshotRange: new RawDataQueryResult(),
        nodeRange: new RawDataQueryResult(),
        allVisibleRects: undefined,
        allSnapshots: undefined,
      } as QueryResults<QueryResult | RawDataQueryResult>);
    });
  }

  function makeTrees(message: WorkerMessage): HierarchyTreeNode[] {
    const numEntries = message.end - message.start;
    return Array.from({length: numEntries}).map((_, i) =>
      new HierarchyTreeBuilder()
        .setId(`Tree ${message.start + i}`)
        .setName(`Node ${message.start + i}`)
        .setProperties({prop1: true})
        .build(),
    );
  }

  function setUpTestEnvironment() {
    emitEventSpy = jasmine.createSpy('emitWinscopeEvent');

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
    setTraceSpies(trace);

    presenter = new PlaybackPresenter(emitEventSpy, trace);
    presenter.setTraceGeometryData(traceGeometryData);

    postMessageSpy = spyOn(
      presenter['playbackWorker'],
      'postMessage',
    ).and.callFake((message) => {
      const mockTrees = makeTrees(message);
      presenter['workerPromiseResolve']?.(mockTrees);
    });
  }
});

interface WorkerMessage {
  start: number;
  end: number;
  snapshotBatches: Uint8Array[] | undefined;
  nodeBatches: Uint8Array[];
  type: TraceType;
  traceGeometryData: TraceGeometryData;
  visibleRectsMap: RectsForTrace;
}

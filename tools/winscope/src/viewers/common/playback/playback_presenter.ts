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

import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {Trace} from 'trace_api/trace';
import {EmitEvent} from 'messaging/winscope_event_emitter';
import {
  PlaybackStateChangeHandled,
  TracePositionUpdate,
} from 'messaging/winscope_event';
import {TracePosition} from 'trace_api/trace_position';
import {Timer} from 'common/time/timer';
import {TraceEntryEager} from 'trace_api/trace';
import {PlaybackState} from './playback_state';
import {MediaBasedTraceEntry} from 'trace_api/media_based_trace_entry';
import {findCorrespondingEntry} from 'trace_api/trace_entry_finder';
import {assertDefined} from 'common/assert';
import {CorrespondingEntries} from './corresponding_entries';
import {PropertyTreeNode} from 'tree_node/property_tree_node';
import {PropertiesProvider} from 'tree_node/properties_provider';
import {TraceRect} from 'tree_node/trace_rect';
import {CornerRadii} from 'common/geometry/corner_radii';
import {EntryHierarchyTreeFactory} from 'parsers/surface_flinger/entry_hierarchy_tree_factory';
import {TransformMatrix} from 'common/geometry/transform_matrix';
import {TraceProcessorFactory} from 'trace_processor/trace_processor_factory';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {ParserSurfaceFlinger} from 'parsers/surface_flinger/perfetto/parser_surface_flinger';
import {RawDataQueryResult} from 'trace_processor/query_result';

export class PlaybackPresenter {
  private entryIndex = 0;
  private entrySleepTime = 50;
  private buffer:
    | Array<TraceEntryEager<HierarchyTreeNode, HierarchyTreeNode | undefined>>
    | undefined = [];
  private readonly baseTime = 50;
  private emitWinscopeEvent: EmitEvent;
  private currPlaybackState: PlaybackState = PlaybackState.PAUSED;
  private correspondingEntriesMap = new Map<number, CorrespondingEntries>();
  private currentScreenRecording: Trace<MediaBasedTraceEntry> | undefined;
  private tp = TraceProcessorFactory.getSingleInstance();
  private traceGeometryData: TraceGeometryData | undefined;
  private trace: Trace<HierarchyTreeNode> | undefined;
  private playbackWorker: Worker;
  private workerPromiseResolver:
    | ((value: Array<HierarchyTreeNode | undefined>) => void)
    | null = null;
  private workerPromiseRejecter: ((reason?: any) => void) | null = null;

  constructor(emitWinscopeEvent: EmitEvent, trace: Trace<HierarchyTreeNode>) {
    this.emitWinscopeEvent = emitWinscopeEvent;
    this.trace = trace;
    this.playbackWorker = this.createPlaybackWorker();
  }

  setTraceGeometryData(traceGeometryData: TraceGeometryData) {
    this.traceGeometryData = traceGeometryData;
  }

  isPlaying() {
    return this.currPlaybackState !== PlaybackState.PAUSED;
  }

  async play(
    currentPosition: number,
    requestedState: PlaybackState,
    screenRecordingTrace: Trace<MediaBasedTraceEntry> | undefined,
  ) {
    if (!this.trace) {
      return;
    }
    const trees = await this.fetchTreesFromWorker(0, this.trace.lengthEntries);
    await this.buildCorrespondingEntriesMap(
      trees,
      this.trace,
      screenRecordingTrace,
    );
    this.entryIndex = currentPosition;
    this.currPlaybackState = requestedState;
    if (
      this.currPlaybackState === PlaybackState.BACKWARDS &&
      this.entryIndex === 0
    ) {
      // if the user's cursor position is at 0 and they want to reverse play through the trace
      // change the index to the end of tracecons
      this.entryIndex = this.correspondingEntriesMap.size - 1;
    }
    if (
      this.correspondingEntriesMap.size > 0 &&
      this.entryIndex < this.correspondingEntriesMap.size
    ) {
      await this.emitWinscopeEvent(
        new PlaybackStateChangeHandled(this.currPlaybackState, this.trace.type),
      );
      this.runPlaybackLoop();
    }
  }

  async changeSpeed(speedScale: number) {
    this.entrySleepTime = this.baseTime / speedScale;
  }

  async pause() {
    if (this.isPlaying()) {
      this.currPlaybackState = PlaybackState.PAUSED;
      await this.emitWinscopeEvent(
        new PlaybackStateChangeHandled(
          this.currPlaybackState,
          assertDefined(this.trace).type,
        ),
      );
    }
  }

  private async runPlaybackLoop() {
    const lastIndex = this.correspondingEntriesMap.size - 1;

    let nextIndex;
    let reachedEndOfTrace = false;
    let lastEntry:
      | TraceEntryEager<HierarchyTreeNode, HierarchyTreeNode | undefined>
      | undefined;

    while (this.currPlaybackState !== PlaybackState.PAUSED) {
      const currentIndex = this.entryIndex;
      if (this.correspondingEntriesMap.get(currentIndex) === undefined) {
        return;
      }
      const entryMap = assertDefined(
        this.correspondingEntriesMap.get(currentIndex),
      );

      const traceEntryToUse =
        entryMap.traceEntry === lastEntry || entryMap.traceEntry === undefined
          ? entryMap.screenRecordingEntry
          : entryMap.traceEntry;

      lastEntry = entryMap.traceEntry;

      if (traceEntryToUse) {
        await this.emitWinscopeEvent(
          new TracePositionUpdate(
            TracePosition.fromTraceEntry(traceEntryToUse),
            true,
          ),
        );
      }
      //we debounce the trace position updates to allow time for UI to render
      await new Timer(this.entrySleepTime, this.entrySleepTime).sleepMs();

      if (this.currPlaybackState === PlaybackState.BACKWARDS) {
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          reachedEndOfTrace = true;
          this.entryIndex = 0;
        } else {
          this.entryIndex = nextIndex;
        }
      } else {
        nextIndex = currentIndex + 1;
        if (nextIndex > lastIndex) {
          reachedEndOfTrace = true;
          this.entryIndex = lastIndex;
        } else {
          this.entryIndex = nextIndex;
        }
      }

      if (reachedEndOfTrace && this.entryIndex === currentIndex) {
        break;
      }
    }
    await this.pause();
  }

  private async buildCorrespondingEntriesMap(
    trees: Array<HierarchyTreeNode | undefined>,
    trace: Trace<HierarchyTreeNode>,
    screenRecordingTrace: Trace<MediaBasedTraceEntry> | undefined,
  ) {
    this.buffer = assertDefined(this.trace).createEagerEntriesFromValues(
      {start: 0, end: assertDefined(this.trace).lengthEntries},
      trees,
    );
    this.buffer.forEach((entry) => {
      const tree = entry.getValue();
      if (tree) {
        this.assignNodePrototypes(tree);
      }
    });
    if (!this.buffer) {
      return;
    }
    if (
      this.currentScreenRecording === screenRecordingTrace &&
      screenRecordingTrace !== undefined
    ) {
      return;
    }
    this.currentScreenRecording = screenRecordingTrace;
    let screenRecordingEntries:
      | Array<
          TraceEntryEager<
            MediaBasedTraceEntry,
            MediaBasedTraceEntry | undefined
          >
        >
      | undefined;
    let maximumEntryIndex: number;
    if (this.currentScreenRecording) {
      screenRecordingEntries =
        await this.currentScreenRecording.getRangeEntryValues({
          start: 0,
          end: this.currentScreenRecording.lengthEntries,
        });
      maximumEntryIndex = this.currentScreenRecording.lengthEntries;
    } else {
      maximumEntryIndex = trace.lengthEntries;
    }

    for (let entryIndex = 0; entryIndex < maximumEntryIndex; entryIndex++) {
      let correspondingEntries;

      if (screenRecordingEntries) {
        let eagerCorrespondingTraceEntry;

        const correspondingTraceEntry = findCorrespondingEntry(
          trace,
          TracePosition.fromTraceEntry(screenRecordingEntries[entryIndex]),
        );
        if (correspondingTraceEntry !== undefined) {
          eagerCorrespondingTraceEntry =
            this.buffer[correspondingTraceEntry.getIndex()];
        } else {
          eagerCorrespondingTraceEntry = undefined;
        }
        correspondingEntries = {
          screenRecordingEntry: screenRecordingEntries[entryIndex],
          traceEntry: eagerCorrespondingTraceEntry,
        };
      } else {
        correspondingEntries = {
          screenRecordingEntry: undefined,
          traceEntry: this.buffer[entryIndex],
        };
      }
      this.correspondingEntriesMap.set(entryIndex, correspondingEntries);
    }
  }

  private assignPropertyTreeNodePrototype(node: PropertyTreeNode) {
    Object.setPrototypeOf(node, PropertyTreeNode.prototype);
    node
      .getAllChildren()
      .forEach((child: PropertyTreeNode) =>
        this.assignPropertyTreeNodePrototype(child),
      );
  }

  private assignNodePrototypes(node: any) {
    this.assignPropertyTreeNodePrototype(
      node.propertiesProvider.eagerPropertiesRoot,
    );
    Object.setPrototypeOf(
      node.propertiesProvider,
      PropertiesProvider.prototype,
    );
    Object.setPrototypeOf(node, HierarchyTreeNode.prototype);
    node.rects?.forEach((rect: TraceRect) => {
      Object.setPrototypeOf(rect, TraceRect.prototype);
      Object.setPrototypeOf(rect.transform, TransformMatrix.prototype);
      if (rect?.cornerRadii) {
        Object.setPrototypeOf(rect.cornerRadii, CornerRadii.prototype);
      }
    });

    node.secondaryRects?.forEach((rect: TraceRect) => {
      Object.setPrototypeOf(rect, TraceRect.prototype);
      Object.setPrototypeOf(rect.transform, TransformMatrix.prototype);
      if (rect?.cornerRadii) {
        Object.setPrototypeOf(rect.cornerRadii, CornerRadii.prototype);
      }
    });

    if (node.isRoot()) {
      node.enableLazyPropertiesFetch(
        EntryHierarchyTreeFactory.makeEntryLazyPropertiesStrategy(),
        this.tp,
      );
    } else {
      node.enableLazyPropertiesFetch(
        EntryHierarchyTreeFactory.makeLayerLazyPropertiesStrategy(
          node.id.split(' ')[0],
          node.name,
          node.duplicateCount,
        ),
        this.tp,
      );
    }
    node
      .getAllChildren()
      .forEach((child: any) => this.assignNodePrototypes(child));
  }

  private createPlaybackWorker(): Worker {
    const worker = new Worker(new URL('./playback_worker', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent) => {
      const {trees} = event.data;

      try {
        if (this.workerPromiseResolver) {
          this.workerPromiseResolver(trees);
        }
      } catch (error) {
        if (this.workerPromiseRejecter) {
          this.workerPromiseRejecter(error);
        }
      } finally {
        this.workerPromiseResolver = null;
        this.workerPromiseRejecter = null;
      }
    };

    worker.onerror = () => {
      if (this.workerPromiseRejecter) {
        this.workerPromiseRejecter(new Error('Web Worker failed'));
        this.workerPromiseResolver = null;
        this.workerPromiseRejecter = null;
      }
    };

    return worker;
  }

  private async fetchTreesFromWorker(
    start: number,
    end: number,
  ): Promise<Array<HierarchyTreeNode | undefined>> {
    return assertDefined(this.trace)
      .getQueryResults({start, end}, true)
      .then((queryResults) => {
        return new Promise<Array<HierarchyTreeNode | undefined>>(
          (resolve, reject) => {
            this.workerPromiseResolver = resolve as (
              value: Array<HierarchyTreeNode | undefined>,
            ) => void;
            this.workerPromiseRejecter = reject;

            const snapshotResults = queryResults.snapshotRange;
            const layersResults = queryResults.layersRange;

            if (
              !(
                snapshotResults instanceof RawDataQueryResult &&
                layersResults instanceof RawDataQueryResult
              )
            ) {
              return;
            }

            const snapshotBatches = snapshotResults.batches;
            const layerBatches = layersResults.batches;
            const parser = assertDefined(this.trace).getParser();
            let map;
            if (parser instanceof ParserSurfaceFlinger) {
              map = parser.getSfRectsMap();
            }

            this.playbackWorker.postMessage({
              start,
              end,
              snapshotBatches,
              layerBatches,
              type: assertDefined(this.trace).type,
              traceGeometryData: this.traceGeometryData,
              visibleRectsMap: map,
            });
          },
        );
      });
  }
}

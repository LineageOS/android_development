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
import {Trace, TraceEntry} from 'trace_api/trace';
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
import {CorrespondingEntries} from './corresponding_entries';
import {PropertyTreeNode} from 'tree_node/property_tree_node';
import {PropertiesProvider} from 'tree_node/properties_provider';
import {TraceRect} from 'tree_node/trace_rect';
import {CornerRadii} from 'common/geometry/corner_radii';
import {TransformMatrix} from 'common/geometry/transform_matrix';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {RawDataQueryResult} from 'trace_processor/raw_data_query_result';

type EagerTraceEntry<T = HierarchyTreeNode> = TraceEntryEager<T, T | undefined>;

export class PlaybackPresenter {
  private readonly chunkSize = 150;
  private readonly baseTime = 50;

  private entryIndex = 0;
  private entrySleepTime = 50;
  private emitWinscopeEvent: EmitEvent;
  private currPlaybackState: PlaybackState = PlaybackState.PAUSED;
  private currentScreenRecording: Trace<MediaBasedTraceEntry> | undefined;
  private traceGeometryData: TraceGeometryData | undefined;
  private trace: Trace<HierarchyTreeNode>;
  private playbackWorker: Worker;
  private workerPromiseResolver:
    | ((value: Array<HierarchyTreeNode | undefined>) => void)
    | undefined = undefined;
  private workerPromiseRejecter: ((reason?: any) => void) | undefined =
    undefined;
  private activeBuffer: CorrespondingEntries[] = [];
  private pendingBuffer: CorrespondingEntries[] = [];
  private fetchPendingBuffer: Promise<void> | undefined = undefined;
  private workerBufferStartIndex = 0;
  private isFetching = false;
  private nextChunkTraceStartIndex = 0;
  private totalEntries = 0;
  private activeBufferStartIndex = 0;
  private allScreenRecordingEntries:
    | Array<EagerTraceEntry<MediaBasedTraceEntry>>
    | undefined;

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
    const traceForLengthCheck = screenRecordingTrace ?? this.trace;
    if (
      !traceForLengthCheck ||
      !this.trace ||
      currentPosition >= traceForLengthCheck.lengthEntries
    ) {
      return;
    }

    const screenRecordingHasChanged =
      this.currentScreenRecording !== screenRecordingTrace;
    if (!screenRecordingHasChanged && this.activeBuffer.length > 0) {
      const targetIndex =
        requestedState === PlaybackState.BACKWARDS && currentPosition === 0
          ? this.totalEntries - 1
          : currentPosition;

      if (
        targetIndex >= this.activeBufferStartIndex &&
        targetIndex < this.activeBufferStartIndex + this.chunkSize
      ) {
        this.currPlaybackState = requestedState;
        this.entryIndex = targetIndex;
        await this.emitWinscopeEvent(
          new PlaybackStateChangeHandled(
            this.currPlaybackState,
            this.trace.type,
          ),
        );
        this.runPlaybackLoop();
        return;
      }
    }

    this.currentScreenRecording = screenRecordingTrace;
    if (this.currentScreenRecording) {
      this.totalEntries = this.currentScreenRecording.lengthEntries;
      this.allScreenRecordingEntries =
        await this.currentScreenRecording.getRangeEntryValues({
          start: 0,
          end: this.totalEntries,
        });
    } else {
      this.totalEntries = this.trace.lengthEntries;
      this.allScreenRecordingEntries = undefined;
    }

    this.currPlaybackState = requestedState;
    this.entryIndex =
      requestedState === PlaybackState.BACKWARDS && currentPosition === 0
        ? this.totalEntries - 1
        : currentPosition;

    const startChunk = Math.floor(this.entryIndex / this.chunkSize);
    this.activeBufferStartIndex = startChunk * this.chunkSize;
    const end = Math.min(
      this.activeBufferStartIndex + this.chunkSize,
      this.totalEntries,
    );
    this.activeBuffer = await this.processTraceChunk(
      this.activeBufferStartIndex,
      end,
    );

    this.nextChunkTraceStartIndex = end;
    this.manageNextPendingBufferFetch();

    if (this.activeBuffer.length > 0) {
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
    if (!this.isPlaying()) {
      return;
    }

    this.currPlaybackState = PlaybackState.PAUSED;
    await this.emitWinscopeEvent(
      new PlaybackStateChangeHandled(this.currPlaybackState, this.trace.type),
    );

    let finalEntryForPositionUpdate:
      | EagerTraceEntry<MediaBasedTraceEntry>
      | TraceEntry<HierarchyTreeNode>;
    if (this.allScreenRecordingEntries) {
      finalEntryForPositionUpdate =
        this.allScreenRecordingEntries[this.entryIndex];
    } else {
      finalEntryForPositionUpdate = this.trace.getEntry(this.entryIndex);
    }

    if (finalEntryForPositionUpdate) {
      await this.emitWinscopeEvent(
        new TracePositionUpdate(
          TracePosition.fromTraceEntry(finalEntryForPositionUpdate),
          true,
        ),
      );
    }
  }

  private async runPlaybackLoop() {
    let lastEntry: EagerTraceEntry<HierarchyTreeNode> | undefined;

    while (this.currPlaybackState !== PlaybackState.PAUSED) {
      const bufferIndex = this.entryIndex - this.activeBufferStartIndex;

      if (
        this.currPlaybackState === PlaybackState.FORWARDS &&
        bufferIndex >= this.activeBuffer.length
      ) {
        await this.swapBuffers();
        if (this.activeBuffer.length === 0) break;
        continue;
      }

      if (
        this.currPlaybackState === PlaybackState.BACKWARDS &&
        bufferIndex < 0
      ) {
        const prevChunkStart = this.activeBufferStartIndex - this.chunkSize;
        if (prevChunkStart < 0) break;

        this.activeBuffer = await this.processTraceChunk(
          prevChunkStart,
          this.activeBufferStartIndex,
        );
        this.activeBufferStartIndex = prevChunkStart;
        continue;
      }

      const correspondingEntry = this.activeBuffer[bufferIndex];

      const traceEntryValue = correspondingEntry?.traceEntry?.getValue();
      if (traceEntryValue) {
        this.assignNodePrototypes(traceEntryValue);
      }

      const traceEntryToUse =
        correspondingEntry.traceEntry === lastEntry ||
        correspondingEntry.traceEntry === undefined
          ? correspondingEntry.screenRecordingEntry
          : correspondingEntry.traceEntry;

      lastEntry = correspondingEntry.traceEntry;

      if (traceEntryToUse) {
        await this.emitWinscopeEvent(
          new TracePositionUpdate(
            TracePosition.fromTraceEntry(traceEntryToUse),
            true,
          ),
        );
      }

      await new Timer(this.entrySleepTime, this.entrySleepTime).sleepMs();

      const nextIndex =
        this.currPlaybackState === PlaybackState.BACKWARDS
          ? this.entryIndex - 1
          : this.entryIndex + 1;

      if (nextIndex < 0 || nextIndex >= this.totalEntries) {
        break;
      }
      this.entryIndex = nextIndex;
    }
    await this.pause();
  }

  private async swapBuffers() {
    if (this.fetchPendingBuffer) {
      await this.fetchPendingBuffer;
    }

    this.activeBuffer = this.pendingBuffer;
    this.activeBufferStartIndex = this.workerBufferStartIndex;
    this.pendingBuffer = [];
    this.fetchPendingBuffer = undefined;

    this.manageNextPendingBufferFetch();
  }

  private manageNextPendingBufferFetch() {
    if (this.isFetching || this.nextChunkTraceStartIndex >= this.totalEntries) {
      return;
    }

    this.isFetching = true;
    const start = this.nextChunkTraceStartIndex;
    this.workerBufferStartIndex = start;
    const end = Math.min(start + this.chunkSize, this.totalEntries);

    this.fetchPendingBuffer = this.processTraceChunk(start, end)
      .then((processedChunk) => {
        this.pendingBuffer = processedChunk;
        this.nextChunkTraceStartIndex = end;
      })
      .finally(() => {
        this.isFetching = false;
      });
  }

  private async processTraceChunk(
    start: number,
    end: number,
  ): Promise<CorrespondingEntries[]> {
    if (start >= end) {
      return [];
    }

    const sfRangeToFetch = {
      start,
      end: Math.min(end, this.trace.lengthEntries),
    };

    if (
      sfRangeToFetch.start >= sfRangeToFetch.end &&
      this.trace.lengthEntries > 0
    ) {
      sfRangeToFetch.start = this.trace.lengthEntries - 1;
      sfRangeToFetch.end = this.trace.lengthEntries;
    }

    const trees = await this.fetchTreesFromWorker(
      sfRangeToFetch.start,
      sfRangeToFetch.end,
    );

    const chunkEagerTraceEntries = this.trace.createEagerEntriesFromValues(
      sfRangeToFetch,
      trees,
    );

    const chunkTraceEntryMap = new Map<
      number,
      TraceEntryEager<HierarchyTreeNode, HierarchyTreeNode | undefined>
    >();
    chunkEagerTraceEntries.forEach((entry) =>
      chunkTraceEntryMap.set(entry.getIndex(), entry),
    );

    const chunkCorrespondingEntries: CorrespondingEntries[] = [];
    for (let index = start; index < end; index++) {
      let correspondingEntries: CorrespondingEntries;

      if (this.allScreenRecordingEntries) {
        const screenRecordingEntry = this.allScreenRecordingEntries[index];
        const correspondingLazyTraceEntry = findCorrespondingEntry(
          this.trace,
          TracePosition.fromTraceEntry(screenRecordingEntry),
        );

        let eagerCorrespondingTraceEntry:
          | EagerTraceEntry<HierarchyTreeNode>
          | undefined;
        if (correspondingLazyTraceEntry) {
          eagerCorrespondingTraceEntry = chunkTraceEntryMap.get(
            correspondingLazyTraceEntry.getIndex(),
          );
        }
        correspondingEntries = {
          screenRecordingEntry,
          traceEntry: eagerCorrespondingTraceEntry,
        };
      } else {
        correspondingEntries = {
          screenRecordingEntry: undefined,
          traceEntry: chunkEagerTraceEntries[index - start],
        };
      }
      chunkCorrespondingEntries.push(correspondingEntries);
    }
    return chunkCorrespondingEntries;
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
      Object.setPrototypeOf(rect.transform, TransformMatrix.prototype);
      if (rect?.cornerRadii) {
        Object.setPrototypeOf(rect.cornerRadii, CornerRadii.prototype);
      }
    });

    node.secondaryRects?.forEach((rect: TraceRect) => {
      Object.setPrototypeOf(rect.transform, TransformMatrix.prototype);
      if (rect?.cornerRadii) {
        Object.setPrototypeOf(rect.cornerRadii, CornerRadii.prototype);
      }
    });
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
        this.workerPromiseResolver = undefined;
        this.workerPromiseRejecter = undefined;
      }
    };

    worker.onerror = (error) => {
      if (this.workerPromiseRejecter) {
        this.workerPromiseRejecter(
          new Error(`Playback worker failed: ${error.message}`),
        );
        this.workerPromiseResolver = undefined;
        this.workerPromiseRejecter = undefined;
      }
    };

    return worker;
  }

  private async fetchTreesFromWorker(
    start: number,
    end: number,
  ): Promise<Array<HierarchyTreeNode | undefined>> {
    return this.trace
      .getQueryResults({start, end}, true)
      .then((queryResults) => {
        return new Promise<Array<HierarchyTreeNode | undefined>>(
          (resolve, reject) => {
            this.workerPromiseResolver = resolve as (
              value: Array<HierarchyTreeNode | undefined>,
            ) => void;
            this.workerPromiseRejecter = reject;

            const snapshotResults = queryResults.snapshotRange;
            const nodesResults = queryResults.nodeRange;

            if (!(nodesResults instanceof RawDataQueryResult)) {
              return;
            }

            let snapshotBatches: Uint8Array[] | undefined;
            if (
              snapshotResults !== undefined &&
              snapshotResults instanceof RawDataQueryResult
            ) {
              snapshotBatches = snapshotResults.batches;
            }
            const nodeBatches = nodesResults.batches;
            const parser = this.trace.getParser();
            if (parser.getRectsMap === undefined) {
              throw Error(
                'Playback is only implemented for parsers with rects map',
              );
            }
            const map = parser.getRectsMap();

            this.playbackWorker.postMessage({
              start,
              end,
              snapshotBatches,
              nodeBatches,
              type: this.trace.type,
              traceGeometryData: this.traceGeometryData,
              visibleRectsMap: map,
            });
          },
        );
      });
  }
}

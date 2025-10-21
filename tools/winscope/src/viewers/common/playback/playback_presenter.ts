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
import {EntriesRange} from 'trace_api/index_types';

type EagerTraceEntry<T = HierarchyTreeNode> = TraceEntryEager<T, T>;
type WorkerResolve = (value: HierarchyTreeNode[]) => void;
type WorkerReject = ((reason?: any) => void) | undefined;

export class PlaybackPresenter {
  private readonly traceChunkSize = 150;
  private readonly baseTime = 50;
  private readonly emitWinscopeEvent: EmitEvent;
  private readonly trace: Trace<HierarchyTreeNode>;
  private readonly playbackWorker: Worker;

  private entrySleepTime = 50;
  private currState: PlaybackState = PlaybackState.PAUSED;
  private traceGeometryData: TraceGeometryData | undefined;

  private currentSr: Trace<MediaBasedTraceEntry> | undefined;
  private allScreenRecordingEntries:
    | Array<EagerTraceEntry<MediaBasedTraceEntry>>
    | undefined;

  private activeBuffer: CorrespondingEntries[] = [];
  private pendingBuffer: CorrespondingEntries[] = [];
  private workerPromiseResolve: WorkerResolve | undefined;
  private workerPromiseReject: WorkerReject | undefined;
  private fetchPendingBufferPromise: Promise<void> | undefined;
  private workerBufferStartIndex = 0;
  private isFetching = false;
  private nextChunkTraceStartIndex = 0;
  private totalEntries = 0;
  private entryIndex = 0;
  private activeBufferStartIndex = 0;

  constructor(emitWinscopeEvent: EmitEvent, trace: Trace<HierarchyTreeNode>) {
    this.emitWinscopeEvent = emitWinscopeEvent;
    this.trace = trace;
    this.playbackWorker = this.createPlaybackWorker();
  }

  setTraceGeometryData(traceGeometryData: TraceGeometryData) {
    this.traceGeometryData = traceGeometryData;
  }

  isPlaying() {
    return this.currState !== PlaybackState.PAUSED;
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

    const screenRecordingHasChanged = this.currentSr !== screenRecordingTrace;
    if (!screenRecordingHasChanged && this.activeBuffer.length > 0) {
      const targetIndex =
        requestedState === PlaybackState.BACKWARDS && currentPosition === 0
          ? this.totalEntries - 1
          : currentPosition;

      if (
        targetIndex >= this.activeBufferStartIndex &&
        targetIndex < this.activeBufferStartIndex + this.traceChunkSize
      ) {
        this.currState = requestedState;
        this.entryIndex = targetIndex;
        await this.emitWinscopeEvent(
          new PlaybackStateChangeHandled(this.currState, this.trace.type),
        );
        this.runPlaybackLoop();
        return;
      }
    }

    this.currentSr = screenRecordingTrace;
    if (this.currentSr) {
      this.totalEntries = this.currentSr.lengthEntries;
      this.allScreenRecordingEntries = await this.currentSr.getRangeEntryValues(
        {
          start: 0,
          end: this.totalEntries,
        },
      );
    } else {
      this.totalEntries = this.trace.lengthEntries;
      this.allScreenRecordingEntries = undefined;
    }

    this.currState = requestedState;
    this.entryIndex =
      requestedState === PlaybackState.BACKWARDS && currentPosition === 0
        ? this.totalEntries - 1
        : currentPosition;

    const startChunk = Math.floor(this.entryIndex / this.traceChunkSize);
    this.activeBufferStartIndex = startChunk * this.traceChunkSize;
    const end = Math.min(
      this.activeBufferStartIndex + this.traceChunkSize,
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
        new PlaybackStateChangeHandled(this.currState, this.trace.type),
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

    this.currState = PlaybackState.PAUSED;
    await this.emitWinscopeEvent(
      new PlaybackStateChangeHandled(this.currState, this.trace.type),
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

    while (this.currState !== PlaybackState.PAUSED) {
      const bufferIndex = this.entryIndex - this.activeBufferStartIndex;

      if (
        this.currState === PlaybackState.FORWARDS &&
        bufferIndex >= this.activeBuffer.length
      ) {
        await this.swapBuffers();
        if (this.activeBuffer.length === 0) break;
        continue;
      }

      if (this.currState === PlaybackState.BACKWARDS && bufferIndex < 0) {
        const prevChunkStart =
          this.activeBufferStartIndex - this.traceChunkSize;
        if (prevChunkStart < 0) break;

        this.activeBuffer = await this.processTraceChunk(
          prevChunkStart,
          this.activeBufferStartIndex,
        );
        this.activeBufferStartIndex = prevChunkStart;
        continue;
      }

      const correspondingEntry = this.activeBuffer[bufferIndex];

      const traceEntryValue = correspondingEntry?.trace?.getValue();
      if (traceEntryValue) {
        this.assignNodePrototypes(traceEntryValue);
      }

      const traceEntryToUse =
        correspondingEntry.trace === lastEntry ||
        correspondingEntry.trace === undefined
          ? correspondingEntry.screenRecording
          : correspondingEntry.trace;

      lastEntry = correspondingEntry.trace;

      if (traceEntryToUse) {
        let eagerEntry:
          | TraceEntryEager<HierarchyTreeNode, HierarchyTreeNode>
          | undefined;
        if (correspondingEntry.trace) {
          eagerEntry = correspondingEntry.trace;
        }

        await this.emitWinscopeEvent(
          new TracePositionUpdate(
            TracePosition.fromTraceEntry(traceEntryToUse),
            true,
            eagerEntry,
          ),
        );
      }

      await new Timer(this.entrySleepTime, this.entrySleepTime).sleepMs();

      const nextIndex =
        this.currState === PlaybackState.BACKWARDS
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
    if (this.fetchPendingBufferPromise) {
      await this.fetchPendingBufferPromise;
    }

    this.activeBuffer = this.pendingBuffer;
    this.activeBufferStartIndex = this.workerBufferStartIndex;
    this.pendingBuffer = [];
    this.fetchPendingBufferPromise = undefined;

    this.manageNextPendingBufferFetch();
  }

  private manageNextPendingBufferFetch() {
    if (this.isFetching || this.nextChunkTraceStartIndex >= this.totalEntries) {
      return;
    }

    this.isFetching = true;
    const start = this.nextChunkTraceStartIndex;
    this.workerBufferStartIndex = start;
    const end = Math.min(start + this.traceChunkSize, this.totalEntries);

    this.fetchPendingBufferPromise = this.processTraceChunk(start, end)
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

    const trees = await this.fetchTreesFromWorker(sfRangeToFetch);

    const chunkEagerTraceEntries = this.trace.createEagerEntriesFromValues(
      sfRangeToFetch,
      trees,
    );

    const chunkTraceEntryMap = new Map<
      number,
      TraceEntryEager<HierarchyTreeNode, HierarchyTreeNode>
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
          screenRecording: screenRecordingEntry,
          trace: eagerCorrespondingTraceEntry,
        };
      } else {
        correspondingEntries = {
          screenRecording: undefined,
          trace: chunkEagerTraceEntries[index - start],
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
        this.workerPromiseResolve?.(trees);
      } catch (error) {
        this.workerPromiseReject?.(error);
      } finally {
        this.workerPromiseResolve = undefined;
        this.workerPromiseReject = undefined;
      }
    };

    worker.onerror = (error) => {
      this.workerPromiseReject?.(
        new Error(`Playback worker failed: ${error.message}`),
      );
      this.workerPromiseResolve = undefined;
      this.workerPromiseReject = undefined;
    };

    return worker;
  }

  private async fetchTreesFromWorker(
    traceRangeToFetch: EntriesRange,
  ): Promise<HierarchyTreeNode[]> {
    const queryResults = await this.trace.getQueryResults(
      traceRangeToFetch,
      true,
    );

    if (!(queryResults.nodeRange instanceof RawDataQueryResult)) {
      return [];
    }
    const nodeBatches = queryResults.nodeRange.batches;

    let snapshotBatches: Uint8Array[] | undefined;
    if (queryResults.snapshotRange instanceof RawDataQueryResult) {
      snapshotBatches = queryResults.snapshotRange.batches;
    }

    const parser = this.trace.getParser();
    if (parser.getRectsMap === undefined) {
      throw Error('Playback is only implemented for parsers with rects map');
    }
    const map = await parser.getRectsMap();

    return new Promise<HierarchyTreeNode[]>((resolve, reject) => {
      this.workerPromiseResolve = resolve;
      this.workerPromiseReject = reject;

      this.playbackWorker.postMessage({
        start: traceRangeToFetch.start,
        end: traceRangeToFetch.end,
        snapshotBatches,
        nodeBatches,
        type: this.trace.type,
        traceGeometryData: this.traceGeometryData,
        visibleRectsMap: map,
      });
    });
  }
}

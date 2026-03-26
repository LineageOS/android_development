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

import {assertDefined, assertTrue} from '@common/assert';
import {CornerRadii} from '@common/geometry/corner_radii';
import {TransformMatrix} from '@common/geometry/transform_matrix';
import {Timer} from '@common/time/timer';
import {EmitEvent} from '@messaging/winscope_event_emitter';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {EntriesRange} from '@trace_api/index_types';
import {PlaybackPrefetchedEntries} from '@trace_api/playback_prefetched_entries';
import {CustomTraceEntryLazy, Trace, TraceEntry} from '@trace_api/trace';
import {findCorrespondingEntry} from '@trace_api/trace_entry_finder';
import {TracePositionUpdate} from '@trace_api/trace_events';
import {TracePosition} from '@trace_api/trace_position';
import {RawDataQueryResult} from '@trace_processor/raw_data_query_result';
import {CanvasEntry, MediaBasedTraceEntry,} from '@trace/media_based/media_based_trace_entry';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertiesProvider} from '@tree_node/properties_provider';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {TraceRect} from '@tree_node/trace_rect';

import {PlaybackStateChangeHandled} from './events';
import {PlaybackState} from './playback_state';
import {VideoFrameCache} from './video_frame_cache';
import {createVideoFrameCache} from './video_frame_cache_factory';

type WorkerResolve = (value: HierarchyTreeNode[]) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WorkerReject = ((reason?: any) => void) | undefined;
type CreateVideoFrameCacheStrategy = (
  videoData: Uint8Array,
) => Promise<VideoFrameCache>;

export class PlaybackPresenter {
  private readonly traceChunkSize = 50;
  private readonly baseTime = 50;
  private readonly emitWinscopeEvent: EmitEvent;
  private readonly trace: Trace<HierarchyTreeNode>;
  private readonly worker: Worker;
  private readonly createVideoFrameCacheStrategy: CreateVideoFrameCacheStrategy;

  private entrySleepTime = 50;
  private currState: PlaybackState = PlaybackState.PAUSED;
  private traceGeometryData: TraceGeometryData | undefined;
  private lastEntryUpdated:
    | TraceEntry<HierarchyTreeNode, HierarchyTreeNode>
    | TraceEntry<MediaBasedTraceEntry, Promise<CanvasEntry>>
    | undefined;
  private currentSr: Trace<MediaBasedTraceEntry> | undefined;
  private videoFrameCache: VideoFrameCache | undefined;

  private activeBuffer: PlaybackPrefetchedEntries[] = [];
  private pendingBuffer: PlaybackPrefetchedEntries[] = [];
  private workerPromiseResolve: WorkerResolve | undefined;
  private workerPromiseReject: WorkerReject | undefined;
  private fetchPendingBufferPromise: Promise<void> | undefined;
  private pendingBufferFirstEntry: number | undefined;
  private activeBufferFirstEntry: number | undefined;

  constructor(
    emitWinscopeEvent: EmitEvent,
    trace: Trace<HierarchyTreeNode>,
    createVideoFrameCacheStrategy: CreateVideoFrameCacheStrategy = createVideoFrameCache,
  ) {
    this.emitWinscopeEvent = emitWinscopeEvent;
    this.trace = trace;
    this.worker = this.createWorker();
    this.createVideoFrameCacheStrategy = createVideoFrameCacheStrategy;
  }

  setTraceGeometryData(traceGeometryData: TraceGeometryData) {
    this.traceGeometryData = traceGeometryData;
  }

  isPlaying() {
    return this.currState !== PlaybackState.PAUSED;
  }

  onDestroy() {
    this.worker.terminate();
    this.videoFrameCache?.onDestroy();
  }

  async play(
    currentTraceIndex: number,
    requestedState: PlaybackState,
    srTrace: Trace<MediaBasedTraceEntry> | undefined,
  ) {
    if (this.isPlaying()) {
      // ensure state and buffer fetches cleared before starting
      // playback in the other direction
      await this.pause(false);
    }
    if (currentTraceIndex >= this.trace.lengthEntries) {
      return;
    }

    const srChanged = this.currentSr !== srTrace;

    // if we request to play backwards from the first trace index, wrap
    // around to end of trace
    const targetEntryIndex =
      requestedState === PlaybackState.BACKWARDS && currentTraceIndex === 0
        ? this.trace.lengthEntries - 1
        : currentTraceIndex;

    if (!srChanged && this.activeBuffer.length > 0) {
      const success = await this.tryPlayFromTargetEntry(
        targetEntryIndex,
        requestedState,
      );
      if (success) {
        return;
      }
    }

    if (srChanged) {
      await this.updateScreenRecording(srTrace);
    }
    this.activeBuffer = await this.fetchActiveBufferForTarget(targetEntryIndex);
    if (this.activeBuffer.length === 0) {
      return;
    }
    await this.tryPlayFromTargetEntry(targetEntryIndex, requestedState);
  }

  private async fetchActiveBufferForTarget(targetEntryIndex: number) {
    const bufferEntryStart =
      Math.floor(targetEntryIndex / this.traceChunkSize) * this.traceChunkSize;

    this.activeBufferFirstEntry = bufferEntryStart;
    const end = Math.min(
      this.activeBufferFirstEntry + this.traceChunkSize,
      this.trace.lengthEntries,
    );

    return await this.processTraceChunk({
      start: this.activeBufferFirstEntry,
      end,
    });
  }

  async changeSpeed(speedScale: number) {
    this.entrySleepTime = this.baseTime / speedScale;
  }

  async pause(emitHandledEvent = true) {
    if (!this.isPlaying()) {
      return;
    }

    this.currState = PlaybackState.PAUSED;
    this.fetchPendingBufferPromise = undefined;

    if (emitHandledEvent) {
      await this.emitWinscopeEvent(
        new PlaybackStateChangeHandled(this.currState, this.trace.type),
      );
    }

    if (!this.lastEntryUpdated) {
      return;
    }

    // emit the last update again without the prefetched entry, so the viewer
    // repopulates the component with a HierarchyTreeNode that has lazy properties
    const lastEntryIndex = this.lastEntryUpdated.getIndex();
    const lazyEntry =
      this.lastEntryUpdated.getFullTrace() === this.currentSr
        ? this.currentSr.getEntry(lastEntryIndex)
        : this.trace.getEntry(lastEntryIndex);

    await this.emitWinscopeEvent(
      new TracePositionUpdate(TracePosition.fromTraceEntry(lazyEntry), true),
    );
  }

  private async updateScreenRecording(
    srTrace: Trace<MediaBasedTraceEntry> | undefined,
  ) {
    this.currentSr = srTrace;
    this.videoFrameCache?.onDestroy();
    if (!srTrace) {
      this.videoFrameCache = undefined;
      return;
    }
    const blob = assertDefined(
      (await srTrace.getEntry(0).getValue())?.frameData,
    );
    const videoData = new Uint8Array(await blob.arrayBuffer());
    this.videoFrameCache = await this.createVideoFrameCacheStrategy(videoData);
  }

  private async tryPlayFromTargetEntry(
    target: number,
    requestedState: PlaybackState,
  ): Promise<boolean> {
    const start = this.activeBufferFirstEntry ?? 0;
    const end = Math.min(this.trace.lengthEntries, start + this.traceChunkSize);
    if (target < start || target >= end) {
      return false;
    }

    let bufferIndex = this.activeBuffer.findIndex((bufferEntry) => {
      return target === bufferEntry.trace?.getIndex();
    });
    assertTrue(bufferIndex !== -1);

    if (requestedState === PlaybackState.FORWARDS) {
      while (bufferIndex > 0) {
        const prevBufferEntry = this.activeBuffer[bufferIndex - 1];
        if (
          prevBufferEntry.trace &&
          prevBufferEntry.trace.getIndex() !== target
        ) {
          break;
        }
        if (start !== 0 && prevBufferEntry.trace === undefined) {
          break;
        }
        bufferIndex--;
      }
    } else {
      while (bufferIndex < this.activeBuffer.length - 1) {
        const nextBufferEntry = this.activeBuffer[bufferIndex + 1];
        if (
          nextBufferEntry.trace &&
          nextBufferEntry.trace.getIndex() !== target
        ) {
          break;
        }
        bufferIndex++;
      }
    }

    this.currState = requestedState;
    await this.emitWinscopeEvent(
      new PlaybackStateChangeHandled(this.currState, this.trace.type),
    );

    this.tryStartPendingBufferFetch();
    void this.startPlay(bufferIndex);
    return true;
  }

  private async startPlay(bufferIndex: number) {
    while (this.currState !== PlaybackState.PAUSED) {
      const isBufferSwapNeeded =
        (this.currState === PlaybackState.FORWARDS &&
          bufferIndex >= this.activeBuffer.length) ||
        (this.currState === PlaybackState.BACKWARDS && bufferIndex < 0);

      if (isBufferSwapNeeded) {
        await this.swapBuffers();
        if (this.activeBuffer.length === 0) {
          break;
        }
        bufferIndex =
          this.currState === PlaybackState.FORWARDS
            ? 0
            : this.activeBuffer.length - 1;
        continue;
      }

      const bufferEntry = this.activeBuffer[bufferIndex];
      const traceEntryValue = bufferEntry.trace?.getValue();
      if (traceEntryValue) {
        this.assignNodePrototypes(traceEntryValue);
      }
      const entryForPosition = assertDefined(
        bufferEntry.screenRecording ?? bufferEntry.trace,
      );

      if (this.currState === PlaybackState.FORWARDS) {
        this.lastEntryUpdated = entryForPosition;
      } else {
        if (this.lastEntryUpdated === entryForPosition) {
          this.lastEntryUpdated =
            bufferEntry.trace ?? bufferEntry.screenRecording;
        } else {
          this.lastEntryUpdated = entryForPosition;
        }
      }

      await this.emitWinscopeEvent(
        new TracePositionUpdate(
          TracePosition.fromTraceEntry(entryForPosition),
          true,
          bufferEntry,
        ),
      );

      await new Timer(undefined, this.entrySleepTime).sleepMs();

      if (this.currState === PlaybackState.BACKWARDS) {
        bufferIndex--;
      } else {
        bufferIndex++;
      }
    }
    await this.pause();
  }

  private async swapBuffers() {
    await this.fetchPendingBufferPromise;
    this.activeBuffer = this.pendingBuffer;
    this.activeBufferFirstEntry = this.pendingBufferFirstEntry;
    this.pendingBufferFirstEntry = undefined;
    this.pendingBuffer = [];
    this.fetchPendingBufferPromise = undefined;
    this.tryStartPendingBufferFetch();
  }

  private getNextBufferStartIndex(): number | undefined {
    if (!this.isPlaying()) {
      return undefined;
    }
    const start = this.activeBufferFirstEntry ?? 0;
    const range = {
      start,
      end: Math.min(this.trace.lengthEntries, start + this.traceChunkSize),
    };
    if (this.currState === PlaybackState.FORWARDS) {
      return range.end === this.trace.lengthEntries ? undefined : range.end;
    }
    const prevBufferStart = range.start - this.traceChunkSize;
    return prevBufferStart < 0 ? undefined : prevBufferStart;
  }

  private tryStartPendingBufferFetch() {
    if (this.fetchPendingBufferPromise) {
      return;
    }
    this.pendingBuffer = [];
    const nextBufferStartIndex = this.getNextBufferStartIndex();
    if (nextBufferStartIndex === undefined) {
      return;
    }
    this.pendingBufferFirstEntry = nextBufferStartIndex;
    this.fetchPendingBufferPromise = this.processTraceChunk({
      start: nextBufferStartIndex,
      end: Math.min(
        nextBufferStartIndex + this.traceChunkSize,
        this.trace.lengthEntries,
      ),
    }).then((processedChunk) => {
      this.pendingBuffer = processedChunk;
    });
  }

  private async processTraceChunk(
    traceRange: EntriesRange,
  ): Promise<PlaybackPrefetchedEntries[]> {
    if (traceRange.start >= traceRange.end) {
      return [];
    }

    // fetch trace entry values for this chunk
    const trees = await this.fetchTreesFromWorker(traceRange);
    if (trees.length !== traceRange.end - traceRange.start) {
      return [];
    }
    const chunkEagerTraceEntries = this.trace.createEagerEntriesFromValues(
      traceRange,
      trees,
    );

    const bufferEntries: PlaybackPrefetchedEntries[] = [];

    for (const traceEntry of chunkEagerTraceEntries) {
      if (!this.currentSr) {
        bufferEntries.push({
          screenRecording: undefined,
          trace: traceEntry,
          seek: traceEntry.getTimestamp(),
        });
        continue;
      }

      const correspondingSrEntry = findCorrespondingEntry(
        this.currentSr,
        TracePosition.fromTraceEntry(traceEntry),
      );

      if (!correspondingSrEntry) {
        bufferEntries.push({
          screenRecording: undefined,
          trace: traceEntry,
          seek: traceEntry.getTimestamp(),
        });
        continue;
      }

      // add the screen recording entries in between the last SF frame and
      // current SF frame
      const newSrIndex = correspondingSrEntry.getIndex();
      let lastSrIndex = bufferEntries
        .at(bufferEntries.length - 1)
        ?.screenRecording?.getIndex();

      if (
        lastSrIndex !== undefined ||
        traceEntry.getIndex() === traceRange.start
      ) {
        if (lastSrIndex === undefined && traceEntry.getIndex() !== 0) {
          // find the last sr index from the previous buffer
          lastSrIndex = findCorrespondingEntry(
            this.currentSr,
            TracePosition.fromTraceEntry(
              this.trace.getEntry(traceRange.start - 1),
            ),
          )?.getIndex();
        } else if (traceEntry.getIndex() === 0) {
          // if there has been no previous sr index, add all from the start
          lastSrIndex = lastSrIndex ?? -1;
        }

        if (lastSrIndex !== undefined) {
          for (let j = lastSrIndex + 1; j < newSrIndex; j++) {
            const srEntry = this.makeSrEntry(j);

            bufferEntries.push({
              screenRecording: srEntry,
              trace: traceEntry.getIndex() === 0 ? undefined : traceEntry,
              seek: srEntry.getTimestamp(),
            });
          }
        }
      }

      const srEntry = this.makeSrEntry(newSrIndex);
      bufferEntries.push({
        screenRecording: srEntry,
        trace: traceEntry,
        seek: traceEntry.getTimestamp(),
      });
    }

    // add the screen recording entries still remaining after the last SF frame
    const lastEntries = bufferEntries[bufferEntries.length - 1];
    const lastSrEntry = lastEntries?.screenRecording;
    if (
      traceRange.end === this.trace.lengthEntries &&
      this.currentSr !== undefined &&
      lastSrEntry !== undefined &&
      lastSrEntry.getIndex() < this.currentSr.lengthEntries - 1
    ) {
      const start = lastSrEntry.getIndex() + 1;
      for (let j = start; j < this.currentSr.lengthEntries; j++) {
        const srEntry = this.makeSrEntry(j);
        bufferEntries.push({
          screenRecording: srEntry,
          trace: lastEntries?.trace,
          seek: srEntry.getTimestamp(),
        });
      }
    }

    return bufferEntries;
  }

  private makeSrEntry(
    index: number,
  ): CustomTraceEntryLazy<MediaBasedTraceEntry, CanvasEntry> {
    const getValue = async () => {
      const {frame, rotationAngle} = assertDefined(
        await this.videoFrameCache?.get(index, this.currState),
      );
      return new CanvasEntry(frame, rotationAngle);
    };
    const trace = assertDefined(this.currentSr);
    return trace.createLazyEntry(index, getValue);
  }

  private assignPropertyTreeNodePrototype(node: PropertyTreeNode) {
    Object.setPrototypeOf(node, PropertyTreeNode.prototype);
    node
      .getAllChildren()
      .forEach((child: PropertyTreeNode) =>
        this.assignPropertyTreeNodePrototype(child),
      );
  }

  private assignNodePrototypes(node: HierarchyTreeNode) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const propertiesProvider = (node as any).propertiesProvider;
    Object.setPrototypeOf(propertiesProvider, PropertiesProvider.prototype);

    this.assignPropertyTreeNodePrototype(
      propertiesProvider.getEagerProperties(),
    );

    Object.setPrototypeOf(node, HierarchyTreeNode.prototype);

    node.getRects()?.forEach((rect: TraceRect) => {
      Object.setPrototypeOf(rect, TraceRect.prototype);
      Object.setPrototypeOf(rect.transform, TransformMatrix.prototype);
      if (rect.cornerRadii) {
        Object.setPrototypeOf(rect.cornerRadii, CornerRadii.prototype);
      }
    });

    node.getSecondaryRects()?.forEach((rect: TraceRect) => {
      Object.setPrototypeOf(rect, TraceRect.prototype);
      Object.setPrototypeOf(rect.transform, TransformMatrix.prototype);
      if (rect.cornerRadii) {
        Object.setPrototypeOf(rect.cornerRadii, CornerRadii.prototype);
      }
    });

    node
      .getAllChildren()
      .forEach((child: HierarchyTreeNode) => this.assignNodePrototypes(child));

    node
      .getRelativeChildren()
      .forEach((child: HierarchyTreeNode) => this.assignNodePrototypes(child));
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL('./playback.worker', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent) => {
      const {trees, error} = event.data;

      try {
        if (error) {
          this.workerPromiseReject?.(new Error(`Worker error: ${error}`));
        } else {
          this.workerPromiseResolve?.(trees);
        }
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

    const map = await this.trace.getRectsMap();
    if (map === undefined) {
      throw Error('Playback is only implemented for traces with rects map');
    }

    return new Promise<HierarchyTreeNode[]>((resolve, reject) => {
      this.workerPromiseResolve = resolve;
      this.workerPromiseReject = reject;

      this.worker.postMessage({
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

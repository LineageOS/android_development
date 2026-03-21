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

import {Timestamp} from '@common/time/time';
import {CanvasEntry, MediaBasedTraceEntry,} from '@trace/media_based/media_based_trace_entry';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {TraceEntry} from './trace';

/**
 * Interface that associates the prefetched trace and screen recording entries
 * to be rendered during playback mode.
 */
export declare interface PlaybackPrefetchedEntries {
  screenRecording:
    | TraceEntry<MediaBasedTraceEntry, Promise<CanvasEntry>>
    | undefined;
  trace: TraceEntry<HierarchyTreeNode, HierarchyTreeNode> | undefined;
  seek: Timestamp;
}

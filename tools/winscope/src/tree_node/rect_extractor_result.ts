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

import {TraceRect} from './trace_rect';

/*
 * Type to keep the primary and secondary rects
 */
export interface NodeRects {
  primaryRects: TraceRect[];
  secondaryRects: TraceRect[] | undefined;
}

/*
 * Map for a singular snapshot
 */
export type SnapshotRects = Map<bigint, NodeRects>;

/*
 * Map for snapshot rects, where the snapshot id is mapped to the rects
 */
export type RectsForTrace = Map<bigint, SnapshotRects>;

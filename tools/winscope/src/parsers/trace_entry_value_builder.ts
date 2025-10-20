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

import {TraceType} from 'trace_api/trace_type';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {NOT_IMPLEMENTED_ERROR} from 'common/errors';
import {assertDefined} from 'common/assert';
import {QueryResult} from 'trace_processor/query_result';
import {RectsForTrace} from './rect_extractor_result';
import {makeEntryHierarchyTrees as wmMakeEntryHierarchyTrees} from './window_manager/perfetto/entry_hierarchy_tree_factory';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {makeEntryHierarchyTrees as vcMakeEntryHierarchyTree} from './view_capture/perfetto/entry_hierarchy_tree_factory';
import {makeEntryHierarchyTrees as sfMakeEntryHierarchyTree} from './surface_flinger/entry_hierarchy_tree_factory';

/**
 * A builder class for creating trace entry values.
 *
 * This class collects various data dependencies required to construct a specific
 * type of trace entry value (e.g., a hierarchy tree for SurfaceFlinger traces).
 * It allows setting different components like trace type, query results, and
 * geometry data, and then uses these to build the final object when `build()`
 * is called. This is useful for decoupling the creation logic from the
 * components that provide the necessary data.
 */
export class TraceEntryValueBuilder {
  private traceType: TraceType | undefined;
  private snapshotResults: QueryResult | undefined;
  private rectsMap: RectsForTrace | undefined;
  private nodeResults: QueryResult | undefined;
  private traceGeometryData: TraceGeometryData | undefined;

  setType(traceType: TraceType): TraceEntryValueBuilder {
    this.traceType = traceType;
    return this;
  }

  setSnapshotResults(snapshots: QueryResult): TraceEntryValueBuilder {
    this.snapshotResults = snapshots;
    return this;
  }

  setNodeResults(layers: QueryResult): TraceEntryValueBuilder {
    this.nodeResults = layers;
    return this;
  }

  setRectsMap(rectsMap: RectsForTrace): TraceEntryValueBuilder {
    this.rectsMap = rectsMap;
    return this;
  }

  setGeometryData(data: TraceGeometryData): TraceEntryValueBuilder {
    this.traceGeometryData = data;
    return this;
  }

  build(): HierarchyTreeNode[] {
    assertDefined(this.traceType);
    switch (this.traceType) {
      case TraceType.SURFACE_FLINGER:
        return sfMakeEntryHierarchyTree(
          assertDefined(this.snapshotResults),
          assertDefined(this.nodeResults),
          assertDefined(this.rectsMap),
          undefined,
          assertDefined(this.traceGeometryData),
        );
      case TraceType.WINDOW_MANAGER:
        return wmMakeEntryHierarchyTrees(
          assertDefined(this.nodeResults),
          assertDefined(this.rectsMap),
          undefined,
          assertDefined(this.traceGeometryData),
        );
      case TraceType.VIEW_CAPTURE:
        return vcMakeEntryHierarchyTree(
          assertDefined(this.nodeResults),
          assertDefined(this.rectsMap),
          undefined,
          assertDefined(this.traceGeometryData),
        );
      default:
        throw NOT_IMPLEMENTED_ERROR;
    }
  }
}

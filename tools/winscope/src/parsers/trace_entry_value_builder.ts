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
import {EntryHierarchyTreeFactory} from 'parsers/surface_flinger/entry_hierarchy_tree_factory';
import {SnapshotRects} from 'parsers/surface_flinger/rect_extractor';
import {NOT_IMPLEMENTED_ERROR} from 'common/errors';
import {assertDefined} from 'common/assert';
import {QueryResult} from 'trace_processor/query_result';

export class TraceEntryValueBuilder {
  private traceType: TraceType | undefined;
  private snapshotResults: QueryResult | undefined;
  private layerResults: QueryResult | undefined;
  private sfRectsMap: Map<bigint, SnapshotRects> | undefined;
  private traceGeometryData: TraceGeometryData | undefined;

  setType(traceType: TraceType) {
    this.traceType = traceType;
  }

  setSnapshotResults(snapshots: QueryResult) {
    this.snapshotResults = snapshots;
  }

  setLayersResults(layers: QueryResult) {
    this.layerResults = layers;
  }

  setSfRectsMap(rectsMap: Map<bigint, SnapshotRects>) {
    this.sfRectsMap = rectsMap;
  }

  setGeometryData(data: TraceGeometryData) {
    this.traceGeometryData = data;
  }

  build() {
    if (this.traceType === undefined) {
      return;
    }
    switch (this.traceType) {
      case TraceType.SURFACE_FLINGER:
        return EntryHierarchyTreeFactory.makeEntryHierarchyTrees(
          assertDefined(this.snapshotResults),
          assertDefined(this.layerResults),
          assertDefined(this.sfRectsMap),
          undefined,
          assertDefined(this.traceGeometryData),
        );
      default:
        throw NOT_IMPLEMENTED_ERROR;
    }
  }
}

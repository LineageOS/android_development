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

import {assertBigInt, assertDefined, assertString} from '@common/assert';
import {UINT32_MAX} from '@common/math';
import {PropertyTreeBuilderFromArgs} from '@parsers/helpers/property_tree_builder_from_args';
import {PropertyTreeBuilderFromQueryRow} from '@parsers/helpers/property_tree_builder_from_query_row';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {AddDefaults} from '@parsers/operations/add_defaults';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {queryArgs} from '@parsers/perfetto/query_helpers';
import {QueryResult, RowIterator} from '@trace_processor/query_result';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {Registry, TamperedProtoField,} from '@trace/proto_utils/tampered_message_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {LazyPropertiesStrategyType, PropertiesProvider,} from '@tree_node/properties_provider';
import {PropertiesProviderBuilder} from '@tree_node/properties_provider_builder';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {RectsForTrace} from '@tree_node/rect_extractor_result';
import {TraceRect} from '@tree_node/trace_rect';

import {HierarchyTreeBuilderVc} from './hierarchy_tree_builder_vc';
import {extractRect} from './rect_extractor';

/**
 * Creates node id for a ViewCapture view. Used to construct nodes and rects
 * in separate operations.
 */
export function makeTreeNodeId(row: RowIterator, windowName: string) {
  return windowName + 'ViewNode' + assertBigInt(row.get('node_id'));
}

/**
 * Creates name for a ViewCapture view. Used to construct nodes and rects
 * in separate operations.
 */
export function makeTreeNodeName(row: RowIterator) {
  const className = assertString(row.get('class_name'));
  const hashcode = assertBigInt(row.get('hashcode'));
  return `${className}@${hashcode}`;
}

/**
 * Creates HierarchyTreeNode objects for a WM trace.
 */
export function makeEntryHierarchyTrees(
  viewsResult: QueryResult,
  visibleRects: RectsForTrace,
  traceProcessor: TraceProcessor | undefined,
  traceGeometryData: TraceGeometryData,
  windowName: string,
): HierarchyTreeNode[] {
  const trees: HierarchyTreeNode[] = [];

  let currSnapshotId: bigint | undefined;
  let currViews: PropertiesProvider[] = [];
  const currRects = new Map<bigint, TraceRect>();

  for (const it = assertDefined(viewsResult).iter({}); it.valid(); it.next()) {
    const snapshotId = assertBigInt(it.get('snapshot_id'));
    if (currSnapshotId !== undefined && snapshotId !== currSnapshotId) {
      trees.push(buildHierarchyTree(currViews, currRects));
      currViews = [];
      currRects.clear();
    }
    currSnapshotId = snapshotId;

    const nodeId = assertBigInt(it.get('node_id'));
    const nodeRect = visibleRects?.get(snapshotId)?.get(nodeId);
    const visibleRect = nodeRect?.primaryRects[0];

    const viewAndRect = makeViewAndRect(
      it,
      visibleRect,
      traceProcessor,
      traceGeometryData,
      windowName,
    );
    currViews.push(viewAndRect.view);
    currRects.set(nodeId, viewAndRect.rect);
  }

  if (currViews.length > 0) {
    trees.push(buildHierarchyTree(currViews, currRects));
  }

  return trees;
}

function makeViewAndRect(
  viewRow: RowIterator,
  visibleRect: TraceRect | undefined,
  traceProcessor: TraceProcessor | undefined,
  traceGeometryData: TraceGeometryData,
  windowName: string,
): {view: PropertiesProvider; rect: TraceRect} {
  const view = makeViewPropertyProvider(viewRow, windowName, traceProcessor);
  const viewProperties = view.getEagerProperties();
  const rect =
    visibleRect ??
    extractRect(
      viewRow,
      viewProperties.id,
      viewProperties.name,
      traceGeometryData,
    );
  return {view, rect};
}

function buildHierarchyTree(
  views: PropertiesProvider[],
  rects: Map<bigint, TraceRect>,
): HierarchyTreeNode {
  const rootView = assertDefined(
    views.find((view) => {
      const parentId = Number(
        assertDefined(
          view.getEagerProperties().getChildByName('parentId'),
        ).getValue<bigint>(),
      );
      return parentId === UINT32_MAX;
    }),
  );
  const childrenViews = views.filter((view) => view !== rootView);

  const tree = new HierarchyTreeBuilderVc()
    .setRoot(rootView)
    .setChildren(childrenViews)
    .build();

  tree.forEachNodeDfs((node) => {
    const rect = assertDefined(
      rects.get(
        assertBigInt(node.getEagerPropertyByName('nodeId')?.getValue<bigint>()),
      ),
    );
    node.setRects([rect]);
  });
  return tree;
}

function makeViewPropertyProvider(
  row: RowIterator,
  windowName: string,
  traceProcessor: TraceProcessor | undefined,
): PropertiesProvider {
  const rootId = makeTreeNodeId(row, windowName);
  const rootName = makeTreeNodeName(row);

  const eagerProperties = makeViewEagerPropertiesTree(row, rootId, rootName);

  const argSetId = assertBigInt(row.get('arg_set_id'));
  const propertiesBuilder = new PropertiesProviderBuilder()
    .setEagerProperties(eagerProperties)
    .setCommonOperations([OPERATIONS.SetFormatters])
    .setLazyOperations([OPERATIONS.AddDefaults]);
  if (traceProcessor) {
    const lazyPropertiesStrategy = makeViewLazyPropertiesStrategy(
      Number(argSetId),
      rootId,
      rootName,
      traceProcessor,
    );
    propertiesBuilder
      .setLazyPropertiesStrategy(lazyPropertiesStrategy)
      .setTraceProcessor(traceProcessor);
  }
  return propertiesBuilder.build();
}

function makeViewEagerPropertiesTree(
  row: RowIterator,
  rootId: string,
  rootName: string,
): PropertyTreeNode {
  return new PropertyTreeBuilderFromQueryRow()
    .setData(row)
    .setRootId(rootId)
    .setRootName(rootName)
    .setColumns([
      'node_id',
      'class_name',
      'hashcode',
      'is_visible',
      'parent_id',
      'view_id',
    ])
    .setConvertColumnToBoolean('is_visible')
    .build();
}

function makeViewLazyPropertiesStrategy(
  argSetId: number,
  rootId: string,
  rootName: string,
  traceProcessor: TraceProcessor,
): LazyPropertiesStrategyType {
  return async () => {
    const argsData = await queryArgs(
      assertDefined(traceProcessor),
      Number(argSetId),
    );

    return new PropertyTreeBuilderFromArgs()
      .setData(argsData.iter({}))
      .setRootId(rootId)
      .setRootName(rootName)
      .setRootMessageType(assertDefined(getProtoViewField()?.resolve()))
      .build();
  };
}

function getProtoViewField(): TamperedProtoField {
  const winscopeExtensions = Registry.getInstance().getWinscopeExtensionsType();
  const viewcapture = assertDefined(
    winscopeExtensions.fields[
      '.perfetto.protos.WinscopeExtensionsImpl.viewcapture'
    ]?.resolve(),
  );
  return assertDefined(viewcapture.fields['views']);
}

const OPERATIONS = {
  get AddDefaults() {
    return new AddDefaults(getProtoViewField());
  },
  get SetFormatters() {
    return new SetFormatters(getProtoViewField());
  },
};

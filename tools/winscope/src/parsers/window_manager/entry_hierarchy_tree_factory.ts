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
import {PropertyTreeBuilderFromArgs} from '@parsers/helpers/property_tree_builder_from_args';
import {PropertyTreeBuilderFromQueryRow} from '@parsers/helpers/property_tree_builder_from_query_row';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {queryArgs} from '@parsers/perfetto/query_helpers';
import {QueryResult, RowIterator} from '@trace_processor/query_result';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {LazyPropertiesStrategyType, PropertiesProvider,} from '@tree_node/properties_provider';
import {PropertiesProviderBuilder} from '@tree_node/properties_provider_builder';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {RectsForTrace} from '@tree_node/rect_extractor_result';
import {TraceRect} from '@tree_node/trace_rect';

import {ContainerType} from './container_type';
import {DENYLIST_PROPERTIES} from './denylist_properties';
import {HierarchyTreeBuilderWm} from './hierarchy_tree_builder_wm';
import {WmOperationLists} from './operation_lists';
import {extractRect} from './rect_extractor';
import {TAMPERED_PROTOS_LATEST} from './tampered_protos_latest';

/**
 * Creates HierarchyTreeNode objects for a WM trace.
 */
export function makeEntryHierarchyTrees(
  containersResult: QueryResult,
  visibleRects: RectsForTrace,
  traceProcessor: TraceProcessor | undefined,
  traceGeometryData: TraceGeometryData,
): HierarchyTreeNode[] {
  const trees: HierarchyTreeNode[] = [];

  let currSnapshotId: bigint | undefined;
  let currSnapshotProperties: PropertiesProvider | undefined;
  let currContainers: PropertiesProvider[] = [];
  const currRects = new Map<number, TraceRect>();

  for (const it = containersResult.iter({}); it.valid(); it.next()) {
    const snapshotId = assertBigInt(it.get('snapshot_id'));
    if (currSnapshotId !== undefined && snapshotId !== currSnapshotId) {
      trees.push(
        buildHierarchyTree(
          assertDefined(currSnapshotProperties),
          currContainers,
          currRects,
        ),
      );
      currSnapshotProperties = undefined;
      currContainers = [];
      currRects.clear();
    }
    currSnapshotId = snapshotId;
    if (!currSnapshotProperties) {
      currSnapshotProperties = makeEntryProperties(it, traceProcessor);
    }

    const token = assertBigInt(it.get('token'));
    const nodeRect = visibleRects?.get(snapshotId)?.get(token);
    const visibleRect = nodeRect?.primaryRects[0];

    const {container, rect} = makeContainerAndRect(
      it,
      traceGeometryData,
      visibleRect,
      traceProcessor,
    );
    currContainers.push(container);
    if (rect) {
      currRects.set(Number(token), rect);
    }
  }

  if (currContainers.length > 0) {
    trees.push(
      buildHierarchyTree(
        assertDefined(currSnapshotProperties),
        currContainers,
        currRects,
      ),
    );
  }

  return trees;
}

/**
 * Creates node id for a window container. Used to construct nodes and rects
 * in separate operations.
 */
export function makeTreeNodeId(row: RowIterator): string {
  const containerType = assertString(row.get('container_type') ?? 'root');
  const token = assertString(row.get('token')?.toString(16));
  return `${containerType} ${token}`;
}

/**
 * Creates name for a window container. Used to construct nodes and rects
 * in separate operations.
 */
export function makeTreeNodeName(row: RowIterator): string {
  return assertString(row.get('name_override') ?? row.get('title'));
}

function makeEntryProperties(
  snapshotResult: RowIterator,
  traceProcessor: TraceProcessor | undefined,
): PropertiesProvider {
  const eagerProperties = new PropertyTreeBuilderFromQueryRow()
    .setData(snapshotResult)
    .setRootId('WindowManagerState')
    .setRootName('root')
    .setColumns(['focused_display_id'])
    .build();
  const argSetId = assertDefined(snapshotResult.get('snapshot_arg_set_id'));
  const operations = assertDefined(
    WmOperationLists.get(ContainerType.WindowManagerService),
  );
  const entryProps = new PropertiesProviderBuilder()
    .setEagerProperties(eagerProperties)
    .setLazyOperations(operations.lazy);

  if (traceProcessor) {
    entryProps
      .setLazyPropertiesStrategy(
        makeEntryLazyPropertiesStrategy(Number(argSetId), traceProcessor),
      )
      .setTraceProcessor(traceProcessor);
  }
  return entryProps.build();
}

function makeEntryLazyPropertiesStrategy(
  argSetId: number,
  traceProcessor: TraceProcessor,
): LazyPropertiesStrategyType {
  return async () => {
    const argsData = await queryArgs(traceProcessor, argSetId);

    return new PropertyTreeBuilderFromArgs()
      .setData(argsData.iter({}))
      .setRootId('WindowManager')
      .setRootName('root')
      .setDenyList(DENYLIST_PROPERTIES)
      .setRootMessageType(getEntryType())
      .build();
  };
}

function makeContainerAndRect(
  row: RowIterator,
  traceGeometryData: TraceGeometryData,
  visibleRect: TraceRect | undefined,
  traceProcessor: TraceProcessor | undefined,
): {container: PropertiesProvider; rect: TraceRect | undefined} {
  const container = makeContainerPropertyProvider(row, traceProcessor);
  const properties = container.getEagerProperties();
  const rect =
    visibleRect ??
    extractRect(row, properties.id, properties.name, traceGeometryData);
  return {container, rect};
}

function makeContainerPropertyProvider(
  row: RowIterator,
  traceProcessor: TraceProcessor | undefined,
): PropertiesProvider {
  const rootId = makeTreeNodeId(row);
  const rootName = makeTreeNodeName(row);

  const eagerProperties = makeContainerEagerPropertiesTree(
    row,
    rootId,
    rootName,
  );

  const argSetId = assertBigInt(row.get('arg_set_id'));

  const containerType = assertString(
    row.get('container_type'),
  ) as ContainerType;
  const operations = assertDefined(WmOperationLists.get(containerType));

  const propertiesBuilder = new PropertiesProviderBuilder()
    .setEagerProperties(eagerProperties)
    .setCommonOperations(operations.common)
    .setEagerOperations(operations.eager)
    .setLazyOperations(operations.lazy);

  if (traceProcessor) {
    const lazyPropertiesStrategy = makeContainerLazyPropertiesStrategy(
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

function makeContainerEagerPropertiesTree(
  row: RowIterator,
  rootId: string,
  rootName: string,
): PropertyTreeNode {
  return new PropertyTreeBuilderFromQueryRow()
    .setData(row)
    .setRootId(rootId)
    .setRootName(rootName)
    .setColumns([
      'token',
      'title',
      'container_type',
      'is_visible',
      'parent_token',
    ])
    .setConvertColumnToBoolean('is_visible')
    .setConvertColumnToNumber('token')
    .setConvertColumnToNumber('parent_token')
    .build();
}

function makeContainerLazyPropertiesStrategy(
  argSetId: number,
  rootId: string,
  rootName: string,
  traceProcessor: TraceProcessor,
): LazyPropertiesStrategyType {
  return async () => {
    const argsData = await queryArgs(traceProcessor, argSetId);
    return new PropertyTreeBuilderFromArgs()
      .setData(argsData.iter({}))
      .setRootId(rootId)
      .setRootName(rootName)
      .setDenyList(DENYLIST_PROPERTIES)
      .setRootMessageType(getContainerType())
      .build();
  };
}

function buildHierarchyTree(
  entry: PropertiesProvider,
  containers: PropertiesProvider[],
  rects: Map<number, TraceRect>,
): HierarchyTreeNode {
  const tree = new HierarchyTreeBuilderWm()
    .setRoot(entry)
    .setChildren(containers)
    .build();

  tree.getAllChildren().forEach((displayContent) => {
    displayContent.forEachNodeDfs((node) => {
      const rect = rects.get(
        assertDefined(node.getEagerPropertyByName('token')?.getValue<number>()),
      );
      if (rect) {
        node.setRects([rect]);
      }
    });
  });

  return tree;
}

function getContainerType() {
  return assertDefined(
    TAMPERED_PROTOS_LATEST.windowContainerChildField.resolve(),
  );
}

function getEntryType() {
  return assertDefined(TAMPERED_PROTOS_LATEST.entryField.resolve());
}

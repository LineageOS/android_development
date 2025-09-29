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

import {assertBigInt, assertDefined, assertString} from 'common/assert';
import {PropertyTreeBuilderFromProto} from 'parsers/property_tree_builder_from_proto';
import {
  LazyPropertiesStrategyType,
  PropertiesProvider,
} from 'tree_node/properties_provider';
import {PropertiesProviderBuilder} from 'tree_node/properties_provider_builder';
import {PropertyTreeNode} from 'tree_node/property_tree_node';
import {DENYLIST_PROPERTIES} from './denylist_properties';
import {ContainerType} from './container_type';
import {QueryResult, RowIterator} from 'trace_processor/query_result';
import {extractRect, SnapshotRects} from './rect_extractor';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {TraceRect} from 'tree_node/trace_rect';
import {queryArgs} from 'parsers/perfetto/utils';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {HierarchyTreeBuilderWm} from './hierarchy_tree_builder_wm';
import {PropertyTreeBuilderFromQueryRow} from 'parsers/property_tree_builder_from_query_row';
import {TraceProcessor} from 'trace_processor/trace_processor';
import {WM_OPERATION_LISTS} from './operations/operation_lists';
import {FakeProtoTransformer} from 'parsers/perfetto/fake_proto_transformer';
import {TAMPERED_PROTOS_LATEST} from './tampered_protos_latest';

/**
 * Creates HierarchyTreeNode objects for a WM trace.
 */
export function makeEntryHierarchyTrees(
  containersResult: QueryResult,
  visibleRects: Map<bigint, SnapshotRects>,
  traceProcessor: TraceProcessor,
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
    const visibleRect = visibleRects?.get(snapshotId)?.get(token);

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
  traceProcessor: TraceProcessor,
): PropertiesProvider {
  const focusedDisplayId = assertDefined(
    snapshotResult.get('focused_display_id'),
  );
  const eagerProperties = new PropertyTreeBuilderFromProto()
    .setData({focusedDisplayId})
    .setRootId('WindowManagerState')
    .setRootName('root')
    .build();
  const argSetId = assertDefined(snapshotResult.get('snapshot_arg_set_id'));
  const operations = assertDefined(
    WM_OPERATION_LISTS.get(ContainerType.WindowManagerService),
  );
  const entryProps = new PropertiesProviderBuilder()
    .setEagerProperties(eagerProperties)
    .setLazyPropertiesStrategy(
      makeEntryLazyPropertiesStrategy(Number(argSetId), traceProcessor),
    )
    .setLazyOperations(operations.lazy)
    .build();

  return entryProps;
}

function makeEntryLazyPropertiesStrategy(
  argSetId: number,
  traceProcessor: TraceProcessor,
): LazyPropertiesStrategyType {
  return async () => {
    const data = await queryArgs(traceProcessor, argSetId);
    return new PropertyTreeBuilderFromProto()
      .setData(ENTRY_TRANSFORMER.transform(data))
      .setRootId('WindowManager')
      .setRootName('root')
      .setDenyList(DENYLIST_PROPERTIES)
      .build();
  };
}

function makeContainerAndRect(
  row: RowIterator,
  traceGeometryData: TraceGeometryData,
  visibleRect: TraceRect | undefined,
  traceProcessor: TraceProcessor,
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
  traceProcessor: TraceProcessor,
): PropertiesProvider {
  const rootId = makeTreeNodeId(row);
  const rootName = makeTreeNodeName(row);

  const eagerProperties = makeContainerEagerPropertiesTree(
    row,
    rootId,
    rootName,
  );

  const argSetId = assertBigInt(row.get('arg_set_id'));
  const lazyPropertiesStrategy = makeContainerLazyPropertiesStrategy(
    Number(argSetId),
    rootId,
    rootName,
    traceProcessor,
  );

  const containerType = assertString(
    row.get('container_type'),
  ) as ContainerType;
  const operations = assertDefined(WM_OPERATION_LISTS.get(containerType));

  return new PropertiesProviderBuilder()
    .setEagerProperties(eagerProperties)
    .setLazyPropertiesStrategy(lazyPropertiesStrategy)
    .setCommonOperations(operations.common)
    .setEagerOperations(operations.eager)
    .setLazyOperations(operations.lazy)
    .build();
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
    const data = await queryArgs(traceProcessor, argSetId);
    return new PropertyTreeBuilderFromProto()
      .setData(CONTAINER_TRANSFORMER.transform(data))
      .setRootId(rootId)
      .setRootName(rootName)
      .setDenyList(DENYLIST_PROPERTIES)
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

const CONTAINER_TRANSFORMER = new FakeProtoTransformer(
  assertDefined(
    TAMPERED_PROTOS_LATEST.windowContainerChildField.tamperedMessageType,
  ),
);

const ENTRY_TRANSFORMER = new FakeProtoTransformer(
  assertDefined(TAMPERED_PROTOS_LATEST.entryField.tamperedMessageType),
);

/*
 * Copyright (C) 2024 The Android Open Source Project
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

import {assertBigInt, assertBigIntOrUndefined, assertDefined, assertString,} from '@common/assert';
import {PerfettoHwcCompositionType} from '@compat/protobuf';
import {UserWarning} from '@messaging/user_warning';
import {PropertyTreeBuilderFromArgs} from '@parsers/helpers/property_tree_builder_from_args';
import {PropertyTreeBuilderFromQueryRow} from '@parsers/helpers/property_tree_builder_from_query_row';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {makeWarningDuplicateLayerIds, makeWarningMissingLayerIds, makeWarningRecursiveLayerIds,} from '@parsers/helpers/warnings';
import {AddDefaults} from '@parsers/operations/add_defaults';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {TranslateIntDef} from '@parsers/operations/translate_intdef';
import {queryArgs} from '@parsers/perfetto/query_helpers';
import {ZOrderPathsComputation} from '@parsers/surface_flinger/computations/z_order_paths_computation';
import {AddCompositionType} from '@parsers/surface_flinger/operations/add_composition_type';
import {AddDisplayProperties} from '@parsers/surface_flinger/operations/add_display_properties';
import {TranslateFlags} from '@parsers/surface_flinger/operations/translate_flags';
import {UpdateCornerRadii} from '@parsers/surface_flinger/operations/update_corner_radii';
import {UpdateTransforms} from '@parsers/surface_flinger/operations/update_transforms';
import {QueryResult, RowIterator} from '@trace_processor/query_result';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {EnumFormatter, LAYER_ID_FORMATTER} from '@trace/formatters';
import {Registry, TamperedProtoField,} from '@trace/proto_utils/tampered_message_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {LazyPropertiesStrategyType, PropertiesProvider,} from '@tree_node/properties_provider';
import {PropertiesProviderBuilder} from '@tree_node/properties_provider_builder';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {NodeRects, RectsForTrace, SnapshotRects,} from '@tree_node/rect_extractor_result';

import {DENYLIST_PROPERTIES} from './denylist_properties';
import {HierarchyTreeBuilderSf} from './hierarchy_tree_builder_sf';
import {RectExtractor} from './rect_extractor';

export function makeEntryHierarchyTrees(
  snapshotResults: QueryResult,
  layersResults: QueryResult,
  visibleRectsResults: RectsForTrace,
  traceProcessor: TraceProcessor | undefined,
  traceGeometryData: TraceGeometryData,
): HierarchyTreeNode[] {
  const currLayer = layersResults.iter({});
  const currSnapshot = snapshotResults.iter({});
  const trees: HierarchyTreeNode[] = [];
  while (currSnapshot.valid()) {
    const currentId = assertBigInt(currSnapshot.get('id'));

    const currSnapshotProperties = makeEntryProperties(
      currSnapshot,
      traceProcessor,
    );
    const snapshotRect = assertDefined(visibleRectsResults.get(currentId));

    const {layers, rects, warnings} = makeLayersAndNonvisibleRects(
      currLayer,
      traceProcessor,
      currentId,
      snapshotRect,
      traceGeometryData,
    );

    const tree = buildHierarchyTree(
      currSnapshotProperties,
      layers,
      warnings,
      rects,
    );
    // Since the query uses left joins there might be multiple rows for the
    // same snapshot ID. We've already processed the unique information for
    // the currentId, so skip any remaining rows for this ID.
    while (
      currSnapshot.valid() &&
      assertBigInt(currSnapshot.get('id')) === currentId
    ) {
      currSnapshot.next();
    }
    trees.push(tree);
  }

  return trees;
}

function buildHierarchyTree(
  root: PropertiesProvider,
  layers: PropertiesProvider[],
  warnings: UserWarning[],
  snapshotRect: SnapshotRects,
): HierarchyTreeNode {
  const tree = new HierarchyTreeBuilderSf()
    .setRoot(root)
    .setChildren(layers)
    .setComputations([new ZOrderPathsComputation()])
    .build();

  warnings.forEach((warning) => tree.addWarning(warning));

  tree.forEachNodeDfs((node) => {
    if (node.isRoot()) {
      node.setRects(snapshotRect.get(-1n)?.primaryRects ?? []);
      return;
    }
    const layerId = assertBigInt(
      node.getEagerPropertyByName('layerId')?.getValue(),
    );
    const layerRects = snapshotRect.get(layerId);
    node.setRects(layerRects?.primaryRects ?? []);
    node.setSecondaryRects(layerRects?.secondaryRects ?? []);
  });
  return tree;
}

function makeEntryProperties(
  snapshotResult: RowIterator,
  traceProcessor: TraceProcessor | undefined,
): PropertiesProvider {
  const eagerProperties = new PropertyTreeBuilderFromQueryRow()
    .setData(snapshotResult)
    .setRootId('LayerTraceEntry')
    .setRootName('root')
    .setColumns(['arg_set_id'])
    .build();
  const entryProps = new PropertiesProviderBuilder()
    .setEagerProperties(eagerProperties)
    .setLazyOperations([
      Operations.AddDisplayProperties,
      Operations.AddDefaultsEntry,
      Operations.SetFormattersEntry,
      Operations.TranslateIntDefEntry,
    ]);
  if (traceProcessor) {
    entryProps
      .setTraceProcessor(traceProcessor)
      .setLazyPropertiesStrategy(makeEntryLazyPropertiesStrategy());
  }
  return entryProps.build();
}

function makeLayersAndNonvisibleRects(
  layersIter: RowIterator,
  traceProcessor: TraceProcessor | undefined,
  currSnapshotId: bigint | undefined,
  visibleRects: SnapshotRects,
  traceGeometryData: TraceGeometryData,
): {
  layers: PropertiesProvider[];
  rects: SnapshotRects;
  warnings: UserWarning[];
} {
  let missingLayerIds = false;
  const rects: SnapshotRects = new Map();
  const layers: PropertiesProvider[] = [];
  const recursiveIds: number[] = [];
  const processedUniqueRowIds = new Set<bigint>();
  const processedLayerIdCounts = new Map<number, number>();

  for (const it = layersIter; it.valid(); it.next()) {
    if (currSnapshotId !== undefined) {
      const snapshotId = assertBigIntOrUndefined(
        it.get('snapshot_id') ?? undefined,
      );
      if (snapshotId !== currSnapshotId) {
        break;
      }
    }

    const uniqueRowId = assertBigInt(it.get('id'));

    if (processedUniqueRowIds.has(uniqueRowId)) {
      // some row ids will be repeated due querying multiple fill region rects
      const layerIdBigint = assertBigInt(it.get('layer_id'));
      const layerRects = rects.get(layerIdBigint);
      if (layerRects) {
        tryUpdateFillRegion(layerRects, it, traceGeometryData);
      }
      continue;
    }

    processedUniqueRowIds.add(uniqueRowId);
    const layerIdBigint = assertBigIntOrUndefined(
      it.get('layer_id') ?? undefined,
    );

    if (layerIdBigint === undefined) {
      missingLayerIds = true;
      continue;
    }
    const layerId = Number(layerIdBigint);

    if (layerIdBigint === it.get('parent')) {
      recursiveIds.push(layerId);
    }

    const duplicateCount = processedLayerIdCounts.get(layerId) ?? 0;
    processedLayerIdCounts.set(layerId, duplicateCount + 1);

    const layerName = assertString(it.get('layer_name'));
    const layerProps = makeLayerPropertiesProvider(
      it,
      layerId,
      layerName,
      duplicateCount,
      traceProcessor,
    );
    layers.push(layerProps);
    const uniqueNodeId = layerProps.getEagerProperties().id;

    if (visibleRects.has(layerIdBigint)) {
      const precomputedRects = assertDefined(visibleRects.get(layerIdBigint));
      rects.set(layerIdBigint, precomputedRects);
    } else {
      const layerRects = RectExtractor.extractLayerRects(
        it,
        uniqueNodeId,
        layerName,
        traceGeometryData,
      );
      if (layerRects) {
        rects.set(layerIdBigint, layerRects);
      }
    }
  }

  const warnings = [];
  if (missingLayerIds) {
    warnings.push(makeWarningMissingLayerIds());
  }
  const duplicateIds = Array.from(processedLayerIdCounts.keys()).filter(
    (layerId) => assertDefined(processedLayerIdCounts.get(layerId)) > 1,
  );
  if (duplicateIds.length > 0) {
    warnings.push(makeWarningDuplicateLayerIds(duplicateIds));
  }
  if (recursiveIds.length > 0) {
    warnings.push(makeWarningRecursiveLayerIds(recursiveIds));
  }

  const displayRects = visibleRects.get(-1n);
  if (displayRects) {
    rects.set(-1n, displayRects);
  }

  return {
    layers,
    rects,
    warnings,
  };
}

function tryUpdateFillRegion(
  layerRects: NodeRects,
  row: RowIterator,
  traceGeometryData: TraceGeometryData,
) {
  const inputRect = layerRects?.secondaryRects?.[0];
  if (inputRect?.fillRegion) {
    const fillRegionRect = RectExtractor.extractFillRegionRect(
      row,
      traceGeometryData,
    );
    if (fillRegionRect) {
      assertDefined(inputRect.fillRegion).rects.push(fillRegionRect);
    }
  }
}

function makeLayerPropertiesProvider(
  row: RowIterator,
  layerId: number,
  layerName: string,
  duplicateCount: number,
  traceProcessor: TraceProcessor | undefined,
): PropertiesProvider {
  const eagerProperties = makeLayerEagerPropertiesTree(
    row,
    layerId,
    layerName,
    duplicateCount,
  );

  const builder = new PropertiesProviderBuilder()
    .setEagerProperties(eagerProperties)
    .setCommonOperations([Operations.AddCompositionType])
    .setLazyOperations([
      Operations.AddDefaultsLayer,
      Operations.UpdateTransforms,
      Operations.UpdateCornerRadii,
      Operations.SetFormattersLayer,
      Operations.TranslateIntDefLayer,
      Operations.TranslateFlags,
    ]);

  if (traceProcessor) {
    const lazyPropertiesStrategy = makeLayerLazyPropertiesStrategy(
      layerId,
      layerName,
      duplicateCount,
    );
    builder
      .setLazyPropertiesStrategy(lazyPropertiesStrategy)
      .setTraceProcessor(traceProcessor);
  }

  return builder.build();
}

function makeLayerEagerPropertiesTree(
  layerRow: RowIterator,
  layerId: number,
  layerName: string,
  duplicateCount: number,
): PropertyTreeNode {
  return new PropertyTreeBuilderFromQueryRow()
    .setData(layerRow)
    .setRootId(layerId)
    .setRootName(layerName)
    .setDuplicateCount(duplicateCount)
    .setColumns([
      'layer_id',
      'layer_name',
      'is_visible',
      'parent',
      'hwc_composition_type',
      'is_hidden_by_policy',
      'z_order_relative_of',
      'is_missing_z_parent',
      'arg_set_id',
    ])
    .setConvertColumnToBoolean('is_visible')
    .setConvertColumnToBoolean('is_hidden_by_policy')
    .setConvertColumnToBoolean('is_missing_z_parent')
    .build();
}

function makeLayerLazyPropertiesStrategy(
  layerId: number,
  layerName: string,
  duplicateCount: number,
): LazyPropertiesStrategyType {
  return async (traceProcessor?: TraceProcessor, argSetId?: bigint) => {
    const argsData = await queryArgs(
      assertDefined(traceProcessor),
      Number(argSetId),
    );

    return new PropertyTreeBuilderFromArgs()
      .setData(argsData.iter({}))
      .setRootId(layerId)
      .setRootName(layerName)
      .setDenyList(DENYLIST_PROPERTIES)
      .setDuplicateCount(duplicateCount)
      .setRootMessageType(assertDefined(getLayerField().resolve()))
      .build();
  };
}

function makeEntryLazyPropertiesStrategy(): LazyPropertiesStrategyType {
  return async (traceProcessor?: TraceProcessor, argSetId?: bigint) => {
    const argsData = await queryArgs(
      assertDefined(traceProcessor),
      Number(argSetId),
    );
    return new PropertyTreeBuilderFromArgs()
      .setData(argsData.iter({}))
      .setRootId('LayerTraceEntry')
      .setRootName('root')
      .setDenyList(DENYLIST_PROPERTIES)
      .setRootMessageType(assertDefined(getEntryField().resolve()))
      .build();
  };
}

function getEntryField(): TamperedProtoField {
  return Registry.getInstance().getTracePacketType().fields[
    'surfaceflingerLayersSnapshot'
  ];
}

function getLayerField(): TamperedProtoField {
  return assertDefined(getEntryField().resolve()?.fields['layers']?.resolve())
    .fields['layers'];
}

const HWC_COMPOSITION_TYPE_INVERTED = Object.entries(
  PerfettoHwcCompositionType,
).reduce(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (acc, [key, value]: [string, any]) => {
    acc[value] = key;
    return acc;
  },
  {} as {[key: number]: string},
);

const CUSTOM_FORMATTERS = new Map([
  ['cropLayerId', LAYER_ID_FORMATTER],
  ['zOrderRelativeOf', LAYER_ID_FORMATTER],
  ['hwcCompositionType', new EnumFormatter(HWC_COMPOSITION_TYPE_INVERTED)],
]);

class Operations {
  static get SetFormattersLayer() {
    return new SetFormatters(getLayerField(), CUSTOM_FORMATTERS);
  }
  static get TranslateIntDefLayer() {
    return new TranslateIntDef(getLayerField());
  }
  static get AddDefaultsLayer() {
    return new AddDefaults(getLayerField(), undefined, DENYLIST_PROPERTIES);
  }
  static get SetFormattersEntry() {
    return new SetFormatters(getEntryField(), CUSTOM_FORMATTERS);
  }
  static get TranslateIntDefEntry() {
    return new TranslateIntDef(getEntryField());
  }
  static get AddDefaultsEntry() {
    return new AddDefaults(getEntryField(), undefined, DENYLIST_PROPERTIES);
  }
  static get UpdateTransforms() {
    return new UpdateTransforms();
  }
  static get TranslateFlags() {
    return new TranslateFlags();
  }
  static get AddDisplayProperties() {
    return new AddDisplayProperties();
  }
  static get AddCompositionType() {
    return new AddCompositionType();
  }
  static get UpdateCornerRadii() {
    return new UpdateCornerRadii();
  }
}

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

import {
  assertBigInt,
  assertBigIntOrUndefined,
  assertDefined,
  assertString,
} from 'common/assert';
import {UserWarning} from 'messaging/user_warning';
import {
  DuplicateLayerIds,
  MissingLayerIds,
  RecursiveLayerIds,
} from 'messaging/user_warnings';
import {AddDefaults} from 'parsers/operations/add_defaults';
import {TranslateIntDef} from 'parsers/operations/translate_intdef';
import {FakeProtoTransformer} from 'parsers/perfetto/fake_proto_transformer';
import {queryArgs} from 'parsers/perfetto/utils';
import {PropertyTreeBuilderFromProto} from 'parsers/property_tree_builder_from_proto';
import {PropertyTreeBuilderFromQueryRow} from 'parsers/property_tree_builder_from_query_row';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {perfetto} from 'protos/perfetto/trace/static';
import {EnumFormatter, LAYER_ID_FORMATTER} from 'trace/formatters';
import {TAMPERED_TRACE_PACKET} from 'trace/proto_utils/tampered_message_type';
import {QueryResult, RowIterator} from 'trace_processor/query_result';
import {TraceProcessor} from 'trace_processor/trace_processor';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {
  LazyPropertiesStrategyType,
  PropertiesProvider,
} from 'tree_node/properties_provider';
import {PropertiesProviderBuilder} from 'tree_node/properties_provider_builder';
import {PropertyTreeNode} from 'tree_node/property_tree_node';
import {TraceRect} from 'tree_node/trace_rect';
import {SetFormatters} from 'viewers/operations/set_formatters';
import {ZOrderPathsComputation} from './computations/z_order_paths_computation';
import {DENYLIST_PROPERTIES} from './denylist_properties';
import {HierarchyTreeBuilderSf} from './hierarchy_tree_builder_sf';
import {AddCompositionType} from './operations/add_composition_type';
import {AddDisplayProperties} from './operations/add_display_properties';
import {TranslateFlags} from './operations/translate_flags';
import {UpdateCornerRadii} from './operations/update_corner_radii';
import {UpdateTransforms} from './operations/update_transforms';
import {LayerRects, RectExtractor} from './rect_extractor';

export class EntryHierarchyTreeFactory {
  private static readonly ENTRY_FIELD =
    TAMPERED_TRACE_PACKET.fields['surfaceflingerLayersSnapshot'];
  private static readonly LAYER_FIELD = assertDefined(
    EntryHierarchyTreeFactory.ENTRY_FIELD.tamperedMessageType?.fields['layers']
      .tamperedMessageType,
  ).fields['layers'];
  private static readonly SNAPSHOT_TRANSFORMER = new FakeProtoTransformer(
    assertDefined(EntryHierarchyTreeFactory.ENTRY_FIELD.tamperedMessageType),
  );
  private static readonly LAYER_TRANSFORMER = new FakeProtoTransformer(
    assertDefined(EntryHierarchyTreeFactory.LAYER_FIELD.tamperedMessageType),
  );

  private static readonly CUSTOM_FORMATTERS = new Map([
    ['cropLayerId', LAYER_ID_FORMATTER],
    ['zOrderRelativeOf', LAYER_ID_FORMATTER],
    [
      'hwcCompositionType',
      new EnumFormatter(perfetto.protos.HwcCompositionType),
    ],
  ]);

  static readonly Operations = {
    SetFormattersLayer: new SetFormatters(
      EntryHierarchyTreeFactory.LAYER_FIELD,
      EntryHierarchyTreeFactory.CUSTOM_FORMATTERS,
    ),
    TranslateIntDefLayer: new TranslateIntDef(
      EntryHierarchyTreeFactory.LAYER_FIELD,
    ),
    AddDefaultsLayer: new AddDefaults(
      EntryHierarchyTreeFactory.LAYER_FIELD,
      undefined,
      DENYLIST_PROPERTIES,
    ),
    SetFormattersEntry: new SetFormatters(
      EntryHierarchyTreeFactory.ENTRY_FIELD,
      EntryHierarchyTreeFactory.CUSTOM_FORMATTERS,
    ),
    TranslateIntDefEntry: new TranslateIntDef(
      EntryHierarchyTreeFactory.ENTRY_FIELD,
    ),
    AddDefaultsEntry: new AddDefaults(
      EntryHierarchyTreeFactory.ENTRY_FIELD,
      undefined,
      DENYLIST_PROPERTIES,
    ),
    UpdateTransforms: new UpdateTransforms(),
    TranslateFlags: new TranslateFlags(),
    AddDisplayProperties: new AddDisplayProperties(),
    AddCompositionType: new AddCompositionType(),
    UpdateCornerRadii: new UpdateCornerRadii(),
  };

  makeEntryHierarchyTrees(
    snapshotResults: QueryResult,
    layersResults: QueryResult,
    visibleRectsResults: Map<
      bigint,
      {displayRects: TraceRect[]; layerRects: Map<bigint, LayerRects>}
    >,
    traceProcessor: TraceProcessor,
    traceGeometryData: TraceGeometryData,
  ): HierarchyTreeNode[] {
    const currLayer = layersResults.iter({});
    const currSnapshot = snapshotResults.iter({});
    const trees: HierarchyTreeNode[] = [];
    while (currSnapshot.valid()) {
      const currentId = assertBigInt(currSnapshot.get('id'));

      const currSnapshotProperties = this.makeEntryProperties(
        currSnapshot,
        traceProcessor,
      );
      const visibleRects = assertDefined(visibleRectsResults.get(currentId));
      const displayRects = visibleRects.displayRects;
      const visibleLayerRects = visibleRects.layerRects;

      const {layers, rects, warnings} = this.makeLayersAndNonvisibleRects(
        currLayer,
        traceProcessor,
        currentId,
        visibleLayerRects,
        traceGeometryData,
      );

      const tree = this.buildHierarchyTree(
        currSnapshotProperties,
        layers,
        warnings,
        rects,
        displayRects,
      );
      // Since our query uses left joins there might be multiple rows for the same snapshotID
      // We've already processed the unique information for the currentId, so we skip any remaining rows for this ID.
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

  private buildHierarchyTree(
    root: PropertiesProvider,
    layers: PropertiesProvider[],
    warnings: UserWarning[],
    rects: Map<bigint, LayerRects>,
    displayRects: TraceRect[],
  ): HierarchyTreeNode {
    const tree = new HierarchyTreeBuilderSf()
      .setRoot(root)
      .setChildren(layers)
      .setComputations([new ZOrderPathsComputation()])
      .build();

    warnings.forEach((warning) => tree.addWarning(warning));

    tree.forEachNodeDfs((node) => {
      if (node.isRoot()) {
        node.setRects(displayRects);
        return;
      }
      const layerRects = rects.get(
        assertBigInt(node.getEagerPropertyByName('layerId')?.getValue()),
      );
      if (layerRects?.bounds) {
        node.setRects([layerRects.bounds]);
      }
      if (layerRects?.input) {
        node.setSecondaryRects([layerRects.input]);
      }
    });
    return tree;
  }

  private makeEntryProperties(
    snapshotResult: RowIterator,
    traceProcessor: TraceProcessor,
  ): PropertiesProvider {
    const eagerProperties = new PropertyTreeBuilderFromProto()
      .setData({})
      .setRootId('LayerTraceEntry')
      .setRootName('root')
      .build();
    const argSetId = assertDefined(snapshotResult.get('arg_set_id'));
    const entryProps = new PropertiesProviderBuilder()
      .setEagerProperties(eagerProperties)
      .setLazyPropertiesStrategy(
        this.makeEntryLazyPropertiesStrategy(Number(argSetId), traceProcessor),
      )
      .setLazyOperations([
        EntryHierarchyTreeFactory.Operations.AddDisplayProperties,
        EntryHierarchyTreeFactory.Operations.AddDefaultsEntry,
        EntryHierarchyTreeFactory.Operations.SetFormattersEntry,
        EntryHierarchyTreeFactory.Operations.TranslateIntDefEntry,
      ])
      .build();

    return entryProps;
  }

  private makeLayersAndNonvisibleRects(
    layersIter: RowIterator,
    traceProcessor: TraceProcessor,
    currSnapshotId: bigint | undefined,
    visibleLayerInputRects: Map<bigint, LayerRects>,
    traceGeometryData: TraceGeometryData,
  ): {
    layers: PropertiesProvider[];
    rects: Map<bigint, LayerRects>;
    warnings: UserWarning[];
  } {
    let missingLayerIds = false;
    const rects = new Map<bigint, LayerRects>();
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
          this.tryUpdateFillRegion(layerRects, it, traceGeometryData);
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
      const layerProps = this.makeLayerPropertiesProvider(
        it,
        layerId,
        layerName,
        duplicateCount,
        traceProcessor,
      );
      layers.push(layerProps);
      const uniqueNodeId = layerProps.getEagerProperties().id;

      if (visibleLayerInputRects.has(layerIdBigint)) {
        const precomputedRects = assertDefined(
          visibleLayerInputRects.get(layerIdBigint),
        );
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
          this.tryUpdateFillRegion(layerRects, it, traceGeometryData);
        }
      }
    }

    const warnings = [];
    if (missingLayerIds) {
      warnings.push(new MissingLayerIds());
    }
    const duplicateIds = Array.from(processedLayerIdCounts.keys()).filter(
      (layerId) => assertDefined(processedLayerIdCounts.get(layerId)) > 1,
    );
    if (duplicateIds.length > 0) {
      warnings.push(new DuplicateLayerIds(duplicateIds));
    }
    if (recursiveIds.length > 0) {
      warnings.push(new RecursiveLayerIds(recursiveIds));
    }

    return {
      layers,
      rects,
      warnings,
    };
  }

  private tryUpdateFillRegion(
    layerRects: LayerRects,
    row: RowIterator,
    traceGeometryData: TraceGeometryData,
  ) {
    if (layerRects?.input) {
      const fillRegionRect = RectExtractor.extractFillRegionRect(
        row,
        traceGeometryData,
      );
      if (fillRegionRect) {
        assertDefined(layerRects.input.fillRegion).rects.push(fillRegionRect);
      }
    }
  }

  private makeLayerPropertiesProvider(
    row: RowIterator,
    layerId: number,
    layerName: string,
    duplicateCount: number,
    traceProcessor: TraceProcessor,
  ): PropertiesProvider {
    const eagerProperties = this.makeLayerEagerPropertiesTree(
      row,
      layerId,
      layerName,
      duplicateCount,
    );

    const argSetId = assertBigInt(row.get('arg_set_id'));
    const lazyPropertiesStrategy = this.makeLayerLazyPropertiesStrategy(
      Number(argSetId),
      layerId,
      layerName,
      traceProcessor,
      duplicateCount,
    );

    return new PropertiesProviderBuilder()
      .setEagerProperties(eagerProperties)
      .setCommonOperations([
        EntryHierarchyTreeFactory.Operations.AddCompositionType,
      ])
      .setLazyPropertiesStrategy(lazyPropertiesStrategy)
      .setLazyOperations([
        EntryHierarchyTreeFactory.Operations.AddDefaultsLayer,
        EntryHierarchyTreeFactory.Operations.UpdateTransforms,
        EntryHierarchyTreeFactory.Operations.UpdateCornerRadii,
        EntryHierarchyTreeFactory.Operations.SetFormattersLayer,
        EntryHierarchyTreeFactory.Operations.TranslateIntDefLayer,
        EntryHierarchyTreeFactory.Operations.TranslateFlags,
      ])
      .build();
  }

  private makeLayerEagerPropertiesTree(
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
      ])
      .setConvertColumnToBoolean('is_visible')
      .setConvertColumnToBoolean('is_hidden_by_policy')
      .setConvertColumnToBoolean('is_missing_z_parent')
      .build();
  }

  private makeLayerLazyPropertiesStrategy(
    argSetId: number,
    layerId: number,
    layerName: string,
    traceProcessor: TraceProcessor,
    duplicateCount: number,
  ): LazyPropertiesStrategyType {
    return async () => {
      const data = await queryArgs(traceProcessor, argSetId);
      return new PropertyTreeBuilderFromProto()
        .setData(EntryHierarchyTreeFactory.LAYER_TRANSFORMER.transform(data))
        .setRootId(layerId)
        .setRootName(layerName)
        .setDenyList(DENYLIST_PROPERTIES)
        .setDuplicateCount(duplicateCount)
        .build();
    };
  }

  private makeEntryLazyPropertiesStrategy(
    argSetId: number,
    traceProcessor: TraceProcessor,
  ): LazyPropertiesStrategyType {
    return async () => {
      const data = await queryArgs(traceProcessor, argSetId);
      return new PropertyTreeBuilderFromProto()
        .setData(EntryHierarchyTreeFactory.SNAPSHOT_TRANSFORMER.transform(data))
        .setRootId('LayerTraceEntry')
        .setRootName('root')
        .setDenyList(DENYLIST_PROPERTIES)
        .build();
    };
  }
}

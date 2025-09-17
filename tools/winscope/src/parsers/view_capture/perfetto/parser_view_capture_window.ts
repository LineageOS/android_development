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

import {assertBigInt, assertDefined, assertString} from 'common/assert';
import {UINT32_MAX} from 'common/math';
import {ParserTimestampConverter} from 'common/time/timestamp_converter';
import {AddDefaults} from 'parsers/operations/add_defaults';
import {AbstractParser} from 'parsers/perfetto/abstract_parser';
import {FakeProtoTransformer} from 'parsers/perfetto/fake_proto_transformer';
import {queryArgs} from 'parsers/perfetto/utils';
import {PropertyTreeBuilderFromProto} from 'parsers/property_tree_builder_from_proto';
import {PropertyTreeBuilderFromQueryRow} from 'parsers/property_tree_builder_from_query_row';
import {TraceGeometryData} from 'parsers/trace_geometry_data';
import {
  RectExtractor,
  SnapshotRects,
} from 'parsers/view_capture/perfetto/rect_extractor';
import {TAMPERED_WINSCOPE_EXTENSIONS} from 'trace/proto_utils/tampered_message_type';
import {TraceFile} from 'trace/trace_file';
import {
  CustomQueryParserResultTypeMap,
  CustomQueryType,
  VisitableParserCustomQuery,
} from 'trace_api/custom_query';
import {EntriesRange} from 'trace_api/index_types';
import {TraceType} from 'trace_api/trace_type';
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
import {HierarchyTreeBuilderVc} from './hierarchy_tree_builder_vc';

/**
 * A parser for a single window in a Perfetto ViewCapture trace.
 */
export class ParserViewCaptureWindow extends AbstractParser<HierarchyTreeNode> {
  private static readonly PROTO_VIEWCAPTURE_FIELD = assertDefined(
    TAMPERED_WINSCOPE_EXTENSIONS.fields[
      '.perfetto.protos.WinscopeExtensionsImpl.viewcapture'
    ],
  );
  private static readonly PROTO_VIEW_FIELD = assertDefined(
    ParserViewCaptureWindow.PROTO_VIEWCAPTURE_FIELD.tamperedMessageType?.fields[
      'views'
    ],
  );

  private static readonly OPERATIONS = {
    AddDefaults: new AddDefaults(ParserViewCaptureWindow.PROTO_VIEW_FIELD),
    SetFormatters: new SetFormatters(ParserViewCaptureWindow.PROTO_VIEW_FIELD),
  };

  private visibleRects: Map<bigint, SnapshotRects> | undefined;
  private readonly packageName: string;
  private readonly windowName: string;
  private readonly viewProtoTransformer: FakeProtoTransformer;

  constructor(
    traceFile: TraceFile,
    traceProcessor: TraceProcessor,
    timestampConverter: ParserTimestampConverter,
    traceGeometryData: TraceGeometryData,
    packageName: string,
    windowName: string,
  ) {
    super(traceFile, traceProcessor, timestampConverter, traceGeometryData);
    this.packageName = packageName;
    this.windowName = windowName;
    this.viewProtoTransformer = new FakeProtoTransformer(
      assertDefined(
        ParserViewCaptureWindow.PROTO_VIEW_FIELD.tamperedMessageType,
      ),
    );
  }

  override getTraceType(): TraceType {
    return TraceType.VIEW_CAPTURE;
  }

  override getDescriptors(): string[] {
    return [this.windowName, ...super.getDescriptors()];
  }

  override async getEntry(index: number): Promise<HierarchyTreeNode> {
    const range: EntriesRange = {
      start: index,
      end: index + 1,
    };
    return this.getRangeOfEntries(range).then((trees) => {
      const entry = trees[0];
      if (entry === undefined) {
        throw new Error(
          `Entry at index ${index} not found or could not be parsed.`,
        );
      }
      return entry;
    });
  }

  override async getRangeOfEntries(
    range: EntriesRange,
  ): Promise<Array<HierarchyTreeNode | undefined>> {
    // assuming the entryIndex monotically increases, true for ViewCapture
    const snapshotStart = this.entryIndexToRowIdMap[range.start];
    const snapshotEnd = snapshotStart + range.end - range.start;
    const viewsResult = await this.queryRangeViewsAndRects(
      snapshotStart,
      snapshotEnd,
    );
    const visibleRects = await this.fetchAllVisibleRects();
    return this.makeEntryHierarchyTrees(viewsResult, visibleRects);
  }

  makeEntryHierarchyTrees(
    viewsResult: QueryResult,
    visibleRects: Map<bigint, SnapshotRects>,
  ): HierarchyTreeNode[] {
    const trees: HierarchyTreeNode[] = [];

    let currSnapshotId: bigint | undefined;
    let currViews: PropertiesProvider[] = [];
    const currRects = new Map<bigint, TraceRect>();

    for (const it = viewsResult.iter({}); it.valid(); it.next()) {
      const snapshotId = assertBigInt(it.get('snapshot_id'));
      if (currSnapshotId !== undefined && snapshotId !== currSnapshotId) {
        trees.push(this.buildHierarchyTree(currViews, currRects));
        currViews = [];
        currRects.clear();
      }
      currSnapshotId = snapshotId;

      const nodeId = assertBigInt(it.get('node_id'));
      const visibleRect = visibleRects?.get(snapshotId)?.get(nodeId);

      const viewAndRect = this.makeViewAndRect(it, visibleRect);
      currViews.push(viewAndRect.view);
      currRects.set(nodeId, viewAndRect.rect);
    }

    if (currViews.length > 0) {
      trees.push(this.buildHierarchyTree(currViews, currRects));
    }

    return trees;
  }

  override customQuery<Q extends CustomQueryType>(
    type: Q,
    entriesRange: EntriesRange,
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    return new VisitableParserCustomQuery(type)
      .visit(CustomQueryType.VIEW_CAPTURE_METADATA, async () => {
        const metadata = {
          packageName: this.packageName,
          windowName: this.windowName,
        };
        return Promise.resolve(metadata);
      })
      .getResult();
  }

  protected override getStdLibModuleName(): string | undefined {
    return 'android.winscope.viewcapture';
  }

  protected override getTableName(): string {
    return 'android_viewcapture';
  }

  override async buildEntryIndexToRowIdMap(): Promise<number[]> {
    const sqlRowIdAndTimestamp = `
        SELECT vc.id as id, vc.ts as ts
        FROM ${this.getTableName()} AS vc
        WHERE
          vc.window_name = '${this.windowName}' and vc.package_name = '${
            this.packageName
          }'
        ORDER BY vc.ts;
    `;
    const result = await this.traceProcessor.query(sqlRowIdAndTimestamp);
    const entryIndexToRowId: number[] = [];
    for (const it = result.iter({}); it.valid(); it.next()) {
      const rowId = Number(it.get('id'));
      entryIndexToRowId.push(rowId);
    }
    return entryIndexToRowId;
  }

  private async fetchAllVisibleRects(): Promise<Map<bigint, SnapshotRects>> {
    if (this.visibleRects === undefined) {
      const visibleRectsResult = await this.queryAllVisibleRects();
      this.visibleRects = RectExtractor.extractAllRects(
        visibleRectsResult.iter({}),
        assertDefined(this.traceGeometryData),
        (row: RowIterator) => this.makeTreeNodeId(row),
        (row: RowIterator) => this.makeTreeNodeName(row),
      );
    }
    return this.visibleRects;
  }

  private async queryAllVisibleRects(): Promise<QueryResult> {
    const visibleRectsDisplayQuery = `
      SELECT
        vcv.snapshot_id,
        vcv.node_id,
        vcv.class_name,
        vcv.hashcode,
        vcv.is_visible,
        tr.group_id,
        tr.depth,
        tr.opacity,
        tr.rect_id
      FROM android_viewcapture_view AS vcv
      LEFT JOIN android_winscope_trace_rect AS tr
        ON vcv.trace_rect_id = tr.id
        WHERE vcv.is_visible = true
        ORDER BY vcv.id;
    `;
    return this.traceProcessor.query(visibleRectsDisplayQuery);
  }

  private async queryRangeViewsAndRects(
    start: number,
    end: number,
  ): Promise<QueryResult> {
    const query = `
      SELECT
        vcv.snapshot_id,
        vcv.arg_set_id,
        vcv.node_id,
        vcv.class_name,
        vcv.hashcode,
        vcv.is_visible,
        vcv.parent_id,
        vcv.view_id,
        tr.group_id,
        tr.depth,
        tr.opacity,
        tr.rect_id
      FROM android_viewcapture_view AS vcv
      LEFT JOIN android_winscope_trace_rect AS tr
        ON vcv.trace_rect_id = tr.id
      WHERE vcv.snapshot_id >= ${start} AND vcv.snapshot_id < ${end}
        ORDER BY vcv.id`;
    return await this.traceProcessor.query(query);
  }

  private makeViewAndRect(
    viewRow: RowIterator,
    visibleRect: TraceRect | undefined,
  ): {view: PropertiesProvider; rect: TraceRect} {
    const view = this.makeViewPropertyProvider(viewRow);
    const viewProperties = view.getEagerProperties();
    const rect =
      visibleRect ??
      RectExtractor.extractRect(
        viewRow,
        viewProperties.id,
        viewProperties.name,
        assertDefined(this.traceGeometryData),
      );
    return {view, rect};
  }

  private buildHierarchyTree(
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
          assertBigInt(
            node.getEagerPropertyByName('nodeId')?.getValue<bigint>(),
          ),
        ),
      );
      node.setRects([rect]);
    });
    return tree;
  }

  private makeTreeNodeId(row: RowIterator) {
    return 'ViewNode' + assertBigInt(row.get('node_id'));
  }

  private makeTreeNodeName(row: RowIterator) {
    const className = assertString(row.get('class_name'));
    const hashcode = assertBigInt(row.get('hashcode'));
    return `${className}@${hashcode}`;
  }

  private makeViewPropertyProvider(row: RowIterator): PropertiesProvider {
    const rootId = this.makeTreeNodeId(row);
    const rootName = this.makeTreeNodeName(row);

    const eagerProperties = this.makeViewEagerPropertiesTree(
      row,
      rootId,
      rootName,
    );

    const argSetId = assertBigInt(row.get('arg_set_id'));
    const lazyPropertiesStrategy = this.makeViewLazyPropertiesStrategy(
      Number(argSetId),
      rootId,
      rootName,
      this.traceProcessor,
    );

    return new PropertiesProviderBuilder()
      .setEagerProperties(eagerProperties)
      .setLazyPropertiesStrategy(lazyPropertiesStrategy)
      .setCommonOperations([ParserViewCaptureWindow.OPERATIONS.SetFormatters])
      .setLazyOperations([ParserViewCaptureWindow.OPERATIONS.AddDefaults])
      .build();
  }

  private makeViewEagerPropertiesTree(
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

  private makeViewLazyPropertiesStrategy(
    argSetId: number,
    rootId: string,
    rootName: string,
    traceProcessor: TraceProcessor,
  ): LazyPropertiesStrategyType {
    return async () => {
      const data = await queryArgs(traceProcessor, argSetId);
      return new PropertyTreeBuilderFromProto()
        .setData(this.viewProtoTransformer.transform(data))
        .setRootId(rootId)
        .setRootName(rootName)
        .build();
    };
  }
}

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

import {assertBigInt, assertBigIntOrUndefined, assertDefined,} from '@common/assert';
import {MakeTimestampStrategyType} from '@common/time/time';
import {HierarchyTreeBuilderLog} from '@parsers/helpers/hierarchy_tree_builder_log';
import {PropertyTreeBuilderFromArgs} from '@parsers/helpers/property_tree_builder_from_args';
import {PropertyTreeBuilderFromProto} from '@parsers/helpers/property_tree_builder_from_proto';
import {PropertyTreeBuilderFromQueryRow} from '@parsers/helpers/property_tree_builder_from_query_row';
import {InputCoordinatePropagator} from '@parsers/input/operations/input_coordinate_propagator';
import {RenameProperty} from '@parsers/input/operations/rename_property';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {TransformToTimestamp} from '@parsers/operations/transform_to_timestamp';
import {TranslateIntDef} from '@parsers/operations/translate_intdef';
import {AbstractParser} from '@parsers/perfetto/abstract_parser';
import {queryArgs, queryVsyncId} from '@parsers/perfetto/query_helpers';
import {CustomQueryParserResultTypeMap, CustomQueryType, VisitableParserCustomQuery,} from '@trace_api/custom_query';
import {EntriesRange} from '@trace_api/index_types';
import {RowIterator} from '@trace_processor/query_result';
import {EnumFormatter} from '@trace/formatters';
import {InputEventType} from '@trace/input/input_event_type';
import {Registry, TamperedMessageType,} from '@trace/proto_utils/tampered_message_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {Operation} from '@tree_node/operation';
import {PropertiesProvider} from '@tree_node/properties_provider';
import {PropertiesProviderBuilder} from '@tree_node/properties_provider_builder';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {DEFAULT_PROPERTY_TREE_NODE_FACTORY} from '@tree_node/property_tree_node_factory';

export abstract class AbstractInputEventParser extends AbstractParser<HierarchyTreeNode> {
  protected readonly wrapperProto = assertDefined(
    assertDefined(Registry.getInstance().getType('perfetto.protos.TracePacket'))
      .fields['winscopeExtensions'].resolve()
      ?.fields[
        '.perfetto.protos.WinscopeExtensionsImpl.androidInputEvent'
      ].resolve(),
  );
  protected static readonly KEY_EVENT_TABLE = 'android_key_events';
  protected static readonly MOTION_EVENT_TABLE = 'android_motion_events';
  protected static readonly COMMON_EVENT_COLUMNS = [
    'ts',
    'event_id',
    'arg_set_id',
    'source',
    'action',
    'device_id',
    'display_id',
  ];

  private readonly dispatchEventField =
    this.wrapperProto.fields['dispatcherWindowDispatchEvent'];
  private static readonly DISPATCH_TABLE = 'android_input_event_dispatch';
  private static readonly DISPATCH_COLUMNS = ['window_id'];
  private readonly baseDispatchEventOps = [
    new SetFormatters(this.dispatchEventField),
    new TranslateIntDef(this.dispatchEventField),
    new InputCoordinatePropagator(),
  ];
  private static readonly EVENT_TYPE_FORMATTER = new EnumFormatter(
    InputEventType,
  );

  protected abstract readonly eventMessageType: TamperedMessageType;
  protected abstract readonly eventOps: Array<Operation<PropertyTreeNode>>;
  protected abstract readonly hierarchyTreeRootId: string;
  protected abstract readonly eventType: InputEventType;
  protected abstract readonly eventTableColumns: string[];

  override async getEntry(index: number): Promise<HierarchyTreeNode> {
    const sql = `SELECT
      ${this.getColumnsForEntryQuery()}
      FROM ${this.getTableName()} AS tbl
      LEFT JOIN ${AbstractInputEventParser.DISPATCH_TABLE} AS dispatch
        ON dispatch.event_id = tbl.event_id
      WHERE tbl.id = ${
        this.entryIndexToRowIdMap[index]
      } ORDER BY tbl.id, dispatch.id;`;

    return this.makeHierarchyTrees(sql).then((trees) => trees[0]);
  }

  override async getAllEntries(): Promise<HierarchyTreeNode[]> {
    const sql = `SELECT
        ${this.getColumnsForEntryQuery()}
      FROM ${this.getTableName()} AS tbl
      LEFT JOIN ${AbstractInputEventParser.DISPATCH_TABLE} AS dispatch
        ON dispatch.event_id = tbl.event_id
      ORDER BY tbl.id, dispatch.id;`;

    return this.makeHierarchyTrees(sql);
  }

  override async customQuery<Q extends CustomQueryType>(
    type: Q,
    entriesRange: EntriesRange,
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    return new VisitableParserCustomQuery(type)
      .visit(CustomQueryType.VSYNCID, async () => {
        return queryVsyncId(
          this.traceProcessor,
          this.getTableName(),
          this.entryIndexToRowIdMap,
          entriesRange,
          AbstractInputEventParser.createVsyncIdQuery,
        );
      })
      .getResult();
  }

  protected override getStdLibModuleName(): string | undefined {
    return 'android.input';
  }

  private getColumnsForEntryQuery(): string {
    return this.eventTableColumns
      .map((c) => 'tbl.' + c)
      .concat(
        AbstractInputEventParser.DISPATCH_COLUMNS.map((c) => 'dispatch.' + c),
      )
      .join(', ');
  }

  private async makeHierarchyTrees(sql: string): Promise<HierarchyTreeNode[]> {
    const queryResult = await this.traceProcessor.query(sql);

    const trees: HierarchyTreeNode[] = [];

    let currEventId: bigint | undefined;
    let currProperties: PropertiesProvider | undefined;
    let currWindows: bigint[] = [];

    for (const it = queryResult.iter({}); it.valid(); it.next()) {
      const eventId = assertBigInt(it.get('event_id'));
      const windowId = assertBigIntOrUndefined(it.get('window_id'));

      if (currEventId !== eventId) {
        if (currProperties) {
          trees.push(this.makeHierarchyTree(currProperties, currWindows));
        }
        currProperties = this.makeEventProperties(it, eventId);
        currEventId = eventId;
        currWindows = [];
      }

      if (windowId !== undefined) {
        currWindows.push(windowId);
      }
    }

    if (currProperties) {
      trees.push(this.makeHierarchyTree(currProperties, currWindows));
    }

    return trees;
  }

  private makeHierarchyTree(
    properties: PropertiesProvider,
    windows: bigint[],
  ): HierarchyTreeNode {
    const rootId = properties.getEagerProperties().id;
    const formatter = new SetFormatters();
    const property = DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeTpProperty(
      rootId,
      'windows',
      windows,
    );
    formatter.apply(property);
    properties.addEagerProperty(property);
    const type = DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeTpProperty(
      rootId,
      'type',
      this.eventType,
    );
    formatter.apply(type);
    properties.addEagerProperty(type);
    type.setFormatter(AbstractInputEventParser.EVENT_TYPE_FORMATTER);
    return new HierarchyTreeBuilderLog()
      .setRoot(properties)
      .setChildren([])
      .build();
  }

  private makeEventProperties(
    row: RowIterator,
    eventId: bigint,
  ): PropertiesProvider {
    const eventArgSetId = assertBigInt(row.get('arg_set_id'));

    const eagerProperties = new PropertyTreeBuilderFromQueryRow()
      .setData(row)
      .setColumns(this.eventTableColumns)
      .setRootId(this.hierarchyTreeRootId)
      .setRootName('entry')
      .build();

    const lazyPropertiesStrategy = async () => {
      const props = new PropertyTreeBuilderFromProto()
        .setData({event: null, dispatchEvents: []})
        .setRootId(this.hierarchyTreeRootId)
        .setRootName('entry')
        .build();
      await this.updateInputEvent(Number(eventArgSetId), props);
      await this.updateDispatchEvents(Number(eventId), props);
      return props;
    };

    const timestampStrategy: MakeTimestampStrategyType = (valueNs: bigint) => {
      return this.timestampConverter.makeTimestampFromBootTimeNs(valueNs);
    };

    const dispatchEventOps = [
      ...this.baseDispatchEventOps,
      new RenameProperty('eventTimeNanos', 'kernelTimeNanos'),
      new TransformToTimestamp(['kernelTime', 'downTime'], timestampStrategy),
    ];

    return new PropertiesProviderBuilder()
      .setEagerProperties(eagerProperties)
      .setCommonOperations(this.eventOps)
      .setLazyOperations(dispatchEventOps)
      .setLazyPropertiesStrategy(lazyPropertiesStrategy)
      .build();
  }

  private async updateInputEvent(argSetId: number, props: PropertyTreeNode) {
    const event = assertDefined(props.getChildByName('event'));
    const argsData = await queryArgs(this.traceProcessor, argSetId);
    const inputEvent = new PropertyTreeBuilderFromArgs()
      .setData(argsData.iter({}))
      .setRootId(event.id)
      .setRootName(event.name)
      .setUseRootIdWithoutChange(true)
      .setRootMessageType(this.eventMessageType)
      .build();
    props.addOrReplaceChild(inputEvent);
  }

  private async updateDispatchEvents(
    eventId: number,
    props: PropertyTreeNode,
  ): Promise<void> {
    const sql = `
        SELECT d.id,
               args.key,
               args.value_type,
               args.int_value,
               args.string_value,
               args.real_value
        FROM ${AbstractInputEventParser.DISPATCH_TABLE} AS d
                 INNER JOIN args ON d.arg_set_id = args.arg_set_id
        WHERE d.event_id = ${eventId}
        ORDER BY d.id;
    `;
    const result = await this.traceProcessor.query(sql);
    const iter = result.iter({});

    let prevId: bigint | undefined;
    const rowValidityCheck = (row: RowIterator) => {
      const rowId = assertBigInt(row.get('id'));
      const isValid = prevId === undefined || rowId === prevId;
      prevId = rowId;
      return isValid;
    };

    const dispatchEvents = assertDefined(
      props.getChildByName('dispatchEvents'),
    );
    while (iter.valid()) {
      const existingChildren = dispatchEvents.getAllChildren().length;
      const eventIndex = existingChildren.toString();
      const dispatchEvent = new PropertyTreeBuilderFromArgs()
        .setData(iter)
        .setRootId(`${dispatchEvents.id}.${eventIndex}`)
        .setRootName(eventIndex)
        .setUseRootIdWithoutChange(true)
        .setRootMessageType(assertDefined(this.dispatchEventField.resolve()))
        .setRowValidityCheck(rowValidityCheck)
        .build();
      dispatchEvents.addOrReplaceChild(dispatchEvent);
    }
  }

  // Use a custom sql query to get the vsync_id of the first dispatch
  // entry associated with an input event, if any.
  private static createVsyncIdQuery(
    tableName: string,
    minRowId: number,
    maxRowId: number,
  ): string {
    return `
      SELECT
        tbl.id AS id,
        d.vsync_id as int_value,
        'int' as value_type
      FROM ${tableName} AS tbl
      INNER JOIN ${AbstractInputEventParser.DISPATCH_TABLE} AS d
          ON tbl.event_id = d.event_id
      WHERE
        tbl.id BETWEEN ${minRowId} AND ${maxRowId}
      GROUP BY tbl.id
      ORDER BY tbl.id, d.id;
    `;
  }
}

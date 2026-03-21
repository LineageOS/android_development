/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {assertBigIntOrUndefined, assertDefined, assertString,} from '@common/assert';
import {MakeTimestampStrategyType} from '@common/time/time';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {getLogger, Logger} from '@compat/logging';
import {HierarchyTreeBuilderLog} from '@parsers/helpers/hierarchy_tree_builder_log';
import {PropertyTreeBuilderFromArgs} from '@parsers/helpers/property_tree_builder_from_args';
import {PropertyTreeBuilderFromProto} from '@parsers/helpers/property_tree_builder_from_proto';
import {PropertyTreeBuilderFromQueryRow} from '@parsers/helpers/property_tree_builder_from_query_row';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {AddDefaults} from '@parsers/operations/add_defaults';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {TransformToTimestamp} from '@parsers/operations/transform_to_timestamp';
import {TranslateIntDef} from '@parsers/operations/translate_intdef';
import {AbstractParser} from '@parsers/perfetto/abstract_parser';
import {queryArgs} from '@parsers/perfetto/query_helpers';
import {TransformDuration} from '@parsers/transitions/operations/transform_duration';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';
import {ColumnType, RowIterator} from '@trace_processor/query_result';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {EnumFormatter, TIMESTAMP_NODE_FORMATTER, UPPER_CASE_FORMATTER,} from '@trace/formatters';
import {Registry} from '@trace/proto_utils/tampered_message_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {Operation} from '@tree_node/operation';
import {PropertiesProvider} from '@tree_node/properties_provider';
import {PropertiesProviderBuilder} from '@tree_node/properties_provider_builder';
import {PropertyFormatter, PropertyTreeNode,} from '@tree_node/property_tree_node';

import {TransitionType} from './transition_type';

/**
 * Parser for Transitions Perfetto traces.
 */
export class ParserTransitions extends AbstractParser<HierarchyTreeNode> {
  private readonly transitionField = assertDefined(
    Registry.getInstance().getType('perfetto.protos.TracePacket'),
  ).fields['shellTransition'];
  private static readonly EAGER_COLUMNS = [
    'transition_id',
    'arg_set_id',
    'transition_type',
    'send_time_ns',
    'dispatch_time_ns',
    'wm_abort_time_ns',
    'shell_abort_time_ns',
    'finish_time_ns',
    'merge_time_ns',
    'create_time_ns',
    'duration_ns',
    'handler',
    'status',
    'flags',
  ];
  private static readonly EAGER_TIMESTAMP_PROPERTIES = [
    'wmAbortTimeNs',
    'shellAbortTimeNs',
    'sendTimeNs',
    'dispatchTimeNs',
    'finishTimeNs',
    'mergeTimeNs',
    'createTimeNs',
  ];
  private static readonly LAZY_TIMESTAMP_PROPERTIES = [
    'wmAbortTimeNs',
    'shellAbortTimeNs',
    'createTimeNs',
    'sendTimeNs',
    'finishTimeNs',
    'startingWindowRemoveTimeNs',
    'dispatchTimeNs',
    'mergeRequestTimeNs',
    'mergeTimeNs',
  ];
  private static readonly TRANSFORM_DURATION_OPERATION =
    new TransformDuration();
  private readonly translateIntDefOperation = new TranslateIntDef(
    this.transitionField,
  );
  private readonly addDefaultsOperation = new AddDefaults(
    this.transitionField,
    ['type', 'changes'],
  );
  private static readonly TRANSITION_TYPE_FORMATTER = new EnumFormatter(
    TransitionType,
  );

  private handlerIdToName: {[id: number]: string} | undefined = undefined;

  static async createInstance(
    traceFile: TraceFile,
    traceProcessor: TraceProcessor,
    timestampConverter: ParserTimestampConverter,
    traceGeometryData: TraceGeometryData,
  ): Promise<Array<AbstractParser<HierarchyTreeNode>>> {
    return [
      new ParserTransitions(
        traceFile,
        traceProcessor,
        timestampConverter,
        traceGeometryData,
      ),
    ];
  }

  constructor(
    traceFile: TraceFile,
    traceProcessor: TraceProcessor,
    timestampConverter: ParserTimestampConverter,
    traceGeometryData: TraceGeometryData,
    logger: Logger = getLogger('ParserTransitions'),
  ) {
    super(
      traceFile,
      traceProcessor,
      timestampConverter,
      traceGeometryData,
      logger,
    );
  }

  override getTraceType(): TraceType {
    return TraceType.TRANSITION;
  }

  override async getEntry(index: number): Promise<HierarchyTreeNode> {
    const columns = ParserTransitions.EAGER_COLUMNS.map(
      (column) => `transitions.${column}`,
    ).join(', ');
    const sql =
      `SELECT ${columns} FROM ${this.getTableName()} as transitions` +
      ` WHERE transitions.id = ${this.entryIndexToRowIdMap[index]};`;
    return this.makeHierarchyTrees(sql).then((trees) =>
      assertDefined(trees[0]),
    );
  }

  override async getAllEntries(): Promise<
    Array<HierarchyTreeNode | undefined>
  > {
    const columns = ParserTransitions.EAGER_COLUMNS.map(
      (column) => `transitions.${column}`,
    ).join(', ');
    const sql = `SELECT ${columns} FROM ${this.getTableName()} as transitions ORDER BY transitions.ts;`;
    return this.makeHierarchyTrees(sql);
  }

  protected override getTableName(): string {
    return 'window_manager_shell_transitions';
  }

  protected override getStdLibModuleName(): string {
    return 'android.winscope.transitions';
  }

  private async makeHierarchyTrees(
    sql: string,
  ): Promise<Array<HierarchyTreeNode | undefined>> {
    if (this.handlerIdToName === undefined) {
      await this.updateHandlers();
    }
    const queryResult = await this.traceProcessor.query(sql);
    const trees = [];
    for (const it = queryResult.iter({}); it.valid(); it.next()) {
      trees.push(await this.makeHierarchyTree(it));
    }
    return trees;
  }

  private async updateHandlers() {
    const handlers = await this.queryHandlers();
    this.handlerIdToName = {};
    handlers.forEach(
      (it) => (assertDefined(this.handlerIdToName)[it.id] = it.name),
    );
  }

  private async queryHandlers(): Promise<TransitionHandler[]> {
    const sql =
      'SELECT handler_id, handler_name FROM window_manager_shell_transition_handlers;';
    const result = await this.traceProcessor.query(sql);

    const handlers: TransitionHandler[] = [];
    for (const it = result.iter({}); it.valid(); it.next()) {
      const handlerid = assertBigIntOrUndefined(it.get('handler_id'));
      if (handlerid === undefined) continue;
      handlers.push({
        id: Number(handlerid),
        name: assertString(it.get('handler_name')),
      });
    }

    return handlers;
  }

  private async makeHierarchyTree(
    row: RowIterator,
  ): Promise<HierarchyTreeNode | undefined> {
    try {
      const transition = await this.makeTransitionsPropertiesProvider(row);
      return new HierarchyTreeBuilderLog()
        .setRoot(transition)
        .setChildren([])
        .build();
    } catch (e) {
      this.logger.error((e as Error).message);
      return undefined;
    }
  }

  private async makeTransitionsPropertiesProvider(
    transitionRow: RowIterator,
  ): Promise<PropertiesProvider> {
    const eagerProperties = await this.makeEagerPropertiesTree(transitionRow);

    const builder = new PropertiesProviderBuilder()
      .setEagerProperties(eagerProperties)
      .setEagerOperations(this.getEagerOperations());

    const argSetId = transitionRow.get('arg_set_id') ?? undefined;
    if (argSetId !== undefined) {
      builder
        .setLazyPropertiesStrategy(this.makeLazyPropertiesStrategy(argSetId))
        .setLazyOperations(this.getLazyOperations());
    }

    return builder.build();
  }

  private async makeEagerPropertiesTree(
    transitionRow: RowIterator,
  ): Promise<PropertyTreeNode> {
    const eagerProperties = new PropertyTreeBuilderFromQueryRow()
      .setData(transitionRow)
      .setColumns(ParserTransitions.EAGER_COLUMNS)
      .setRootId('TransitionTraceEntry')
      .setRootName('Transition')
      .build();

    const participants = await this.makeParticipants(transitionRow);
    eagerProperties.addOrReplaceChild(
      assertDefined(participants.getChildByName('layers')),
    );
    eagerProperties.addOrReplaceChild(
      assertDefined(participants.getChildByName('windows')),
    );
    return eagerProperties;
  }

  private async makeParticipants(
    transitionRow: RowIterator,
  ): Promise<PropertyTreeNode> {
    const transitionId = assertDefined(
      transitionRow.get('transition_id'),
      () => 'transition requires non-null id',
    );

    const participantsSql =
      'SELECT DISTINCT window_id, layer_id from android_window_manager_shell_transition_participants' +
      ` WHERE transition_id = ${transitionId}`;
    const participantsRes = await this.traceProcessor.query(participantsSql);

    const layers = [];
    const windows = [];
    for (const it = participantsRes.iter({}); it.valid(); it.next()) {
      const layer = it.get('layer_id') ?? undefined;
      if (layer !== undefined) {
        layers.push(layer);
      }
      const window = it.get('window_id') ?? undefined;
      if (window !== undefined) {
        windows.push(window);
      }
    }
    return new PropertyTreeBuilderFromProto()
      .setData({layers, windows})
      .setRootId('TransitionTraceEntry')
      .setRootName('Transition')
      .build();
  }

  private getEagerOperations(): Array<Operation<PropertyTreeNode>> {
    const transformToTimestampEager = new TransformToTimestamp(
      ParserTransitions.EAGER_TIMESTAMP_PROPERTIES,
      ParserTransitions.makeTimestampStrategy(this.timestampConverter),
    );

    const customFormattersEager = new Map<string, PropertyFormatter>([
      ['transitionType', ParserTransitions.TRANSITION_TYPE_FORMATTER],
      ['handler', new EnumFormatter(assertDefined(this.handlerIdToName))],
      ['status', UPPER_CASE_FORMATTER],
      ['durationNs', TIMESTAMP_NODE_FORMATTER],
    ]);

    return [
      transformToTimestampEager,
      ParserTransitions.TRANSFORM_DURATION_OPERATION,
      new SetFormatters(this.transitionField, customFormattersEager),
      this.translateIntDefOperation,
    ];
  }

  private getLazyOperations(): Array<Operation<PropertyTreeNode>> {
    const transformToTimestamp = new TransformToTimestamp(
      ParserTransitions.LAZY_TIMESTAMP_PROPERTIES,
      ParserTransitions.makeTimestampStrategy(this.timestampConverter),
    );

    const customFormatters = new Map<string, PropertyFormatter>([
      ['type', ParserTransitions.TRANSITION_TYPE_FORMATTER],
      ['mode', ParserTransitions.TRANSITION_TYPE_FORMATTER],
      ['handler', new EnumFormatter(assertDefined(this.handlerIdToName))],
    ]);

    return [
      this.addDefaultsOperation,
      transformToTimestamp,
      new SetFormatters(this.transitionField, customFormatters),
      this.translateIntDefOperation,
    ];
  }

  private makeLazyPropertiesStrategy(argSetId: ColumnType | null) {
    return async () => {
      const argsData = await queryArgs(this.traceProcessor, Number(argSetId));

      return new PropertyTreeBuilderFromArgs()
        .setData(argsData.iter({}))
        .setRootId('TransitionTraceEntry')
        .setRootName('Transition')
        .setRootMessageType(assertDefined(this.transitionField.resolve()))
        .build();
    };
  }

  private static makeTimestampStrategy(
    timestampConverter: ParserTimestampConverter,
  ): MakeTimestampStrategyType {
    return (valueNs: bigint) => {
      return timestampConverter.makeTimestampFromBootTimeNs(valueNs);
    };
  }
}

interface TransitionHandler {
  id: number;
  name: string;
}

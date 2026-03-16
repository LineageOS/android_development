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

import {assertBigInt, assertBigIntOrUndefined, assertDefined, assertString,} from '@common/assert';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {PerfettoLayerState} from '@compat/protobuf';
import {HierarchyTreeBuilderLog} from '@parsers/helpers/hierarchy_tree_builder_log';
import {PropertyTreeBuilderFromArgs} from '@parsers/helpers/property_tree_builder_from_args';
import {PropertyTreeBuilderFromProto} from '@parsers/helpers/property_tree_builder_from_proto';
import {PropertyTreeBuilderFromQueryRow} from '@parsers/helpers/property_tree_builder_from_query_row';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {AddDefaults} from '@parsers/operations/add_defaults';
import {SetFormatters} from '@parsers/operations/set_formatters';
import {AbstractParser} from '@parsers/perfetto/abstract_parser';
import {getDistinctValues, queryArgs, queryVsyncId,} from '@parsers/perfetto/query_helpers';
import {CustomQueryParamTypeMap, CustomQueryParserResultTypeMap, CustomQueryType, VisitableParserCustomQuery,} from '@trace_api/custom_query';
import {EntriesRange} from '@trace_api/index_types';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';
import {RowIterator} from '@trace_processor/query_result';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {EnumFormatter, FixedStringFormatter} from '@trace/formatters';
import {Registry, TamperedMessageType, TamperedProtoField,} from '@trace/proto_utils/tampered_message_type';
import {TransactionColumnType} from '@trace/transactions/transaction_column_type';
import {TransactionType} from '@trace/transactions/transaction_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {Operation} from '@tree_node/operation';
import {PropertiesProvider} from '@tree_node/properties_provider';
import {PropertiesProviderBuilder} from '@tree_node/properties_provider_builder';
import {PropertyFormatter, PropertyTreeNode,} from '@tree_node/property_tree_node';

export class ParserTransactions extends AbstractParser<HierarchyTreeNode> {
  private readonly transactionsTraceEntryField = (
    Registry.getInstance().getType(
      'perfetto.protos.TracePacket',
    ) as TamperedMessageType
  ).fields['surfaceflingerTransactions'];

  private static readonly TRANSACTION_COLUMNS = [
    'transaction_id',
    'pid',
    'uid',
    'process_name',
    'layer_id',
    'display_id',
    'flags_id',
    'transaction_type',
  ];

  private static readonly LAYER_STATE_FLAGS = Object.keys(
    PerfettoLayerState.Flags,
  ).reduce(
    (acc, key) => {
      const value =
        PerfettoLayerState.Flags[key as keyof typeof PerfettoLayerState.Flags];
      acc[value] = key;
      return acc;
    },
    {} as {[key: number]: string},
  );

  static async createInstance(
    traceFile: TraceFile,
    traceProcessor: TraceProcessor,
    timestampConverter: ParserTimestampConverter,
    traceGeometryData: TraceGeometryData,
  ): Promise<Array<AbstractParser<HierarchyTreeNode>>> {
    return [
      new ParserTransactions(
        traceFile,
        traceProcessor,
        timestampConverter,
        traceGeometryData,
      ),
    ];
  }

  private flags: {[key: number]: string} | undefined;

  override getTraceType(): TraceType {
    return TraceType.TRANSACTIONS;
  }

  override async getEntry(index: number): Promise<HierarchyTreeNode> {
    const sql = `SELECT
      sfs.id as snapshot_id,
      sfs.vsync_id,
      sft.transaction_id,
      sft.pid,
      sft.uid,
      sft.process_name,
      sft.layer_id,
      sft.display_id,
      sft.flags_id,
      sft.transaction_type,
      sft.arg_set_id
      FROM ${this.getTableName()} AS sfs
      LEFT JOIN  ${this.getProcessedTransactionTableName()} AS sft
        ON sfs.id = sft.snapshot_id
      WHERE sfs.id = ${this.entryIndexToRowIdMap[index]}`;

    return this.makeHierarchyTrees(sql).then((trees) => trees[0]);
  }

  override async getAllEntries(): Promise<HierarchyTreeNode[]> {
    const sql = `SELECT
      sfs.id as snapshot_id,
      sfs.vsync_id,
      sft.transaction_id,
      sft.pid,
      sft.uid,
      sft.process_name,
      sft.layer_id,
      sft.display_id,
      sft.flags_id,
      sft.transaction_type,
      sft.arg_set_id
      FROM ${this.getTableName()} AS sfs
      LEFT JOIN  ${this.getProcessedTransactionTableName()} AS sft
        ON sfs.id = sft.snapshot_id
      ORDER BY sfs.id`;

    return this.makeHierarchyTrees(sql);
  }

  override async customQuery<Q extends CustomQueryType>(
    type: Q,
    entriesRange: EntriesRange,
    param?: CustomQueryParamTypeMap[Q],
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    return new VisitableParserCustomQuery(type)
      .visit(CustomQueryType.VSYNCID, async () => {
        return queryVsyncId(
          this.traceProcessor,
          this.getTableName(),
          this.entryIndexToRowIdMap,
          entriesRange,
          ParserTransactions.createVsyncIdQuery,
        );
      })
      .visit(CustomQueryType.LOG_TABLE_FILTER_VALUES, async () => {
        let tableName = this.getProcessedTransactionTableName();
        let columns: string[];
        switch (param) {
          case TransactionColumnType.TRANSACTION_ID:
            columns = ['transaction_id'];
            break;
          case TransactionColumnType.VSYNC_ID:
            tableName = this.getTableName();
            columns = ['vsync_id'];
            break;
          case TransactionColumnType.PID:
            columns = ['pid'];
            break;
          case TransactionColumnType.UID:
            columns = ['uid'];
            break;
          case TransactionColumnType.PROCESS:
            columns = ['process_name'];
            break;
          case TransactionColumnType.TRANSACTION_TYPE:
            columns = ['transaction_type'];
            break;
          case TransactionColumnType.LAYER_OR_DISPLAY_ID:
            columns = ['layer_id', 'display_id'];
            break;
          case TransactionColumnType.FLAGS:
            tableName = this.getFlagTableName();
            columns = ['flag'];
            break;

          default:
            throw new Error('unexpected transaction column type requested');
        }
        return getDistinctValues(this.traceProcessor, tableName, columns);
      })
      .getResult();
  }

  protected override async preProcessTrace(): Promise<void> {
    const transactionTable = this.getTransactionTableName();
    const sql = `
CREATE PERFETTO TABLE ${this.getProcessedTransactionTableName()} AS
  WITH process_matches AS (
  SELECT
      sft.id as row_id,
      processes.name AS process_name,
      0 AS match_priority
  FROM ${transactionTable} AS sft
  INNER JOIN process AS processes
      ON sft.pid = processes.pid AND sft.uid = processes.uid
  WHERE
      (sft.pid IS NOT NULL AND sft.pid != 0)
      AND (sft.uid IS NOT NULL AND sft.uid != 0)

  UNION ALL

  SELECT
      sft.id as row_id,
      processes.name AS process_name,
      1 AS match_priority
  FROM ${transactionTable} AS sft
  INNER JOIN process AS processes
      ON sft.pid = processes.pid
  WHERE
      (sft.uid IS NULL OR sft.uid = 0)
      AND (sft.pid IS NOT NULL AND sft.pid != 0)

  UNION ALL

  SELECT
      sft.id as row_id,
      processes.name AS process_name,
      2 AS match_priority
  FROM ${transactionTable} AS sft
  INNER JOIN process AS processes
      ON sft.uid = processes.uid
  WHERE
      (sft.pid IS NULL OR sft.pid = 0)
      AND (sft.uid IS NOT NULL AND sft.uid != 0)
),
ranked_process_matches AS (
    SELECT
        row_id,
        process_name,
        match_priority,
        COUNT(*) OVER (PARTITION BY row_id, match_priority) as num_matches_at_priority,
        ROW_NUMBER() OVER (PARTITION BY row_id ORDER BY match_priority ASC) as row_number
    FROM process_matches
)
SELECT
    sft.snapshot_id,
    sft.transaction_id,
    sft.pid,
    sft.uid,
    CASE
        WHEN rpm.num_matches_at_priority > 1 THEN NULL
        ELSE rpm.process_name
    END AS process_name,
    sft.layer_id,
    sft.display_id,
    sft.flags_id,
    sft.transaction_type,
    sft.arg_set_id
FROM ${transactionTable} AS sft
LEFT JOIN ranked_process_matches AS rpm
    ON sft.id = rpm.row_id AND rpm.row_number = 1;`;
    await this.traceProcessor.query(sql);
  }

  protected override getTableName(): string {
    return 'surfaceflinger_transactions';
  }

  protected override getStdLibModuleName(): string | undefined {
    return 'android.winscope.surfaceflinger';
  }

  private getProcessedTransactionTableName(): string {
    return '__transaction_with_process';
  }

  private getFlagTableName(): string {
    return 'android_surfaceflinger_transaction_flag';
  }

  private getTransactionTableName() {
    return 'android_surfaceflinger_transaction';
  }

  private async makeHierarchyTrees(sql: string): Promise<HierarchyTreeNode[]> {
    const queryResult = await this.traceProcessor.query(sql);

    if (this.flags === undefined) {
      await this.updateFlags();
    }

    const trees: HierarchyTreeNode[] = [];

    let currSnapshotId: bigint | undefined;
    let currSnapshot: PropertiesProvider | undefined;
    let currTransactions: PropertiesProvider[] = [];

    for (const it = queryResult.iter({}); it.valid(); it.next()) {
      const snapshotId = assertBigInt(it.get('snapshot_id'));

      if (currSnapshotId !== snapshotId) {
        if (currSnapshot) {
          trees.push(this.makeHierarchyTree(currSnapshot, currTransactions));
        }
        currSnapshot = this.makeSnapshotProperties(it);
        currSnapshotId = snapshotId;
        currTransactions = [];
      }

      if (it.get('transaction_type')) {
        // has associated transaction
        currTransactions.push(
          this.makeTransactionPropertiesProvider(it, currTransactions.length),
        );
      }
    }

    if (currSnapshot) {
      trees.push(this.makeHierarchyTree(currSnapshot, currTransactions));
    }

    return trees;
  }

  private async updateFlags() {
    const flags = await this.queryFlags();
    this.flags = {};
    flags.forEach(
      (flags, flagId) => (assertDefined(this.flags)[flagId] = flags),
    );
  }

  private async queryFlags(): Promise<Map<number, string>> {
    const sql = `SELECT flags_id, flag FROM ${this.getFlagTableName()};`;
    const result = await this.traceProcessor.query(sql);

    const flags = new Map<number, string>();
    for (const it = result.iter({}); it.valid(); it.next()) {
      const flagId = Number(assertBigInt(it.get('flags_id')));
      const flag = assertString(it.get('flag'));
      if (flags.has(flagId)) {
        flags.set(flagId, flags.get(flagId) + ' | ' + flag);
      } else {
        flags.set(flagId, flag);
      }
    }
    return flags;
  }

  private makeHierarchyTree(
    snapshot: PropertiesProvider,
    transactions: PropertiesProvider[],
  ): HierarchyTreeNode {
    return new HierarchyTreeBuilderLog()
      .setRoot(snapshot)
      .setChildren(transactions)
      .build();
  }

  private makeSnapshotProperties(row: RowIterator) {
    const vsyncId = assertBigInt(row.get('vsync_id'));
    const entryProperties = new PropertyTreeBuilderFromProto()
      .setData({vsyncId})
      .setRootId('TransactionsTraceEntry')
      .setRootName('entry')
      .build();
    return new PropertiesProviderBuilder()
      .setEagerProperties(entryProperties)
      .build();
  }

  private makeTransactionPropertiesProvider(
    row: RowIterator,
    index: number,
  ): PropertiesProvider {
    const argSetId = assertBigIntOrUndefined(
      row.get('arg_set_id') ?? undefined,
    );
    const transactionType = assertString(row.get('transaction_type'));
    const field = this.getField(transactionType, argSetId);

    const eagerProperties = new PropertyTreeBuilderFromQueryRow()
      .setData(row)
      .setColumns(ParserTransactions.TRANSACTION_COLUMNS)
      .setRootId(index)
      .setRootName(field?.type?.split('.').pop() ?? transactionType)
      .build();

    const flagsIdFormatter = new EnumFormatter(assertDefined(this.flags), '0');
    const builder = new PropertiesProviderBuilder()
      .setEagerProperties(eagerProperties)
      .setEagerOperations([
        new SetFormatters(
          undefined,
          new Map<string, PropertyFormatter>([['flagsId', flagsIdFormatter]]),
        ),
      ]);

    if (argSetId !== undefined && field !== undefined) {
      const customFormatters = new Map<string, PropertyFormatter>([
        ['flags', new EnumFormatter(ParserTransactions.LAYER_STATE_FLAGS)],
      ]);
      const flagsId = eagerProperties.getChildByName('flagsId');
      if (flagsId !== undefined) {
        const whatTranslation = flagsIdFormatter.format(flagsId);
        customFormatters.set('what', new FixedStringFormatter(whatTranslation));
      }
      const lazyOperations: Array<Operation<PropertyTreeNode>> = [
        new AddDefaults(field),
        new SetFormatters(field, customFormatters),
      ];

      const lazyPropertiesStrategy = async () => {
        const argsData = await queryArgs(this.traceProcessor, Number(argSetId));

        return new PropertyTreeBuilderFromArgs()
          .setData(argsData.iter({}))
          .setRootId(index)
          .setRootName(assertDefined(field).name)
          .setRootMessageType(assertDefined(field?.resolve()))
          .build();
      };

      builder
        .setLazyOperations(lazyOperations)
        .setLazyPropertiesStrategy(lazyPropertiesStrategy);
    }

    return builder.build();
  }

  private getField(
    transactionType: string,
    argSetId: bigint | undefined,
  ): TamperedProtoField | undefined {
    let field: TamperedProtoField | undefined;
    const entryProtoType = assertDefined(
      this.transactionsTraceEntryField.resolve(),
    );
    switch (transactionType) {
      case TransactionType.DISPLAY_ADDED:
      case TransactionType.DISPLAY_CHANGED:
        field = entryProtoType.fields['addedDisplays'];
        break;
      case TransactionType.LAYER_ADDED:
        field = entryProtoType.fields['addedLayers'];
        break;
      case TransactionType.LAYER_CHANGED:
        field = assertDefined(
          entryProtoType.fields['transactions']?.resolve()?.fields[
            'layerChanges'
          ],
        );
        break;
      default:
        if (argSetId !== undefined) {
          throw new Error('unexpected transaction type found with arg set id');
        }
    }
    return field;
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
        vsync_id as int_value,
        'uint' as value_type
      FROM ${tableName} AS tbl
      WHERE
        tbl.id BETWEEN ${minRowId} AND ${maxRowId}
      GROUP BY tbl.id
      ORDER BY tbl.id;
    `;
  }
}

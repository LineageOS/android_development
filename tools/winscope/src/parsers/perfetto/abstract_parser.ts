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

import {assertBigInt, assertTrue} from '@common/assert';
import {NOT_IMPLEMENTED_ERROR} from '@common/errors';
import {INVALID_TIME_NS, Timestamp} from '@common/time/time';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {getLogger, Logger} from '@compat/logging';
import {TraceGeometryData} from '@parsers/helpers/trace_geometry_data';
import {CoarseVersion} from '@trace_api/coarse_version';
import {CustomQueryParamTypeMap, CustomQueryParserResultTypeMap, CustomQueryType,} from '@trace_api/custom_query';
import {FileReader} from '@trace_api/file_reader';
import {AbsoluteEntryIndex, EntriesRange} from '@trace_api/index_types';
import {Parser} from '@trace_api/parser';
import {TraceFile} from '@trace_api/trace_file';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {QueryResult, QueryResults} from '@trace_processor/query_result';
import {RawDataQueryResult} from '@trace_processor/raw_data_query_result';
import {TraceProcessor} from '@trace_processor/trace_processor';
import {RectsForTrace} from '@tree_node/rect_extractor_result';

export abstract class AbstractParser<T> implements Parser<T>, FileReader {
  protected readonly checkInvalidTs: boolean = false;

  protected traceProcessor: TraceProcessor;
  protected realToBootTimeOffsetNs?: bigint;
  protected timestampConverter: ParserTimestampConverter;
  protected entryIndexToRowIdMap: number[] = [];
  protected preProcessTrace?(): Promise<void>;
  protected traceGeometryData: TraceGeometryData;
  protected traceFile: TraceFile;

  private lengthEntries = 0;
  private bootTimeTimestampsNs: bigint[] = [];
  private timestamps: Timestamp[] | undefined;

  constructor(
    traceFile: TraceFile,
    traceProcessor: TraceProcessor,
    timestampConverter: ParserTimestampConverter,
    traceGeometryData: TraceGeometryData,
    protected logger: Logger = getLogger('AbstractParser'),
  ) {
    this.traceFile = traceFile;
    this.traceProcessor = traceProcessor;
    this.timestampConverter = timestampConverter;
    this.traceGeometryData = traceGeometryData;
  }

  onDestroy() {
    // do nothing
  }

  getFiles(): TraceFile[] {
    return [this.traceFile];
  }

  isPerfetto(): boolean {
    return true;
  }

  async parse() {
    const module = this.getStdLibModuleName();
    if (module) {
      await this.traceProcessor.query(`INCLUDE PERFETTO MODULE ${module};`);
    }

    if (this.preProcessTrace) {
      await this.preProcessTrace();
    }

    this.entryIndexToRowIdMap = await this.buildEntryIndexToRowIdMap();
    const rowBootTimeTimestampsNs = await this.queryRowBootTimeTimestamps();
    this.bootTimeTimestampsNs = this.entryIndexToRowIdMap.map(
      (rowId) => rowBootTimeTimestampsNs[rowId],
    );
    this.lengthEntries = this.bootTimeTimestampsNs.length;
    assertTrue(
      this.lengthEntries > 0,
      () =>
        `Perfetto trace has no ${TRACE_INFO[this.getTraceType()].name} entries`,
    );

    let lastNonZeroTimestamp: bigint | undefined;
    for (let i = this.bootTimeTimestampsNs.length - 1; i >= 0; i--) {
      if (this.bootTimeTimestampsNs[i] !== INVALID_TIME_NS) {
        lastNonZeroTimestamp = this.bootTimeTimestampsNs[i];
        break;
      }
    }

    this.realToBootTimeOffsetNs =
      lastNonZeroTimestamp !== undefined
        ? await this.queryRealToBootTimeOffset(lastNonZeroTimestamp)
        : INVALID_TIME_NS;
  }

  createTimestamps() {
    this.timestamps = this.bootTimeTimestampsNs.map((ns) => {
      if (ns === INVALID_TIME_NS) {
        return this.timestampConverter.makeZeroTimestamp();
      }
      return this.timestampConverter.makeTimestampFromBootTimeNs(ns);
    });
  }

  getLengthEntries(): number {
    return this.lengthEntries;
  }

  getTimestamps(): Timestamp[] {
    if (!this.timestamps) {
      throw NOT_IMPLEMENTED_ERROR;
    }
    return this.timestamps;
  }

  getCoarseVersion(): CoarseVersion {
    return CoarseVersion.LATEST;
  }

  getQueryResults(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    entriesRange: EntriesRange,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    queryRawData: boolean,
  ): Promise<QueryResults<QueryResult | RawDataQueryResult>> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  customQuery<Q extends CustomQueryType>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type: Q,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    entriesRange: EntriesRange,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    param?: CustomQueryParamTypeMap[Q],
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  async getRectsMap(): Promise<RectsForTrace | undefined> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  getDescriptors(): string[] {
    return [this.traceFile.getDescriptor()];
  }

  getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  getAllEntries(): Promise<Array<T | undefined>> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  getRangeOfEntries(_: EntriesRange): Promise<T[]> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  protected async buildEntryIndexToRowIdMap(): Promise<AbsoluteEntryIndex[]> {
    const sqlRowIdAndTimestamp = `
     SELECT DISTINCT tbl.id AS id, tbl.ts
     FROM ${this.getTableName()} AS tbl
     ORDER BY tbl.ts;
   `;
    const result = await this.traceProcessor.query(sqlRowIdAndTimestamp);
    const entryIndexToRowId: AbsoluteEntryIndex[] = [];
    for (const it = result.iter({}); it.valid(); it.next()) {
      const rowId = Number(it.get('id'));
      entryIndexToRowId.push(rowId);
    }
    return entryIndexToRowId;
  }

  protected async queryRowBootTimeTimestamps(): Promise<bigint[]> {
    const sql = this.checkInvalidTs
      ? `SELECT ts, has_invalid_elapsed_ts FROM ${this.getTableName()} ORDER BY id;`
      : `SELECT ts FROM ${this.getTableName()} ORDER BY id;`;
    const result = await this.traceProcessor.query(sql);
    const timestamps: bigint[] = [];
    for (const it = result.iter({}); it.valid(); it.next()) {
      const ts =
        this.checkInvalidTs && Boolean(it.get('has_invalid_elapsed_ts'))
          ? INVALID_TIME_NS
          : assertBigInt(it.get('ts'));
      timestamps.push(ts);
    }
    return timestamps;
  }

  // Query the real-to-boot time offset at the specified time
  // (timestamp parameter).
  // The timestamp parameter must be a non-zero timestamp queried/provided by
  // TP, otherwise the TO_REALTIME() SQL function might return invalid values.
  private async queryRealToBootTimeOffset(bootTimeNs: bigint): Promise<bigint> {
    const sql = `
      SELECT TO_REALTIME(${bootTimeNs}) as realtime;
    `;

    const result = await this.traceProcessor.query(sql);
    assertTrue(
      result.numRows() === 1,
      () => 'Failed to query realtime timestamp',
    );

    const real = assertBigInt(result.iter({}).get('realtime'));
    return real - bootTimeNs;
  }

  protected getStdLibModuleName(): string | undefined {
    return undefined;
  }

  protected async getEntryFromRange(index: number): Promise<T> {
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

  protected abstract getTableName(): string;
  abstract getEntry(index: AbsoluteEntryIndex): Promise<T>;
  abstract getTraceType(): TraceType;
}

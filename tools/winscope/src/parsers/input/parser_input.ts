/*
 * Copyright (C) 2024 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertDefined, assertTrue} from '@common/assert';
import {NOT_IMPLEMENTED_ERROR} from '@common/errors';
import {Timestamp} from '@common/time/time';
import {CoarseVersion} from '@trace_api/coarse_version';
import {CustomQueryParserResultTypeMap, CustomQueryType, VisitableParserCustomQuery,} from '@trace_api/custom_query';
import {FileReader} from '@trace_api/file_reader';
import {EntriesRange} from '@trace_api/index_types';
import {Parser} from '@trace_api/parser';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';
import {QueryResult, QueryResults} from '@trace_processor/query_result';
import {RawDataQueryResult} from '@trace_processor/raw_data_query_result';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

type OriginalTraceIndex = number;

export class ParserInput implements Parser<HierarchyTreeNode>, FileReader {
  private readonly parserKey: Parser<HierarchyTreeNode> | undefined;
  private readonly parserMotion: Parser<HierarchyTreeNode> | undefined;
  private readonly files: TraceFile[];
  private readonly descriptors: string[];
  private mergedEntryIndexMap:
    | Array<[OriginalTraceIndex, TraceType]>
    | undefined;
  private timestamps: Timestamp[] | undefined;

  constructor(
    parserKey: Parser<HierarchyTreeNode> | undefined,
    parserMotion: Parser<HierarchyTreeNode> | undefined,
    files: TraceFile[],
  ) {
    this.parserKey = parserKey;
    this.parserMotion = parserMotion;
    this.files = files;
    const definedParser = assertDefined(parserKey ?? parserMotion);
    this.descriptors = definedParser.getDescriptors();
  }

  onDestroy() {
    // do nothing
  }

  getFiles(): TraceFile[] {
    return this.files;
  }

  isPerfetto(): boolean {
    return true;
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

  getRangeOfEntries(_: EntriesRange): Promise<HierarchyTreeNode[]> {
    throw NOT_IMPLEMENTED_ERROR;
  }

  async parse() {
    this.mergedEntryIndexMap = ParserInput.createMergedEntryIndexMap(
      this.parserKey,
      this.parserMotion,
    );
    await this.createTimestamps();
  }

  getLengthEntries(): number {
    return assertDefined(this.mergedEntryIndexMap).length;
  }

  async getAllEntries(): Promise<Array<HierarchyTreeNode | undefined>> {
    const [keyEvents, motionEvents] = await Promise.all([
      this.parserKey?.getAllEntries() ?? [],
      this.parserMotion?.getAllEntries() ?? [],
    ]);
    return assertDefined(this.mergedEntryIndexMap).map(([subIndex, type]) => {
      return type === TraceType.INPUT_KEY_EVENT
        ? keyEvents[subIndex]
        : motionEvents[subIndex];
    });
  }

  getEntry(index: number): Promise<HierarchyTreeNode> {
    const [subIndex, type] = assertDefined(this.mergedEntryIndexMap)[index];
    const subParser = assertDefined(
      type === TraceType.INPUT_KEY_EVENT ? this.parserKey : this.parserMotion,
    );
    return subParser.getEntry(subIndex);
  }

  getDescriptors(): string[] {
    return this.descriptors;
  }

  getTraceType(): TraceType {
    return TraceType.INPUT_EVENT_MERGED;
  }

  getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  getRealToBootTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  async createTimestamps() {
    const timestamps: Timestamp[] = [];
    const parserKeyTs = this.parserKey?.getTimestamps() ?? [];
    const parserMotionTs = this.parserMotion?.getTimestamps() ?? [];
    assertDefined(this.mergedEntryIndexMap).forEach(([index, traceType]) => {
      const ts = assertDefined(
        traceType === TraceType.INPUT_KEY_EVENT ? parserKeyTs : parserMotionTs,
      );
      timestamps.push(ts[index]);
    });
    this.timestamps = timestamps;
  }

  getTimestamps(): Timestamp[] {
    if (!this.timestamps) {
      throw NOT_IMPLEMENTED_ERROR;
    }
    return this.timestamps;
  }

  async customQuery<Q extends CustomQueryType>(
    type: Q,
    entriesRange: EntriesRange,
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    return new VisitableParserCustomQuery(type)
      .visit(CustomQueryType.VSYNCID, async () => {
        assertTrue(entriesRange.start < entriesRange.end);

        const {keyRange, motionRange} = this.getSubTraceRanges(entriesRange);

        let keyResult: bigint[] = [];
        if (keyRange !== undefined) {
          keyResult =
            (await this.parserKey?.customQuery(
              CustomQueryType.VSYNCID,
              keyRange,
            )) ?? [];
        }

        let motionResult: bigint[] = [];
        if (motionRange !== undefined) {
          motionResult =
            (await this.parserMotion?.customQuery(
              CustomQueryType.VSYNCID,
              motionRange,
            )) ?? [];
        }

        const mergedResult: bigint[] = [];
        let curKeyIndex = 0;
        let curMotionIndex = 0;
        for (let i = entriesRange.start; i < entriesRange.end; i++) {
          if (
            assertDefined(this.mergedEntryIndexMap)[i][1] ===
            TraceType.INPUT_KEY_EVENT
          ) {
            mergedResult.push(keyResult[curKeyIndex++]);
          } else {
            mergedResult.push(motionResult[curMotionIndex++]);
          }
        }
        return mergedResult;
      })
      .getResult();
  }

  // Given the entries range for the merged trace, get the entries ranges for
  // the individual sub-traces that make up this merged trace.
  private getSubTraceRanges(entriesRange: EntriesRange): {
    keyRange?: EntriesRange;
    motionRange?: EntriesRange;
  } {
    const ranges: {keyRange?: EntriesRange; motionRange?: EntriesRange} = {};

    for (let i = entriesRange.start; i < entriesRange.end; i++) {
      const [subEventIndex, type] = assertDefined(this.mergedEntryIndexMap)[i];
      if (type === TraceType.INPUT_KEY_EVENT) {
        if (ranges.keyRange === undefined) {
          ranges.keyRange = {start: subEventIndex, end: subEventIndex + 1};
        } else {
          ranges.keyRange.end = subEventIndex + 1;
        }
      } else {
        if (ranges.motionRange === undefined) {
          ranges.motionRange = {start: subEventIndex, end: subEventIndex + 1};
        } else {
          ranges.motionRange.end = subEventIndex + 1;
        }
      }
    }
    return ranges;
  }

  // Given two traces, merge the two traces into one based on their timestamps.
  // Returns the mapping from the index of the merged trace to the index in the
  // sub-trace.
  private static createMergedEntryIndexMap(
    parser1: Parser<unknown> | undefined,
    parser2: Parser<unknown> | undefined,
  ): Array<[OriginalTraceIndex, TraceType]> {
    if (!parser1) {
      return ParserInput.createEntryIndexMap(assertDefined(parser2));
    }
    if (!parser2) {
      return ParserInput.createEntryIndexMap(assertDefined(parser1));
    }
    // We are assuming the parsers entries are sorted by timestamps.
    const timestamps1 = parser1.getTimestamps();
    const timestamps2 = parser2.getTimestamps();
    const type1 = parser1.getTraceType();
    const type2 = parser2.getTraceType();
    const mergedIndices: Array<[OriginalTraceIndex, TraceType]> = [];

    let curIndex1 = 0;
    let curIndex2 = 0;
    while (curIndex1 < timestamps1.length && curIndex2 < timestamps2.length) {
      if (
        timestamps1[curIndex1].getValueNs() <=
        timestamps2[curIndex2].getValueNs()
      ) {
        mergedIndices.push([curIndex1++, type1]);
        continue;
      }
      mergedIndices.push([curIndex2++, type2]);
    }
    while (curIndex1 < timestamps1.length) {
      mergedIndices.push([curIndex1++, type1]);
    }
    while (curIndex2 < timestamps2.length) {
      mergedIndices.push([curIndex2++, type2]);
    }

    return mergedIndices;
  }

  private static createEntryIndexMap(
    parser: Parser<unknown>,
  ): Array<[OriginalTraceIndex, TraceType]> {
    const type = parser.getTraceType();
    return Array.from({length: parser.getLengthEntries()}, (_, i) => {
      return [i, type];
    });
  }
}

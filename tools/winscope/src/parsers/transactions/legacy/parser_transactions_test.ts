/*
 * Copyright (C) 2022 The Android Open Source Project
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
import {assertDefined} from 'common/assert';
import Long from 'long';
import {perfetto} from 'protos/perfetto/trace/static';
import {LegacyParserProvider} from 'test/unit/fixture_utils';
import {TraceBuilder} from 'test/unit/trace_builder';
import {
  makeRealTimestamp,
  makeElapsedTimestamp,
  timestampEqualityTester,
} from 'test/unit/time_test_helpers';
import {CoarseVersion} from 'trace_api/coarse_version';
import {CustomQueryType} from 'trace_api/custom_query';
import {Parser} from 'trace_api/parser';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';

describe('ParserTransactions', () => {
  describe('trace with real timestamps', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      parser = await new LegacyParserProvider()
        .addFile('traces/elapsed_and_real_timestamp/Transactions.pb')
        .getParser<HierarchyTreeNode>();
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.TRANSACTIONS);
    });

    it('has expected coarse version', () => {
      expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LEGACY);
    });

    it('provides timestamps', () => {
      const timestamps = assertDefined(parser.getTimestamps());

      expect(timestamps.length).toBe(712);

      const expected = [
        makeRealTimestamp(1659507541051480997n),
        makeRealTimestamp(1659507541118452067n),
        makeRealTimestamp(1659507542621651001n),
      ];
      expect(timestamps.slice(0, 3)).toEqual(expected);
    });

    it('does not provide entry', () => {
      expect(parser.getEntry).toThrow();
    });

    it('converts to valid perfetto packets', async () => {
      const packets = parser.convertToPerfettoPackets!(10);
      expect(packets.length).toBe(712);
      expect(packets[0].trustedPacketSequenceId).toBe(10);
      expect(packets[0].surfaceflingerTransactions?.transactions?.length).toBe(
        2,
      );
      expect(packets[0].timestamp).toEqual(
        Long.fromString(BigInt(2450981445).toString()),
      );
      expect(packets[0].timestampClockId).toEqual(
        perfetto.protos.ClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
      );
    });

    describe('converts to valid perfetto trace', () => {
      let perfettoParser: Parser<HierarchyTreeNode>;

      beforeAll(async () => {
        perfettoParser = await new LegacyParserProvider()
          .addFile('traces/elapsed_and_real_timestamp/Transactions.pb')
          .setConvertToPerfetto(true)
          .getParser<HierarchyTreeNode>();
      });

      it('provides timestamps', () => {
        const timestamps = assertDefined(perfettoParser.getTimestamps());

        expect(timestamps.length).toBe(712);

        const expected = [
          makeRealTimestamp(1659507541051480997n),
          makeRealTimestamp(1659507541118452067n),
          makeRealTimestamp(1659507542621651001n),
        ];
        expect(timestamps.slice(0, 3)).toEqual(expected);
      });

      it("decodes 'what' field in proto", async () => {
        {
          const entry = await perfettoParser.getEntry(0);
          const [transaction0, transaction1] = await Promise.all(
            entry
              .getAllChildren()
              .slice(0, 2)
              .map((child) => child.getAllProperties()),
          );
          expect(transaction0.getChildByName('what')?.formattedValue()).toBe(
            'eLayerChanged',
          );

          expect(transaction1?.getChildByName('what')?.formattedValue()).toBe(
            'eFlagsChanged | eDestinationFrameChanged',
          );
        }
        {
          // translates upper and lower bits
          const entry = await perfettoParser.getEntry(222);
          const transaction = await entry
            .getAllChildren()[42]
            .getAllProperties();
          expect(transaction.getChildByName('what')?.formattedValue()).toBe(
            'eLayerStackChanged | eDisplayProjectionChanged | eFlagsChanged',
          );
        }
      });

      it('supports VSYNCID custom query', async () => {
        const trace = new TraceBuilder()
          .setType(TraceType.TRANSACTIONS)
          .setParser(perfettoParser)
          .build();
        const entries = await trace
          .sliceEntries(0, 3)
          .customQuery(CustomQueryType.VSYNCID);
        const values = entries.map((entry) => entry.getValue());
        expect(values).toEqual([1n, 2n, 3n]);
      });
    });
  });

  describe('trace with only elapsed timestamps', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      parser = await new LegacyParserProvider()
        .addFile('traces/elapsed_timestamp/Transactions.pb')
        .getParser<HierarchyTreeNode>();
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.TRANSACTIONS);
    });

    it('provides timestamps', () => {
      const timestamps = assertDefined(parser.getTimestamps());

      expect(timestamps.length).toBe(4997);

      const expected = [
        makeElapsedTimestamp(14862317023n),
        makeElapsedTimestamp(14873423549n),
        makeElapsedTimestamp(14884850511n),
      ];
      expect(timestamps.slice(0, 3)).toEqual(expected);
    });

    it('converts to valid perfetto packets', async () => {
      const packets = parser.convertToPerfettoPackets!(10);
      expect(packets.length).toBe(4997);
      expect(packets[0].trustedPacketSequenceId).toBe(10);
      expect(packets[0].surfaceflingerTransactions?.transactions?.length).toBe(
        1,
      );
      expect(packets[0].timestamp).toEqual(
        Long.fromString(BigInt(14862317023).toString()),
      );
      expect(packets[0].timestampClockId).toEqual(
        perfetto.protos.ClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
      );
    });
  });
});

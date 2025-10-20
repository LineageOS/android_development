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
import {LegacyParserProvider} from 'test/unit/fixture_utils';
import {
  makeElapsedTimestamp,
  makeRealTimestamp,
  timestampEqualityTester,
} from 'test/unit/time_test_helpers';
import {CoarseVersion} from 'trace_api/coarse_version';
import {Parser} from 'trace_api/parser';
import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';

describe('ParserInputMethodService', () => {
  describe('trace with real timestamps', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      parser = await new LegacyParserProvider()
        .addFile('traces/elapsed_and_real_timestamp/InputMethodService.pb')
        .getParser<HierarchyTreeNode>();
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.INPUT_METHOD_SERVICE);
    });

    it('has expected coarse version', () => {
      expect(parser.getCoarseVersion()).toEqual(CoarseVersion.LEGACY);
    });

    it('provides timestamps', () => {
      const expected = [makeRealTimestamp(1659107091180519857n)];
      expect(parser.getTimestamps()).toEqual(expected);
    });

    it('does not provide entry', () => {
      expect(parser.getEntry).toThrow();
    });

    it('converts to valid perfetto packets', async () => {
      const packets = parser.convertToPerfettoPackets!(10);
      expect(packets.length).toBe(1);
      expect(packets[0].trustedPacketSequenceId).toBe(10);
      const data =
        packets[0].winscopeExtensions?.[
          '.perfetto.protos.WinscopeExtensionsImpl.inputmethodService'
        ];
      expect(data?.inputMethodService).toBeDefined();
      expect(data?.where).toBe('InputMethodService#doStartInput');
      const ts = Long.fromString(BigInt(16578752896).toString());
      ts.unsigned = true;
      expect(packets[0].timestamp).toEqual(ts);
    });

    it('converts to valid perfetto trace', async () => {
      const perfettoParser = await new LegacyParserProvider()
        .addFile('traces/elapsed_and_real_timestamp/InputMethodService.pb')
        .setConvertToPerfetto(true)
        .getParser<HierarchyTreeNode>();

      expect(perfettoParser.getTimestamps()).toEqual([
        makeRealTimestamp(1659107091180519857n),
      ]);

      const entry = await perfettoParser.getEntry(0);
      expect(entry).toBeInstanceOf(HierarchyTreeNode);
      expect(entry.getEagerPropertyByName('where')?.getValue()).toBe(
        'InputMethodService#doStartInput',
      );
    });
  });

  describe('trace with only elapsed timestamps', () => {
    let parser: Parser<HierarchyTreeNode>;

    beforeAll(async () => {
      parser = await new LegacyParserProvider()
        .addFile('traces/elapsed_timestamp/InputMethodService.pb')
        .getParser<HierarchyTreeNode>();
    });

    it('has expected trace type', () => {
      expect(parser.getTraceType()).toEqual(TraceType.INPUT_METHOD_SERVICE);
    });

    it('provides timestamps', () => {
      expect(assertDefined(parser.getTimestamps())[0]).toEqual(
        makeElapsedTimestamp(1149230019887n),
      );
    });

    it('does not provide entry', () => {
      expect(parser.getEntry).toThrow();
    });

    it('converts to valid perfetto packets', async () => {
      const packets = parser.convertToPerfettoPackets!(10);
      expect(packets.length).toBe(7);
      expect(packets[0].trustedPacketSequenceId).toBe(10);

      const data = assertDefined(
        packets[0].winscopeExtensions?.[
          '.perfetto.protos.WinscopeExtensionsImpl.inputmethodService'
        ],
      );
      expect(data.where).toBe('InputMethodService#doFinishInput');
      expect(data?.inputMethodService).toBeDefined();
      const ts = Long.fromString(BigInt(1149230019887).toString());
      ts.unsigned = true;
      expect(packets[0].timestamp).toEqual(ts);
    });
  });
});

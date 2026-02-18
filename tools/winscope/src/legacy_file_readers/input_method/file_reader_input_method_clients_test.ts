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

import {assertDefined} from '@common/assert';
import Long from 'long';
import {
  convertToPerfettoTrace,
  LegacyFileReaderProvider,
} from '@test/unit/fixture_utils';
import {
  makeConverterNoRteOffsets,
  makeElapsedTimestamp,
  makeRealTimestamp,
  timestampEqualityTester,
} from '@common/time/test_helpers';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';

describe('FileReaderInputMethodClients', () => {
  describe('trace with real timestamps', () => {
    let reader: LegacyFileReader;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      reader = await new LegacyFileReaderProvider()
        .addFile('traces/elapsed_and_real_timestamp/InputMethodClients.pb')
        .get();
    });

    it('has expected trace type', () => {
      expect(reader.getTraceType()).toEqual(TraceType.INPUT_METHOD_CLIENTS);
    });

    it('provides timestamps', () => {
      const expected = [
        makeRealTimestamp(1659107090215405395n),
        makeRealTimestamp(1659107090249283325n),
        makeRealTimestamp(1659107090279417928n),
      ];
      expect(reader.getTimestamps().slice(0, 3)).toEqual(expected);
    });

    it('converts to valid perfetto packets', async () => {
      const packets = reader.convertToPerfettoPackets(10);
      expect(packets.length).toBe(13);
      expect(packets[0].trustedPacketSequenceId).toBe(10);
      const data =
        packets[0].winscopeExtensions?.[
          '.perfetto.protos.WinscopeExtensionsImpl.inputmethodClients'
        ];
      expect(data?.client).toBeDefined();
      expect(data?.where).toBe('InsetsSourceConsumer#setControl');
      const ts = Long.fromString(BigInt(15613638434).toString());
      ts.unsigned = true;
      expect(packets[0].timestamp).toEqual(ts);
    });

    it('converts to valid perfetto trace', async () => {
      const perfettoParser = (
        await convertToPerfettoTrace([reader], makeConverterNoRteOffsets())
      )[0];

      expect(perfettoParser.getTimestamps().slice(0, 3)).toEqual([
        makeRealTimestamp(1659107090215405395n),
        makeRealTimestamp(1659107090249283325n),
        makeRealTimestamp(1659107090279417928n),
      ]);

      const entry = await perfettoParser.getEntry(10);
      expect(entry).toBeInstanceOf(HierarchyTreeNode);
      expect(entry.getEagerPropertyByName('where')?.getValue()).toEqual(
        'InsetsSourceConsumer#setControl',
      );
      const client = assertDefined(entry.getChildByName('client'));
      const properties = await client.getAllProperties();
      const intdefProperty = properties
        ?.getChildByName('viewRootImpl')
        ?.getChildByName('windowAttributes')
        ?.getChildByName('type');
      expect(intdefProperty?.formattedValue()).toBe('TYPE_BASE_APPLICATION');
    });
  });

  describe('trace with only elapsed timestamps', () => {
    let reader: LegacyFileReader;

    beforeAll(async () => {
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      reader = await new LegacyFileReaderProvider()
        .addFile('traces/elapsed_timestamp/InputMethodClients.pb')
        .get();
    });

    it('has expected trace type', () => {
      expect(reader.getTraceType()).toEqual(TraceType.INPUT_METHOD_CLIENTS);
    });

    it('provides timestamps', () => {
      expect(reader.getTimestamps()[0]).toEqual(
        makeElapsedTimestamp(1149083651642n),
      );
    });

    it('converts to valid perfetto packets', async () => {
      const packets = reader.convertToPerfettoPackets(10);
      expect(packets.length).toBe(33);
      expect(packets[0].trustedPacketSequenceId).toBe(10);
      const data =
        packets[0].winscopeExtensions?.[
          '.perfetto.protos.WinscopeExtensionsImpl.inputmethodClients'
        ];
      expect(data?.client).toBeDefined();
      expect(data?.where).toBe('InsetsSourceConsumer#setControl');
      const ts = Long.fromString(BigInt(1149083651642).toString());
      ts.unsigned = true;
      expect(packets[0].timestamp).toEqual(ts);
    });
  });
});

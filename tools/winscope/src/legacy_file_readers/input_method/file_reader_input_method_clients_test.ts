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
import {makeConverterNoRteOffsets, makeElapsedTimestamp, makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {WinscopeExtensionsImpl} from '@compat/protobuf';
import {setupJspbTesting} from '@compat/test/protobuf';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {convertToPerfettoTrace, LegacyFileReaderProvider,} from '@legacy_file_readers/testing/fixture_utils';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';

import {FileReaderInputMethodClients} from './file_reader_input_method_clients';

describe('FileReaderInputMethodClients', () => {
  describe('trace with real timestamps', () => {
    let reader: LegacyFileReader;

    beforeAll(async () => {
      setupJspbTesting();
      jasmine.addCustomEqualityTester(timestampEqualityTester);
      reader = await new LegacyFileReaderProvider([
        FileReaderInputMethodClients.createInstance,
      ])
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
      expect(packets[0].getTrustedPacketSequenceId()).toBe(10);
      const data = packets[0]
        .getWinscopeExtensions()
        ?.getExtension(WinscopeExtensionsImpl.inputmethodClients);
      expect(data?.hasClient()).toBeFalse();
      expect(data?.getWhere()).toBe('InsetsSourceConsumer#setControl');
      expect(packets[0].getTimestamp()?.toString()).toEqual('15613638434');
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
      expect(entry.getEagerPropertyByName('where')?.getValue<string>()).toEqual(
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
      reader = await new LegacyFileReaderProvider([
        FileReaderInputMethodClients.createInstance,
      ])
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
      expect(packets[0].getTrustedPacketSequenceId()).toBe(10);
      const data = packets[0]
        .getWinscopeExtensions()
        ?.getExtension(WinscopeExtensionsImpl.inputmethodClients);
      expect(data?.hasClient()).toBeTrue();
      expect(data?.getWhere()).toBe('InsetsSourceConsumer#setControl');
      expect(packets[0].getTimestamp()?.toString()).toEqual('1149083651642');
    });
  });
});

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

import {assertDefined} from '@common/assert';
import Long from 'long';
import {ShellHandlerMappings} from '@compat/winscope_protos';
import {ClockSnapshot} from '@compat/perfetto';
import {
  convertToPerfettoTrace,
  LegacyFileReaderProvider,
} from '@test/unit/fixture_utils';
import {
  makeConverterNoRteOffsets,
  makeRealTimestamp,
  timestampEqualityTester,
} from '@common/time/test_helpers';
import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {FileReaderTransitions} from './file_reader_transitions';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TimestampConverter} from '@common/time/timestamp_converter';

describe('FileReaderTransitions', () => {
  let converter: TimestampConverter;
  let reader: LegacyFileReader;
  let readerShell: LegacyFileReader;
  let readerWm: LegacyFileReader;

  beforeAll(async () => {
    jasmine.addCustomEqualityTester(timestampEqualityTester);
    converter = makeConverterNoRteOffsets();
    [reader, readerShell, readerWm] = await getFileReaderTransitions(converter);
  });

  it('has expected trace type', () => {
    expect(reader.getTraceType()).toEqual(TraceType.TRANSITION);
  });

  it('has expected descriptors', () => {
    expect(reader.getDescriptors()).toEqual([
      'wm_transition_trace.pb',
      'shell_transition_trace.pb',
    ]);
  });

  it('provides timestamps', () => {
    const timestamps = reader.getTimestamps();
    const expected = [
      makeRealTimestamp(1683188477604336464n),
      makeRealTimestamp(1683188477785406289n),
      makeRealTimestamp(1683188479252119424n),
      makeRealTimestamp(1683188481345929443n),
    ];
    expect(timestamps).toEqual(expected);
  });

  it('sets zero timestamp if both dispatch and send time unavailable', async () => {
    const shellPackets = readerShell.convertToPerfettoPackets(0);
    assertDefined(shellPackets[2].shellTransition).dispatchTimeNs = undefined;
    spyOn(readerShell, 'convertToPerfettoPackets').and.returnValue(
      shellPackets,
    );

    const wmPackets = readerWm.convertToPerfettoPackets(0);
    assertDefined(wmPackets[1].shellTransition).sendTimeNs = undefined;
    spyOn(readerWm, 'convertToPerfettoPackets').and.returnValue(wmPackets);

    const mergedReader = new FileReaderTransitions(
      readerShell,
      readerWm,
      converter,
    );
    mergedReader.read();
    expect(mergedReader.getTimestamps().at(0)).toEqual(makeRealTimestamp(0n));
  });

  it('converts to valid perfetto packets', () => {
    const packets = reader.convertToPerfettoPackets(10);
    expect(packets.length).toBe(5);
    packets.forEach((packet) => {
      expect(packet.trustedPacketSequenceId).toBe(10);
    });

    const handlerMappingPacket = packets[0];
    const shellHandlerMappings = ShellHandlerMappings.fromObject({
      mapping: [
        {id: 2, name: 'com.android.wm.shell.transition.DefaultMixedHandler'},
        {
          id: 3,
          name: 'com.android.wm.shell.recents.RecentsTransitionHandler',
        },
      ],
    });
    expect(handlerMappingPacket.shellHandlerMappings).toEqual(
      shellHandlerMappings,
    );

    const transition6Packet = assertDefined(
      packets.find((p) => p.shellTransition?.id === 6),
    );
    const transition6 = assertDefined(transition6Packet.shellTransition);
    const sendTime6 = Long.fromString('57649646973488');
    expect(transition6Packet.timestamp).toEqual(sendTime6);
    expect(transition6Packet.timestampClockId).toEqual(
      ClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
    );
    expect(transition6.createTimeNs).toEqual(Long.fromString('57649586217344'));
    expect(transition6.sendTimeNs).toEqual(sendTime6);
    expect(transition6.wmAbortTimeNs).toBeUndefined();
    expect(transition6.finishTimeNs).toEqual(Long.fromString('57650183020323'));
    expect(transition6.type).toBe(1);
    expect(transition6.changes?.length).toBe(2);
    expect(transition6.flags).toBeUndefined();
    expect(transition6.startingWindowRemoveTimeNs).toBeUndefined();
    expect(transition6.dispatchTimeNs).toEqual(
      Long.fromString('57649649922341'),
    );
    expect(transition6.mergeTimeNs).toBeUndefined();
    expect(transition6.mergeRequestTimeNs).toBeUndefined();
    expect(transition6.shellAbortTimeNs).toBeUndefined();
    expect(transition6.handler).toBe(2);
    expect(transition6.mergeTarget).toBeUndefined();

    const transition7Packet = packets[2];
    const transition7 = assertDefined(transition7Packet.shellTransition);
    expect(transition7.id).toBe(7);
    const dispatchTime7 = Long.fromString('57649828043313');
    expect(transition7Packet.timestamp).toEqual(dispatchTime7);
    expect(transition7Packet.timestampClockId).toEqual(
      ClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
    );
    expect(transition7.sendTimeNs).toBeUndefined();
    expect(transition7.dispatchTimeNs).toEqual(dispatchTime7);
    expect(transition7.mergeTimeNs).toEqual(Long.fromString('57649829526223'));
    expect(transition7.shellAbortTimeNs).toEqual(
      Long.fromString('57649829445249'),
    );
    expect(transition7.handler).toBeUndefined();

    const transition8 = assertDefined(packets[3].shellTransition);
    expect(transition8.id).toBe(8);
    expect(transition8.flags).toBe(128);

    const transition9 = assertDefined(packets[4].shellTransition);
    expect(transition9.id).toBe(9);
    expect(transition9.mergeRequestTimeNs).toEqual(
      Long.fromString('57653389780131'),
    );
    expect(transition9.mergeTarget).toBe(8);
  });

  it('converts to valid perfetto trace', async () => {
    const perfettoParser = (
      await convertToPerfettoTrace([reader], makeConverterNoRteOffsets())
    )[0];
    expect(perfettoParser.getTimestamps()).toEqual([
      makeRealTimestamp(1683188477604336464n),
      makeRealTimestamp(1683188477785406289n),
      makeRealTimestamp(1683188479252119424n),
      makeRealTimestamp(1683188481345929443n),
    ]);
    const entries = [
      await perfettoParser.getEntry(0),
      await perfettoParser.getEntry(1),
      await perfettoParser.getEntry(2),
      await perfettoParser.getEntry(3),
    ];
    const entryIds = entries.map((e) =>
      e.getEagerPropertyByName('transitionId')?.getValue(),
    );
    expect(entryIds).toEqual([6n, 7n, 8n, 9n]);

    const entry = entries[2];
    const entryProperties = await entry.getAllProperties();
    expect(entry.getEagerPropertyByName('status')?.getValue()).toBe('played');

    checkEagerPropertyValue(entry, 'sendTimeNs', '2023-05-04, 08:21:19.252');
    checkPropertyValue(entryProperties, 'startTransactionId', '13086765351920');
    checkEagerPropertyValue(entry, 'flags', 'TRANSIT_FLAG_IS_RECENTS');

    const layerParticipants = assertDefined(
      entry.getEagerPropertyByName('layers'),
    );
    expect(layerParticipants.getAllChildren().length).toBe(2);
    checkPropertyValue(layerParticipants, '0', '113');
    checkPropertyValue(layerParticipants, '1', '190');

    const windowParticipants = assertDefined(
      entry.getEagerPropertyByName('windows'),
    );
    expect(windowParticipants.getAllChildren().length).toBe(2);
    checkPropertyValue(windowParticipants, '0', '179781688');
    checkPropertyValue(windowParticipants, '1', '184699222');

    const changes = assertDefined(
      entryProperties.getChildByName('changes'),
    ).getAllChildren();
    expect(changes.length).toBe(2);
    checkPropertyValue(changes[0], 'layerId', '113');
    checkPropertyValue(changes[0], 'mode', 'TO_FRONT');
    checkPropertyValue(
      changes[0],
      'flags',
      'FLAG_MOVED_TO_TOP | FLAG_SHOW_WALLPAPER',
    );
    checkPropertyValue(changes[0], 'windowId', '179781688');

    checkEagerPropertyValue(
      entry,
      'handler',
      'com.android.wm.shell.recents.RecentsTransitionHandler',
    );
    checkPropertyValue(
      entryProperties,
      'handler',
      'com.android.wm.shell.recents.RecentsTransitionHandler',
    );
  });

  function checkEagerPropertyValue(
    node: HierarchyTreeNode,
    property: string,
    value: string,
  ) {
    expect(node.getEagerPropertyByName(property)?.formattedValue()).toBe(value);
  }

  function checkPropertyValue(
    node: PropertyTreeNode,
    property: string,
    value: string,
  ) {
    expect(node.getChildByName(property)?.formattedValue()).toBe(value);
  }

  async function getFileReaderTransitions(
    converter: TimestampConverter,
  ): Promise<LegacyFileReader[]> {
    const [readerShell, readerWm] = await new LegacyFileReaderProvider()
      .addFile('traces/elapsed_and_real_timestamp/shell_transition_trace.pb')
      .addFile('traces/elapsed_and_real_timestamp/wm_transition_trace.pb')
      .getAll();
    const boottimeOffset = assertDefined(
      readerShell.getRealToBootTimeOffsetNs(),
    );
    converter.setRealToBootTimeOffsetNs(boottimeOffset);
    const mergedReader = new FileReaderTransitions(
      readerShell,
      readerWm,
      converter,
    );
    mergedReader.read();
    return [mergedReader, readerShell, readerWm];
  }
});

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
import {utf8Encode} from '@common/string_helpers';
import {makeConverterNoRteOffsets, makeRealTimestamp, timestampEqualityTester,} from '@common/time/testing/test_helpers';
import {Timestamp} from '@common/time/time';
import {PerfettoInternedString, PerfettoProtoLogViewerConfig, PerfettoTracePacket,} from '@compat/protobuf';
import {setupJspbTesting} from '@compat/test/protobuf';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {convertToPerfettoTrace, LegacyFileReaderProvider,} from '@legacy_file_readers/testing/fixture_utils';
import {TraceType} from '@trace_api/trace_type';

import {FileReaderProtoLog} from './file_reader_protolog';
import {CONFIG_32, CONFIG_64} from './legacy_to_perfetto_configs';

interface ExpectedInternedData {
  packetIndex: number;
  str: string;
  iid: number;
}

interface ExpectedMessagePacket {
  packetIndex: number;
  sequenceFlags: number;
  timestamp: string;
  messageId: string;
  strParamIids: number[];
  sint64Params: string[];
  doubleParams: number[];
  booleanParams: number[];
}

interface ExpectedMessage {
  message: string;
  ts: string;
  location: string;
  level: string;
  tag: string;
}

abstract class ParserProtologTest {
  abstract readonly traceFile: string;
  abstract readonly timestampCount: number;
  abstract readonly first3ExpectedRealTimestamps: Timestamp[];
  abstract readonly expectedConfig: PerfettoProtoLogViewerConfig;
  abstract readonly internedData1: ExpectedInternedData;
  abstract readonly internedData2: ExpectedInternedData;
  abstract readonly messagePacketWithInternedStrings: ExpectedMessagePacket;
  abstract readonly messagePacketNoInternedStrings: ExpectedMessagePacket;
  abstract readonly expectedFirstMessage: ExpectedMessage;

  execute() {
    describe('FileReaderProtologTest', () => {
      const [sequenceId, trustedUid, trustedPid] = [10, 3, 5];
      let reader!: LegacyFileReader;

      beforeAll(async () => {
        setupJspbTesting();
        jasmine.addCustomEqualityTester(timestampEqualityTester);
        reader = await new LegacyFileReaderProvider([
          FileReaderProtoLog.createInstance,
        ])
          .addFile(this.traceFile)
          .get();
      });

      it('has expected trace type', () => {
        expect(reader.getTraceType()).toEqual(TraceType.PROTO_LOG);
      });

      it('has expected length', () => {
        expect(reader.getLengthEntries()).toEqual(this.timestampCount);
      });

      it('provides timestamps', () => {
        const timestamps = reader.getTimestamps();
        expect(timestamps.length).toEqual(this.timestampCount);

        expect(timestamps.slice(0, 3)).toEqual(
          this.first3ExpectedRealTimestamps,
        );
      });

      it('converts to valid perfetto packets', async () => {
        const packets = reader.convertToPerfettoPackets(
          sequenceId,
          trustedUid,
          trustedPid,
        );
        expect(
          packets.filter((packet) => packet.getProtologMessage()).length,
        ).toEqual(this.timestampCount);

        const firstPacket = packets[0];
        expect(firstPacket.getTrustedPacketSequenceId()).toEqual(sequenceId);
        expect(firstPacket.getSequenceFlags()).toEqual(
          PerfettoTracePacket.SequenceFlags.SEQ_INCREMENTAL_STATE_CLEARED,
        );
        expect(firstPacket.getTrustedUid()).toEqual(trustedUid);
        expect(firstPacket.getTrustedPid()).toEqual(trustedPid);
        expect(firstPacket.hasInternedData()).toBeFalse();
        expect(firstPacket.hasProtologViewerConfig()).toBeFalse();
        expect(firstPacket.hasProtologMessage()).toBeFalse();

        const viewerConfigPacket = packets[1];
        expect(viewerConfigPacket.getTrustedPacketSequenceId()).toEqual(
          sequenceId,
        );
        expect(viewerConfigPacket.getSequenceFlags()).toEqual(
          PerfettoTracePacket.SequenceFlags.SEQ_UNSPECIFIED,
        );
        expect(viewerConfigPacket.getProtologViewerConfig()).toEqual(
          this.expectedConfig,
        );
        expect(viewerConfigPacket.getTrustedUid()).toEqual(trustedUid);
        expect(viewerConfigPacket.getTrustedPid()).toBe(0);
        expect(viewerConfigPacket.hasInternedData()).toBeFalse();
        expect(viewerConfigPacket.hasProtologMessage()).toBeFalse();

        checkInternedDataPacket(packets, this.internedData1);
        checkInternedDataPacket(packets, this.internedData2);

        checkMessagePacket(packets, this.messagePacketNoInternedStrings);
        checkMessagePacket(packets, this.messagePacketWithInternedStrings);
      });

      it('converts to valid perfetto trace', async () => {
        const perfettoParser = (
          await convertToPerfettoTrace([reader], makeConverterNoRteOffsets())
        )[0];

        expect(perfettoParser.getTimestamps().slice(0, 3)).toEqual(
          this.first3ExpectedRealTimestamps,
        );

        const message = await perfettoParser.getEntry(0);

        expect(
          assertDefined(
            message.getEagerPropertyByName('message'),
          ).formattedValue(),
        ).toEqual(this.expectedFirstMessage.message);
        expect(
          assertDefined(message.getEagerPropertyByName('ts')).formattedValue(),
        ).toEqual(this.expectedFirstMessage.ts);
        expect(
          assertDefined(message.getEagerPropertyByName('tag')).formattedValue(),
        ).toEqual(this.expectedFirstMessage.tag);
        expect(
          assertDefined(
            message.getEagerPropertyByName('level'),
          ).formattedValue(),
        ).toEqual(this.expectedFirstMessage.level);
        expect(
          assertDefined(
            message.getEagerPropertyByName('location'),
          ).formattedValue(),
        ).toEqual(this.expectedFirstMessage.location);
      });

      function checkMessagePacket(
        packets: PerfettoTracePacket[],
        expectedMsg: ExpectedMessagePacket,
      ) {
        const packet = packets[expectedMsg.packetIndex];
        expect(packet.getTrustedPacketSequenceId()).toEqual(sequenceId);
        expect(packet.getSequenceFlags()).toEqual(expectedMsg.sequenceFlags);
        expect(packet.getTrustedUid()).toEqual(trustedUid);
        expect(packet.getTrustedPid()).toEqual(trustedPid);
        expect(packet.getTimestamp()?.toString()).toEqual(
          expectedMsg.timestamp,
        );
        expect(packet.getProtologMessage()?.getMessageId()?.toString()).toEqual(
          expectedMsg.messageId,
        );
        expect(packet.getProtologMessage()?.getStrParamIidsList()).toEqual(
          expectedMsg.strParamIids,
        );
        expect(packet.getProtologMessage()?.getBooleanParamsList()).toEqual(
          expectedMsg.booleanParams,
        );
        expect(packet.getProtologMessage()?.getDoubleParamsList()).toEqual(
          expectedMsg.doubleParams,
        );
        expect(
          packet
            .getProtologMessage()
            ?.getSint64ParamsList()
            ?.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (param: any) => param.toString(),
            ),
        ).toEqual(expectedMsg.sint64Params);
        expect(packet.hasProtologViewerConfig()).toBeFalse();
        expect(packet.hasInternedData()).toBeFalse();
      }

      function checkInternedDataPacket(
        packets: PerfettoTracePacket[],
        expectedData: ExpectedInternedData,
      ) {
        const packet = packets[expectedData.packetIndex];
        expect(packet.getTrustedPacketSequenceId()).toEqual(sequenceId);
        expect(packet.getSequenceFlags()).toEqual(0);
        expect(packet.getTrustedUid()).toEqual(trustedUid);
        expect(packet.getTrustedPid()).toEqual(trustedPid);
        const internedString = new PerfettoInternedString();
        internedString.setIid(expectedData.iid);
        internedString.setStr(utf8Encode(expectedData.str));

        expect(packet.getInternedData()?.getProtologStringArgsList()).toEqual([
          internedString,
        ]);
        expect(packet.hasProtologViewerConfig()).toBeFalse();
        expect(packet.hasProtologMessage()).toBeFalse();
      }
    });
  }
}

class ParserProtolog32Test extends ParserProtologTest {
  override readonly traceFile =
    'traces/elapsed_and_real_timestamp/ProtoLog32.pb';
  override readonly timestampCount = 50;
  override readonly first3ExpectedRealTimestamps = [
    makeRealTimestamp(1655727125377266486n),
    makeRealTimestamp(1655727125377336718n),
    makeRealTimestamp(1655727125377350430n),
  ];
  override readonly expectedConfig = CONFIG_32;
  override readonly internedData1: ExpectedInternedData = {
    packetIndex: 2,
    iid: 1,
    str: 'ITYPE_IME',
  };
  override readonly internedData2: ExpectedInternedData = {
    packetIndex: 3,
    iid: 2,
    str: 'false',
  };
  override readonly messagePacketNoInternedStrings: ExpectedMessagePacket = {
    packetIndex: 50,
    sequenceFlags: PerfettoTracePacket.SequenceFlags.SEQ_UNSPECIFIED,
    timestamp: '850755642097',
    messageId: '1984782949',
    strParamIids: [],
    sint64Params: [],
    booleanParams: [],
    doubleParams: [],
  };
  override readonly messagePacketWithInternedStrings: ExpectedMessagePacket = {
    packetIndex: 4,
    sequenceFlags:
      PerfettoTracePacket.SequenceFlags.SEQ_NEEDS_INCREMENTAL_STATE,
    timestamp: '850746266486',
    messageId: '2070726247',
    strParamIids: [1, 2, 2],
    sint64Params: [],
    booleanParams: [],
    doubleParams: [],
  };
  override readonly expectedFirstMessage: ExpectedMessage = {
    message:
      'InsetsSource updateVisibility for ITYPE_IME, serverVisible: false clientVisible: false',
    ts: '2022-06-20, 12:12:05.377',
    tag: 'WindowManager',
    level: 'DEBUG',
    location: 'com/android/server/wm/InsetsSourceProvider.java',
  };
}

class ParserProtolog64Test extends ParserProtologTest {
  override readonly traceFile =
    'traces/elapsed_and_real_timestamp/ProtoLog64.pb';
  override readonly timestampCount = 4615;
  override readonly first3ExpectedRealTimestamps = [
    makeRealTimestamp(1709196806399529939n),
    makeRealTimestamp(1709196806399763866n),
    makeRealTimestamp(1709196806400297151n),
  ];
  override readonly expectedConfig = CONFIG_64;
  override readonly internedData1: ExpectedInternedData = {
    packetIndex: 5,
    iid: 1,
    str: 'ActivityRecord{e361a5d u0 com.google.android.gm/.ConversationListActivityGmail',
  };
  override readonly internedData2: ExpectedInternedData = {
    packetIndex: 6,
    iid: 2,
    str: 'null',
  };
  override readonly messagePacketNoInternedStrings: ExpectedMessagePacket = {
    packetIndex: 2,
    sequenceFlags: PerfettoTracePacket.SequenceFlags.SEQ_UNSPECIFIED,
    timestamp: '1315553529939',
    messageId: '1665699123574159131',
    strParamIids: [],
    sint64Params: [],
    booleanParams: [0],
    doubleParams: [],
  };
  override readonly messagePacketWithInternedStrings: ExpectedMessagePacket = {
    packetIndex: 9,
    sequenceFlags:
      PerfettoTracePacket.SequenceFlags.SEQ_NEEDS_INCREMENTAL_STATE,
    timestamp: '1315574594310',
    messageId: '11573334016567360498',
    strParamIids: [1, 2, 3, 4],
    sint64Params: [],
    booleanParams: [],
    doubleParams: [],
  };
  override readonly expectedFirstMessage: ExpectedMessage = {
    message: 'Starting activity when config will change = false',
    ts: '2024-02-29, 08:53:26.400',
    tag: 'WindowManager',
    level: 'VERBOSE',
    location: 'com/android/server/wm/ActivityStarter.java',
  };
}

class ParserProtologMissingConfigTest extends ParserProtologTest {
  override readonly traceFile =
    'traces/elapsed_and_real_timestamp/ProtoLogMissingConfigMessage.pb';
  override readonly timestampCount = 7295;
  override readonly first3ExpectedRealTimestamps = [
    makeRealTimestamp(1669053909777144978n),
    makeRealTimestamp(1669053909778011697n),
    makeRealTimestamp(1669053909778800707n),
  ];
  override readonly expectedConfig = CONFIG_32;
  override readonly internedData1: ExpectedInternedData = {
    packetIndex: 2,
    iid: 1,
    str: 'NotificationShade',
  };
  override readonly internedData2: ExpectedInternedData = {
    packetIndex: 4,
    iid: 2,
    str: 'Window{f199162 u0 NotificationShade}',
  };
  override readonly messagePacketNoInternedStrings: ExpectedMessagePacket = {
    packetIndex: 92,
    sequenceFlags: PerfettoTracePacket.SequenceFlags.SEQ_UNSPECIFIED,
    timestamp: '24398203599667',
    messageId: '1381227466',
    strParamIids: [],
    sint64Params: ['2', '0'],
    booleanParams: [],
    doubleParams: [],
  };
  override readonly messagePacketWithInternedStrings: ExpectedMessagePacket = {
    packetIndex: 3,
    sequenceFlags:
      PerfettoTracePacket.SequenceFlags.SEQ_NEEDS_INCREMENTAL_STATE,
    timestamp: '24398190144978',
    messageId: '585096182',
    strParamIids: [1],
    sint64Params: [],
    booleanParams: [1],
    doubleParams: [],
  };
  override readonly expectedFirstMessage: ExpectedMessage = {
    message: 'SURFACE isColorSpaceAgnostic=true: NotificationShade',
    ts: '2022-11-21, 18:05:09.777',
    tag: 'WindowManager',
    level: 'INFO',
    location: 'com/android/server/wm/WindowSurfaceController.java',
  };
}

describe('32', () => {
  new ParserProtolog32Test().execute();
});

describe('64', () => {
  new ParserProtolog64Test().execute();
});

describe('Missing config', () => {
  new ParserProtologMissingConfigTest().execute();
});

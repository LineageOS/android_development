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
import {Timestamp} from '@common/time/time';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {getLogger, Logger} from '@compat/logging';
import {PerfettoClockSnapshot, PerfettoInternedData, PerfettoInternedString, PerfettoProtoLogMessage, PerfettoTracePacket, ProtoLogFileProtoUdc, ProtoLogMessageUdc,} from '@compat/protobuf';
import {ProtologJson32, ProtologJson64} from '@compat/protolog';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceMetadata} from '@trace_api/trace_metadata';
import {TraceType} from '@trace_api/trace_type';

import {CONFIG_32, CONFIG_64} from './legacy_to_perfetto_configs';

export class FileReaderProtoLog extends AbstractFileReader<ProtoLogMessageUdc> {
  private static readonly MAGIC_NUMBER = [
    0x09, 0x50, 0x52, 0x4f, 0x54, 0x4f, 0x4c, 0x4f, 0x47,
  ]; // .PROTOLOG
  private static readonly PROTOLOG_32_BIT_VERSION = '1.0.0';
  private static readonly PROTOLOG_64_BIT_VERSION = '2.0.0';

  private realToBootTimeOffsetNs: bigint | undefined;

  constructor(
    traceFile: TraceFile,
    timestampConverter: ParserTimestampConverter,
    metadata?: TraceMetadata,
    logger: Logger = getLogger('ParserProtoLog'),
  ) {
    super(traceFile, timestampConverter, metadata, logger);
  }

  static async createInstance(
    trace: TraceFile,
    timestampConverter: ParserTimestampConverter,
  ): Promise<LegacyFileReader[]> {
    return new FileReaderProtoLog(trace, timestampConverter).read();
  }

  override getTraceType(): TraceType {
    return TraceType.PROTO_LOG;
  }

  override getMagicNumber(): number[] {
    return FileReaderProtoLog.MAGIC_NUMBER;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  override decodeTrace(buffer: Uint8Array): readonly ProtoLogMessageUdc[] {
    const offset = 9;
    const strippedBuffer = buffer.subarray(offset);
    const fileProto = ProtoLogFileProtoUdc.deserializeBinary(strippedBuffer);

    const firstLog = fileProto.getLogList().at(0);
    if (this.is32BitVersion(firstLog)) {
      if (
        ProtologJson32.version !== FileReaderProtoLog.PROTOLOG_32_BIT_VERSION
      ) {
        const message = `Unsupported ProtoLog JSON config version ${ProtologJson32.version}. Expected ${FileReaderProtoLog.PROTOLOG_32_BIT_VERSION}`;
        this.logger.error(message);
        throw new TypeError(message);
      }
    } else if (this.is64BitVersion(firstLog)) {
      if (
        ProtologJson64.version !== FileReaderProtoLog.PROTOLOG_64_BIT_VERSION
      ) {
        const message = `Unsupported ProtoLog JSON config version ${ProtologJson64.version}. Expected ${FileReaderProtoLog.PROTOLOG_64_BIT_VERSION}`;
        this.logger.error(message);
        throw new TypeError(message);
      }
    } else {
      const message = 'Unsupported ProtoLog trace version';
      this.logger.error(message);
      throw new TypeError(message);
    }

    this.realToBootTimeOffsetNs =
      BigInt(assertDefined(fileProto.getRealtimetoelapsedtimeoffsetmillis())) *
      1000000n;

    const logs = fileProto.getLogList();
    if (logs.length === 0) {
      return [];
    }

    const mutableLogs = [...logs];
    mutableLogs.sort((a: ProtoLogMessageUdc, b: ProtoLogMessageUdc) => {
      const aTime = BigInt(a.getElapsedRealtimeNanos() ?? '0');
      const bTime = BigInt(b.getElapsedRealtimeNanos() ?? '0');
      return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
    });

    return mutableLogs;
  }

  private is32BitVersion(entry: ProtoLogMessageUdc | undefined): boolean {
    return (entry?.getMessageHashLegacy() ?? 0) > 0;
  }

  private is64BitVersion(entry: ProtoLogMessageUdc | undefined): boolean {
    const hash = entry?.getMessageHash();
    return hash !== undefined && hash.toString() !== '0';
  }

  override convertToPerfettoPackets(
    sequenceId: number,
    trustedUid = 1,
    trustedPid = 1,
  ): PerfettoTracePacket[] {
    const packets = [];
    const firstPacket = this.createPacket(sequenceId, trustedUid, trustedPid);
    firstPacket.setSequenceFlags(
      PerfettoTracePacket.SequenceFlags.SEQ_INCREMENTAL_STATE_CLEARED,
    );
    packets.push(firstPacket);
    packets.push(this.makeViewerConfigPacket(sequenceId, trustedUid));

    const stringToIid = new Map<string, number>();
    let stringIid = 1;

    for (const entry of this.decodedEntries) {
      const packet = this.createPacket(sequenceId, trustedUid, trustedPid);
      packet.setTimestamp(assertDefined(entry.getElapsedRealtimeNanos()));
      packet.setTimestampClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );

      // needs to be any because of compatibility with BigInt type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let messageId: any;
      if (this.is64BitVersion(entry)) {
        messageId = assertDefined(entry.getMessageHash());
      } else {
        messageId = assertDefined(entry.getMessageHashLegacy());
      }

      const strParamIids: number[] = [];

      entry.getStrParamsList().forEach((param: string) => {
        const iid = stringToIid.get(param);
        if (iid !== undefined) {
          strParamIids.push(iid);
        } else {
          stringToIid.set(param, stringIid);
          const packet = this.createPacket(sequenceId, trustedUid, trustedPid);
          this.updateInternedDataPacket(packet, param, stringIid);
          packets.push(packet);
          strParamIids.push(stringIid);
          stringIid++;
        }
      });

      if (strParamIids.length > 0) {
        packet.setSequenceFlags(
          PerfettoTracePacket.SequenceFlags.SEQ_NEEDS_INCREMENTAL_STATE,
        );
      }

      const protoLogMessage = new PerfettoProtoLogMessage();
      protoLogMessage.setMessageId(
        BigInt.asUintN(64, BigInt(messageId)).toString(),
      );
      protoLogMessage.setStrParamIidsList(strParamIids);
      protoLogMessage.setSint64ParamsList(entry.getSint64ParamsList());
      protoLogMessage.setDoubleParamsList(entry.getDoubleParamsList());
      protoLogMessage.setBooleanParamsList(
        entry.getBooleanParamsList().map((param: boolean) => (param ? 1 : 0)),
      );

      packet.setProtologMessage(protoLogMessage);
      packets.push(packet);
    }

    return packets;
  }

  protected override getTimestamp(entry: ProtoLogMessageUdc): Timestamp {
    return this.timestampConverter.makeTimestampFromBootTimeNs(
      BigInt(assertDefined(entry.getElapsedRealtimeNanos())),
    );
  }

  private makeViewerConfigPacket(
    sequenceId: number,
    trustedUid: number,
  ): PerfettoTracePacket {
    const packet = this.createPacket(sequenceId, trustedUid, undefined);
    if (this.is64BitVersion(this.decodedEntries[0])) {
      packet.setProtologViewerConfig(CONFIG_64);
    } else {
      packet.setProtologViewerConfig(CONFIG_32);
    }
    return packet;
  }

  private updateInternedDataPacket(
    packet: PerfettoTracePacket,
    str: string,
    iid: number,
  ): PerfettoTracePacket {
    const internedString = new PerfettoInternedString();
    internedString.setIid(iid);
    internedString.setStr(utf8Encode(str));

    const internedData = new PerfettoInternedData();
    internedData.setProtologStringArgsList([internedString]);

    packet.setInternedData(internedData);
    return packet;
  }

  private createPacket(
    sequenceId: number,
    trustedUid: number | undefined,
    trustedPid: number | undefined,
  ): PerfettoTracePacket {
    const packet = new PerfettoTracePacket();
    packet.setTrustedPacketSequenceId(sequenceId);
    if (trustedUid !== undefined) {
      packet.setTrustedUid(trustedUid);
    }
    if (trustedPid !== undefined) {
      packet.setTrustedPid(trustedPid);
    }
    return packet;
  }
}

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
import {Timestamp} from '@common/time/time';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {InputMethodClientsTraceFileProtoUdc, InputMethodClientsTraceProtoUdc, PerfettoClockSnapshot, PerfettoInputMethodClientsTraceProto, PerfettoTracePacket, WinscopeExtensions, WinscopeExtensionsImpl,} from '@compat/protobuf';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

export class FileReaderInputMethodClients extends AbstractFileReader<InputMethodClientsTraceProtoUdc> {
  private static readonly MAGIC_NUMBER = [
    0x09, 0x49, 0x4d, 0x43, 0x54, 0x52, 0x41, 0x43, 0x45,
  ]; // .IMCTRACE

  private realToBootTimeOffsetNs: bigint | undefined;

  static async createInstance(
    trace: TraceFile,
    timestampConverter: ParserTimestampConverter,
  ): Promise<LegacyFileReader[]> {
    return new FileReaderInputMethodClients(trace, timestampConverter).read();
  }

  override getTraceType(): TraceType {
    return TraceType.INPUT_METHOD_CLIENTS;
  }

  override getMagicNumber(): number[] {
    return FileReaderInputMethodClients.MAGIC_NUMBER;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override decodeTrace(
    buffer: Uint8Array,
  ): readonly InputMethodClientsTraceProtoUdc[] {
    const decoded =
      InputMethodClientsTraceFileProtoUdc.deserializeBinary(buffer);
    const timeOffset = BigInt(decoded.getRealToElapsedTimeOffsetNanos() ?? '0');
    this.realToBootTimeOffsetNs = timeOffset !== 0n ? timeOffset : undefined;
    return decoded.getEntryList();
  }

  override convertToPerfettoPackets(sequenceId: number): PerfettoTracePacket[] {
    const packets: PerfettoTracePacket[] = [];

    for (const entry of this.decodedEntries) {
      const packet = new PerfettoTracePacket();
      packet.setTimestamp(entry.getElapsedRealtimeNanos() ?? '0');
      packet.setTimestampClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );
      packet.setTrustedPacketSequenceId(sequenceId);

      const perfettoProto =
        PerfettoInputMethodClientsTraceProto.deserializeBinary(
          entry.serializeBinary(),
        );
      const winscopeExtensions = new WinscopeExtensions();
      winscopeExtensions.setExtension(
        WinscopeExtensionsImpl.inputmethodClients,
        perfettoProto,
      );

      packet.setWinscopeExtensions(winscopeExtensions);
      packets.push(packet);
    }
    return packets;
  }

  protected override getTimestamp(
    entry: InputMethodClientsTraceProtoUdc,
  ): Timestamp {
    return this.timestampConverter.makeTimestampFromBootTimeNs(
      BigInt(assertDefined(entry.getElapsedRealtimeNanos())),
    );
  }
}

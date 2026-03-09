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
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';
import {InputMethodServiceTraceProto as AndroidInputMethodServiceTraceProto, InputMethodServiceTraceFileProto,} from '@protos/protos/ime/udc/inputmethodeditortrace_pb';
import {InputMethodServiceTraceProto} from '@protos/protos/perfetto/trace/android/inputmethodeditor_pb';
import {WinscopeExtensionsImpl} from '@protos/protos/perfetto/trace/android/winscope_extensions_impl_pb';
import {WinscopeExtensions} from '@protos/protos/perfetto/trace/android/winscope_extensions_pb';
import {ClockSnapshot} from '@protos/protos/perfetto/trace/clock_snapshot_pb';
import {TracePacket} from '@protos/protos/perfetto/trace/trace_packet_pb';
import {TraceType} from '@trace_api/trace_type';

import './input_method_service_patch';

export class FileReaderInputMethodService extends AbstractFileReader<AndroidInputMethodServiceTraceProto> {
  private static readonly MAGIC_NUMBER = [
    0x09, 0x49, 0x4d, 0x53, 0x54, 0x52, 0x41, 0x43, 0x45,
  ]; // .IMSTRACE

  private realToBootTimeOffsetNs: bigint | undefined;

  override getTraceType(): TraceType {
    return TraceType.INPUT_METHOD_SERVICE;
  }

  override getMagicNumber(): number[] {
    return FileReaderInputMethodService.MAGIC_NUMBER;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override decodeTrace(
    buffer: Uint8Array,
  ): AndroidInputMethodServiceTraceProto[] {
    const decoded = InputMethodServiceTraceFileProto.deserializeBinary(buffer);
    const timeOffset = BigInt(decoded.getRealToElapsedTimeOffsetNanos() ?? '0');
    this.realToBootTimeOffsetNs = timeOffset !== 0n ? timeOffset : undefined;
    return decoded.getEntryList();
  }

  override convertToPerfettoPackets(sequenceId: number): TracePacket[] {
    const packets: TracePacket[] = [];

    for (const entry of this.decodedEntries) {
      const packet = new TracePacket();
      packet.setTimestamp(entry.getElapsedRealtimeNanos() ?? '0');
      packet.setTimestampClockId(ClockSnapshot.Clock.BuiltinClocks.BOOTTIME);
      packet.setTrustedPacketSequenceId(sequenceId);

      const perfettoProto = InputMethodServiceTraceProto.deserializeBinary(
        entry.serializeBinary(),
      );
      const winscopeExtensions = new WinscopeExtensions();
      winscopeExtensions.setExtension(
        WinscopeExtensionsImpl.inputmethodService,
        perfettoProto,
      );

      packet.setWinscopeExtensions(winscopeExtensions);
      packets.push(packet);
    }
    return packets;
  }

  protected override getTimestamp(
    entry: AndroidInputMethodServiceTraceProto,
  ): Timestamp {
    return this.timestampConverter.makeTimestampFromBootTimeNs(
      BigInt(assertDefined(entry.getElapsedRealtimeNanos())),
    );
  }
}

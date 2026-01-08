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
import {ClockSnapshot, TracePacket} from '@compat/perfetto';
import {InputMethodClientsTraceProto} from '@compat/winscope_protos';
import {TraceType} from '@trace_api/trace_type';
import {android} from 'protos/ime/udc/static';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';

type ImeProto = android.view.inputmethod.IInputMethodClientsTraceProto;

export class FileReaderInputMethodClients extends AbstractFileReader<ImeProto> {
  private static readonly MAGIC_NUMBER = [
    0x09, 0x49, 0x4d, 0x43, 0x54, 0x52, 0x41, 0x43, 0x45,
  ]; // .IMCTRACE

  private realToBootTimeOffsetNs: bigint | undefined;

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

  override decodeTrace(buffer: Uint8Array): ImeProto[] {
    const decoded =
      android.view.inputmethod.InputMethodClientsTraceFileProto.decode(buffer);
    const timeOffset = BigInt(
      decoded.realToElapsedTimeOffsetNanos?.toString() ?? '0',
    );
    this.realToBootTimeOffsetNs = timeOffset !== 0n ? timeOffset : undefined;
    return decoded.entry ?? [];
  }

  override convertToPerfettoPackets(sequenceId: number): TracePacket[] {
    const packets = [];

    for (const entry of this.decodedEntries) {
      const packet = new TracePacket();
      packet.timestamp = assertDefined(entry.elapsedRealtimeNanos);
      packet.timestampClockId = ClockSnapshot.Clock.BuiltinClocks.BOOTTIME;
      packet.trustedPacketSequenceId = sequenceId;
      packet.winscopeExtensions = {
        '.perfetto.protos.WinscopeExtensionsImpl.inputmethodClients':
          InputMethodClientsTraceProto.fromObject(entry),
      };
      packets.push(packet);
    }
    return packets;
  }

  protected override getTimestamp(entry: ImeProto): Timestamp {
    return this.timestampConverter.makeTimestampFromBootTimeNs(
      BigInt(assertDefined(entry.elapsedRealtimeNanos).toString()),
    );
  }
}

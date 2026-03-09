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

import {Timestamp} from '@common/time/time';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';
import {WindowManagerServiceDumpProto} from '@protos/protos/perfetto/trace/android/server/windowmanagerservice_pb';
import {WindowManagerTraceEntry} from '@protos/protos/perfetto/trace/android/windowmanager_pb';
import {WinscopeExtensionsImpl} from '@protos/protos/perfetto/trace/android/winscope_extensions_impl_pb';
import {WinscopeExtensions} from '@protos/protos/perfetto/trace/android/winscope_extensions_pb';
import {ClockSnapshot} from '@protos/protos/perfetto/trace/clock_snapshot_pb';
import {TracePacket} from '@protos/protos/perfetto/trace/trace_packet_pb';
import {TraceType} from '@trace_api/trace_type';

/**
 * Parser for WindowManager dump files.
 */
export class FileReaderWindowManagerDump extends AbstractFileReader<WindowManagerServiceDumpProto> {
  override getTraceType(): TraceType {
    return TraceType.WINDOW_MANAGER;
  }

  override getMagicNumber(): number[] {
    return [];
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override decodeTrace(buffer: Uint8Array): WindowManagerServiceDumpProto[] {
    if (buffer.length === 0) {
      throw new TypeError('Empty buffer');
    }
    const decoded = WindowManagerServiceDumpProto.deserializeBinary(buffer);
    return [decoded];
  }

  protected override getTimestamp(_: WindowManagerServiceDumpProto): Timestamp {
    return this.timestampConverter.makeZeroTimestamp();
  }

  override convertToPerfettoPackets(sequenceId: number): TracePacket[] {
    const packets: TracePacket[] = [];
    for (const entry of this.decodedEntries) {
      const packet = new TracePacket();
      packet.setTimestamp('0');
      packet.setTimestampClockId(ClockSnapshot.Clock.BuiltinClocks.BOOTTIME);
      packet.setTrustedPacketSequenceId(sequenceId);

      const wmEntry = new WindowManagerTraceEntry();
      wmEntry.setElapsedRealtimeNanos('0');
      wmEntry.setWhere('dump');
      wmEntry.setWindowManagerService(entry);

      const extensions = new WinscopeExtensions();
      extensions.setExtension(WinscopeExtensionsImpl.windowmanager, wmEntry);

      packet.setWinscopeExtensions(extensions);
      packets.push(packet);
    }
    return packets;
  }
}

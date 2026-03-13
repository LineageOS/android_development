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
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {PerfettoClockSnapshot, PerfettoTracePacket, PerfettoWindowManagerServiceDumpProto, PerfettoWindowManagerTraceEntry, WinscopeExtensions, WinscopeExtensionsImpl,} from '@compat/protobuf';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

/**
 * Parser for WindowManager dump files.
 */
export class FileReaderWindowManagerDump extends AbstractFileReader<PerfettoWindowManagerServiceDumpProto> {
  static async createInstance(
    trace: TraceFile,
    timestampConverter: ParserTimestampConverter,
  ): Promise<LegacyFileReader[]> {
    return new FileReaderWindowManagerDump(trace, timestampConverter).read();
  }

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

  override decodeTrace(
    buffer: Uint8Array,
  ): readonly PerfettoWindowManagerServiceDumpProto[] {
    if (buffer.length === 0) {
      throw new TypeError('Empty buffer');
    }
    const decoded =
      PerfettoWindowManagerServiceDumpProto.deserializeBinary(buffer);
    return [decoded];
  }

  protected override getTimestamp(
    _: PerfettoWindowManagerServiceDumpProto,
  ): Timestamp {
    return this.timestampConverter.makeZeroTimestamp();
  }

  override convertToPerfettoPackets(sequenceId: number): PerfettoTracePacket[] {
    const packets: PerfettoTracePacket[] = [];
    for (const entry of this.decodedEntries) {
      const packet = new PerfettoTracePacket();
      packet.setTimestamp('0');
      packet.setTimestampClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );
      packet.setTrustedPacketSequenceId(sequenceId);

      const wmEntry = new PerfettoWindowManagerTraceEntry();
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

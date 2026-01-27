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
import {com} from 'protos/windowmanager/udc/static';
import Long from 'long';
import {TraceType} from '@trace_api/trace_type';
import {WindowManagerTraceEntry} from '@compat/winscope_protos';
import {TracePacket, ClockSnapshot} from '@compat/perfetto';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';

type DumpProto = com.android.server.wm.IWindowManagerServiceDumpProto;

/**
 * Parser for WindowManager dump files.
 */
export class FileReaderWindowManagerDump extends AbstractFileReader<DumpProto> {
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

  override decodeTrace(buffer: Uint8Array): DumpProto[] {
    const entryProto =
      com.android.server.wm.WindowManagerServiceDumpProto.decode(buffer);

    // This parser is prone to accepting invalid inputs because it lacks a magic
    // number. Reduce the chances of accepting invalid inputs by ensuring that the
    // decoded proto actually contains all valid DumpProto keys and is not empty.
    const objKeys = Object.getOwnPropertyNames(entryProto);
    if (
      objKeys.length === 0 ||
      !objKeys.every((key) => {
        return (
          key in com.android.server.wm.WindowManagerServiceDumpProto.prototype
        );
      })
    ) {
      throw new Error('Entry does not contain any WM dump data');
    }

    return [entryProto];
  }

  protected override getTimestamp(_: DumpProto): Timestamp {
    return this.timestampConverter.makeZeroTimestamp();
  }

  override convertToPerfettoPackets(sequenceId: number): TracePacket[] {
    const packets = [];
    for (const entry of this.decodedEntries) {
      const packet = new TracePacket();
      packet.timestamp = Long.fromInt(0);
      packet.timestampClockId = ClockSnapshot.Clock.BuiltinClocks.BOOTTIME;
      packet.trustedPacketSequenceId = sequenceId;
      packet.winscopeExtensions = {
        '.perfetto.protos.WinscopeExtensionsImpl.windowmanager':
          WindowManagerTraceEntry.fromObject({
            elapsedRealtimeNanos: 0,
            where: null,
            windowManagerService: entry,
          }),
      };
      packets.push(packet);
    }
    return packets;
  }
}

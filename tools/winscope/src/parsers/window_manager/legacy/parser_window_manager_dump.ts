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

import {assertDefined} from 'common/assert';
import {Timestamp} from 'common/time/time';
import {AbstractParser} from 'parsers/legacy/abstract_parser';
import {com} from 'protos/windowmanager/udc/static';
import Long from 'long';

import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {perfetto} from 'protos/perfetto/trace/static';
import {TAMPERED_PROTO_UDC} from './tampered_protos_udc';

type DumpProto = com.android.server.wm.IWindowManagerServiceDumpProto;

/**
 * Parser for WindowManager dump files.
 */
export class ParserWindowManagerDump extends AbstractParser<
  HierarchyTreeNode,
  DumpProto
> {
  private static TAMPERED_PROTO = assertDefined(
    TAMPERED_PROTO_UDC.fields['entry'].tamperedMessageType,
  ).fields['windowManagerService'];

  override getTraceType(): TraceType {
    return TraceType.WINDOW_MANAGER;
  }

  override getMagicNumber(): undefined {
    return undefined;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override decodeTrace(buffer: Uint8Array): DumpProto[] {
    const protoType = assertDefined(
      ParserWindowManagerDump.TAMPERED_PROTO.tamperedMessageType,
    );
    const entryProto = protoType.decode(buffer) as DumpProto;

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

  protected override getTimestamp(entryProto: DumpProto): Timestamp {
    return this.timestampConverter.makeZeroTimestamp();
  }

  override canConvertToPerfetto(): boolean {
    return true;
  }

  override convertToPerfettoPackets(
    sequenceId: number,
  ): perfetto.protos.TracePacket[] {
    const packets = [];
    for (const entry of this.decodedEntries) {
      const packet = perfetto.protos.TracePacket.create();
      packet.timestamp = Long.fromInt(0);
      packet.timestampClockId =
        perfetto.protos.ClockSnapshot.Clock.BuiltinClocks.BOOTTIME;
      packet.trustedPacketSequenceId = sequenceId;
      packet.winscopeExtensions = {
        '.perfetto.protos.WinscopeExtensionsImpl.windowmanager':
          perfetto.protos.WindowManagerTraceEntry.fromObject({
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

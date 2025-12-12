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
import {AbstractParser} from '@parsers/legacy/abstract_parser';
import {com} from 'protos/windowmanager/udc/static';

import {TraceType} from '@trace_api/trace_type';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {WindowManagerTraceEntry} from '@compat/winscope_protos';
import {TracePacket, ClockSnapshot} from '@compat/perfetto';
import {TAMPERED_PROTO_UDC} from './tampered_protos_udc';

type WindowManagerProto = com.android.server.wm.IWindowManagerTraceProto;

/**
 * Parser for WindowManager trace files.
 */
export class ParserWindowManager extends AbstractParser<
  HierarchyTreeNode,
  WindowManagerProto
> {
  private static readonly MAGIC_NUMBER = [
    0x09, 0x57, 0x49, 0x4e, 0x54, 0x52, 0x41, 0x43, 0x45,
  ]; // .WINTRACE

  private realToBootTimeOffsetNs: bigint | undefined;

  override getTraceType(): TraceType {
    return TraceType.WINDOW_MANAGER;
  }

  override getMagicNumber(): number[] {
    return ParserWindowManager.MAGIC_NUMBER;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override decodeTrace(buffer: Uint8Array): WindowManagerProto[] {
    const decoded = TAMPERED_PROTO_UDC.decode(
      buffer,
    ) as com.android.server.wm.IWindowManagerTraceFileProto;
    const timeOffset = BigInt(
      decoded.realToElapsedTimeOffsetNanos?.toString() ?? '0',
    );
    this.realToBootTimeOffsetNs = timeOffset !== 0n ? timeOffset : undefined;
    return decoded.entry ?? [];
  }

  protected override getTimestamp(entry: WindowManagerProto): Timestamp {
    return this.timestampConverter.makeTimestampFromBootTimeNs(
      BigInt(assertDefined(entry.elapsedRealtimeNanos).toString()),
    );
  }

  override canConvertToPerfetto(): boolean {
    return true;
  }

  override convertToPerfettoPackets(sequenceId: number): TracePacket[] {
    const packets = [];
    for (const entry of this.decodedEntries) {
      const packet = new TracePacket();
      packet.timestamp = assertDefined(entry.elapsedRealtimeNanos);
      packet.timestampClockId = ClockSnapshot.Clock.BuiltinClocks.BOOTTIME;
      packet.trustedPacketSequenceId = sequenceId;
      packet.winscopeExtensions = {
        '.perfetto.protos.WinscopeExtensionsImpl.windowmanager':
          WindowManagerTraceEntry.fromObject(entry),
      };
      packets.push(packet);
    }
    return packets;
  }
}

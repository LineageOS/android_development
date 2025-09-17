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
import {RectsComputation} from 'parsers/window_manager/computations/rects_computation';
import {HierarchyTreeBuilderWm} from 'parsers/window_manager/hierarchy_tree_builder_wm';
import {PropertiesProviderFactory} from 'parsers/window_manager/properties_provider_factory';
import {com} from 'protos/windowmanager/udc/static';
import Long from 'long';

import {TraceType} from 'trace_api/trace_type';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {PropertiesProvider} from 'tree_node/properties_provider';
import {TAMPERED_PROTOS_UDC} from './tampered_protos_udc';
import {perfetto} from 'protos/perfetto/trace/static';

type DumpProto = com.android.server.wm.IWindowManagerServiceDumpProto;

/**
 * Parser for WindowManager dump files.
 */
export class ParserWindowManagerDump extends AbstractParser<
  HierarchyTreeNode,
  DumpProto
> {
  private readonly factory = new PropertiesProviderFactory(TAMPERED_PROTOS_UDC);

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
    const entryProto = assertDefined(
      TAMPERED_PROTOS_UDC.windowManagerServiceField.tamperedMessageType,
    ).decode(buffer) as DumpProto;

    // This parser is prone to accepting invalid inputs because it lacks a magic
    // number. Let's reduce the chances of accepting invalid inputs by making
    // sure that a trace entry can actually be created from the decoded proto.
    // If the trace entry creation fails, an exception is thrown and the parser
    // will be considered unsuited for this input data.
    this.makeHierarchyTree(entryProto);

    return [entryProto];
  }

  protected override getTimestamp(entryProto: DumpProto): Timestamp {
    return this.timestampConverter.makeZeroTimestamp();
  }

  private makeHierarchyTree(entryProto: DumpProto): HierarchyTreeNode {
    const containers: PropertiesProvider[] =
      this.factory.makeContainerProperties(assertDefined(entryProto));

    const entry = this.factory.makeEntryProperties(entryProto);

    return new HierarchyTreeBuilderWm()
      .setRoot(entry)
      .setChildren(containers)
      .setComputations([new RectsComputation()])
      .build();
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

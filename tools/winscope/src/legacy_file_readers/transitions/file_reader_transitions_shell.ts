/*
 * Copyright (C) 2023 The Android Open Source Project
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
import {
  ShellHandlerMappings,
  ShellHandlerMapping,
  IShellTransition as PerfettoTransition,
} from '@compat/winscope_protos';
import {ClockSnapshot, TracePacket} from '@compat/perfetto';
import Long from 'long';
import {com} from 'protos/transitions/udc/static';
import {TraceType} from '@trace_api/trace_type';
import {nullifyIfDefaultValue} from './perfetto_conversion_helpers';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';
import {assertDefined} from '@common/assert';

/**
 * Parser for Shell Transition trace files.
 */
export class FileReaderTransitionsShell extends AbstractFileReader<PerfettoTransition> {
  private realToBootTimeOffsetNs: bigint | undefined;
  private handlerMapping: undefined | HandlerMapping[];

  override getTraceType(): TraceType {
    return TraceType.SHELL_TRANSITION;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override decodeTrace(traceBuffer: Uint8Array): PerfettoTransition[] {
    const decodedProto =
      com.android.wm.shell.WmShellTransitionTraceProto.decode(traceBuffer);
    const timeOffset = BigInt(
      decodedProto.realToElapsedTimeOffsetNanos?.toString() ?? '0',
    );
    this.realToBootTimeOffsetNs = timeOffset !== 0n ? timeOffset : undefined;
    this.handlerMapping = decodedProto.handlerMappings ?? [];
    return (
      decodedProto.transitions?.map((transition) => {
        return this.convertToPerfettoTransition(transition);
      }) ?? []
    );
  }

  override convertToPerfettoPackets(sequenceId: number): TracePacket[] {
    const packets = [this.createHandlerMappingPacket(sequenceId)];
    this.decodedEntries.forEach((entry) => {
      const packet = new TracePacket();
      const ns = entry.dispatchTimeNs ?? 0n;
      packet.timestamp = Long.fromString(ns.toString());
      packet.timestampClockId = ClockSnapshot.Clock.BuiltinClocks.BOOTTIME;
      packet.shellTransition = entry;
      packets.push(packet);
    });
    return packets;
  }

  private createHandlerMappingPacket(sequenceId: number): TracePacket {
    const packet = new TracePacket();
    packet.trustedPacketSequenceId = sequenceId;
    const shellHandlerMappings = new ShellHandlerMappings();
    const mapping = assertDefined(this.handlerMapping)
      .map((m) => {
        const newMap = new ShellHandlerMapping();
        if (
          (m.id ?? undefined) === undefined ||
          (m.name ?? undefined) === undefined
        ) {
          return undefined;
        }
        newMap.id = assertDefined(m.id);
        newMap.name = assertDefined(m.name);
        return newMap;
      })
      .filter((m) => m !== undefined);
    shellHandlerMappings.mapping = mapping;
    packet.shellHandlerMappings = shellHandlerMappings;
    return packet;
  }

  protected override getTimestamp(entry: ShellTransition): Timestamp {
    return entry.dispatchTimeNs
      ? this.timestampConverter.makeTimestampFromBootTimeNs(
          BigInt(entry.dispatchTimeNs.toString()),
        )
      : this.timestampConverter.makeZeroTimestamp();
  }

  protected getMagicNumber(): number[] {
    return [0x09, 0x57, 0x4d, 0x53, 0x54, 0x52, 0x41, 0x43, 0x45]; // .WMSTRACE
  }

  private convertToPerfettoTransition(
    shellTransition: ShellTransition,
  ): PerfettoTransition {
    const perfettoTransition: PerfettoTransition = {
      id: shellTransition.id,
      dispatchTimeNs: nullifyIfDefaultValue(shellTransition.dispatchTimeNs),
      mergeTimeNs: nullifyIfDefaultValue(shellTransition.mergeTimeNs),
      mergeRequestTimeNs: nullifyIfDefaultValue(
        shellTransition.mergeRequestTimeNs,
      ),
      shellAbortTimeNs: nullifyIfDefaultValue(shellTransition.abortTimeNs),
      handler: nullifyIfDefaultValue(shellTransition.handler),
      mergeTarget: nullifyIfDefaultValue(shellTransition.mergeTarget),
    };
    return perfettoTransition;
  }
}

type ShellTransition = com.android.wm.shell.ITransition;
type HandlerMapping = com.android.wm.shell.IHandlerMapping;

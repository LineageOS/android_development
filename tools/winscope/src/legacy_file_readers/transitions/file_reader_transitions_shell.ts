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

import {assertDefined} from '@common/assert';
import {Timestamp} from '@common/time/time';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {PerfettoClockSnapshot, PerfettoShellHandlerMapping, PerfettoShellHandlerMappings, PerfettoShellTransition, PerfettoTracePacket, ShellHandlerMappingUdc, ShellTransitionProtoUdc, WmShellTransitionTraceProtoUdc,} from '@compat/protobuf';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

import {nullifyIfDefaultValue} from './perfetto_conversion_helpers';

/**
 * Parser for Shell Transition trace files.
 */
export class FileReaderTransitionsShell extends AbstractFileReader<PerfettoShellTransition> {
  private realToBootTimeOffsetNs: bigint | undefined;
  private handlerMapping: undefined | readonly ShellHandlerMappingUdc[];

  static async createInstance(
    trace: TraceFile,
    timestampConverter: ParserTimestampConverter,
  ): Promise<LegacyFileReader[]> {
    return new FileReaderTransitionsShell(trace, timestampConverter).read();
  }

  override getTraceType(): TraceType {
    return TraceType.SHELL_TRANSITION;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override decodeTrace(
    traceBuffer: Uint8Array,
  ): readonly PerfettoShellTransition[] {
    const decodedProto =
      WmShellTransitionTraceProtoUdc.deserializeBinary(traceBuffer);
    const timeOffset = BigInt(
      decodedProto.getRealToElapsedTimeOffsetNanos() ?? '0',
    );
    this.realToBootTimeOffsetNs = timeOffset !== 0n ? timeOffset : undefined;
    this.handlerMapping = decodedProto.getHandlermappingsList() ?? [];
    return (
      decodedProto.getTransitionsList()?.map((transition) => {
        return this.convertToPerfettoTransition(transition);
      }) ?? []
    );
  }

  override convertToPerfettoPackets(sequenceId: number): PerfettoTracePacket[] {
    const packets = [this.createHandlerMappingPacket(sequenceId)];
    this.decodedEntries.forEach((entry) => {
      const packet = new PerfettoTracePacket();
      const ns = entry.getDispatchTimeNs() ?? '0';
      packet.setTimestamp(ns);
      packet.setTimestampClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );

      const shellTransition = new PerfettoShellTransition();
      if (entry.hasId()) {
        shellTransition.setId(assertDefined(entry.getId()));
      }
      if (entry.hasDispatchTimeNs()) {
        shellTransition.setDispatchTimeNs(
          assertDefined(entry.getDispatchTimeNs()),
        );
      }
      if (entry.hasMergeTimeNs()) {
        shellTransition.setMergeTimeNs(assertDefined(entry.getMergeTimeNs()));
      }
      if (entry.hasMergeRequestTimeNs()) {
        shellTransition.setMergeRequestTimeNs(
          assertDefined(entry.getMergeRequestTimeNs()),
        );
      }
      if (entry.hasShellAbortTimeNs()) {
        shellTransition.setShellAbortTimeNs(
          assertDefined(entry.getShellAbortTimeNs()),
        );
      }
      if (entry.hasHandler()) {
        shellTransition.setHandler(assertDefined(entry.getHandler()));
      }
      if (entry.hasMergeTarget()) {
        shellTransition.setMergeTarget(assertDefined(entry.getMergeTarget()));
      }
      packet.setShellTransition(shellTransition);
      packets.push(packet);
    });
    return packets;
  }

  private createHandlerMappingPacket(sequenceId: number): PerfettoTracePacket {
    const packet = new PerfettoTracePacket();
    packet.setTrustedPacketSequenceId(sequenceId);
    const shellHandlerMappings = new PerfettoShellHandlerMappings();
    const mapping = assertDefined(this.handlerMapping)
      .map((m) => {
        const newMap = new PerfettoShellHandlerMapping();
        if (!m.hasId() || !m.hasName()) {
          return undefined;
        }
        newMap.setId(assertDefined(m.getId()));
        newMap.setName(assertDefined(m.getName()));
        return newMap;
      })
      .filter((m) => m !== undefined) as PerfettoShellHandlerMapping[];
    shellHandlerMappings.setMappingList(mapping);
    packet.setShellHandlerMappings(shellHandlerMappings);
    return packet;
  }

  protected override getTimestamp(entry: PerfettoShellTransition): Timestamp {
    return entry.hasDispatchTimeNs()
      ? this.timestampConverter.makeTimestampFromBootTimeNs(
          BigInt(assertDefined(entry.getDispatchTimeNs())),
        )
      : this.timestampConverter.makeZeroTimestamp();
  }

  protected getMagicNumber(): number[] {
    return [0x09, 0x57, 0x4d, 0x53, 0x54, 0x52, 0x41, 0x43, 0x45]; // .WMSTRACE
  }

  private convertToPerfettoTransition(
    shellTransition: ShellTransitionProtoUdc,
  ): PerfettoShellTransition {
    const perfettoTransition = new PerfettoShellTransition();
    perfettoTransition.setId(assertDefined(shellTransition.getId()));
    if (
      shellTransition.hasDispatchTimeNs() &&
      nullifyIfDefaultValue(shellTransition.getDispatchTimeNs()?.toString()) !==
        null
    ) {
      perfettoTransition.setDispatchTimeNs(
        assertDefined(shellTransition.getDispatchTimeNs()),
      );
    }
    if (
      shellTransition.hasMergeTimeNs() &&
      nullifyIfDefaultValue(shellTransition.getMergeTimeNs()?.toString()) !==
        null
    ) {
      perfettoTransition.setMergeTimeNs(
        assertDefined(shellTransition.getMergeTimeNs()),
      );
    }
    if (
      shellTransition.hasMergeRequestTimeNs() &&
      nullifyIfDefaultValue(
        shellTransition.getMergeRequestTimeNs()?.toString(),
      ) !== null
    ) {
      perfettoTransition.setMergeRequestTimeNs(
        assertDefined(shellTransition.getMergeRequestTimeNs()),
      );
    }
    if (
      shellTransition.hasAbortTimeNs() &&
      nullifyIfDefaultValue(shellTransition.getAbortTimeNs()?.toString()) !==
        null
    ) {
      perfettoTransition.setShellAbortTimeNs(
        assertDefined(shellTransition.getAbortTimeNs()),
      );
    }
    if (
      shellTransition.hasHandler() &&
      nullifyIfDefaultValue(shellTransition.getHandler()) !== null
    ) {
      perfettoTransition.setHandler(
        assertDefined(shellTransition.getHandler()),
      );
    }
    if (
      shellTransition.hasMergeTarget() &&
      nullifyIfDefaultValue(shellTransition.getMergeTarget()) !== null
    ) {
      perfettoTransition.setMergeTarget(
        assertDefined(shellTransition.getMergeTarget()),
      );
    }
    return perfettoTransition;
  }
}

/*
 * Copyright (C) 2023 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {assertDefined, assertTrue} from '@common/assert';
import {getMax} from '@common/bigint_math';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import Long from 'long';
import {TracePacket, ClockSnapshot} from '@compat/perfetto';
import {TraceType} from '@trace_api/trace_type';
import {IShellTransition as PerfettoTransition} from '@compat/winscope_protos';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {Timestamp} from '@common/time/time';
import {TraceFile} from '@trace/trace_file';
import {NOT_IMPLEMENTED_ERROR} from '@common/errors';

/**
 * A parser that processes and merges WM and Shell transition traces.
 */
export class FileReaderTransitions implements LegacyFileReader {
  private readonly parserShell: LegacyFileReader;
  private readonly parserWm: LegacyFileReader;
  private readonly descriptors: string[];
  private readonly timestampConverter: ParserTimestampConverter;
  private decodedEntries: PerfettoTransition[] | undefined;
  private realToBootTimeOffsetNs: bigint | undefined;
  private handlerMappingPacket: TracePacket | undefined;
  private timestamps: Timestamp[] | undefined;

  constructor(
    parserShell: LegacyFileReader,
    parserWm: LegacyFileReader,
    timestampConverter: ParserTimestampConverter,
  ) {
    this.parserShell = parserShell;
    this.parserWm = parserWm;
    this.descriptors = this.parserWm
      .getDescriptors()
      .concat(this.parserShell.getDescriptors());
    this.timestampConverter = timestampConverter;
  }

  getFiles(): TraceFile[] {
    return this.parserWm.getFiles().concat(this.parserShell.getFiles());
  }

  read() {
    const wmOffset = this.parserWm.getRealToBootTimeOffsetNs();
    const shellOffset = this.parserShell.getRealToBootTimeOffsetNs();

    this.realToBootTimeOffsetNs = getMax([wmOffset ?? 0n, shellOffset ?? 0n]);
    if (this.realToBootTimeOffsetNs === 0n) {
      this.realToBootTimeOffsetNs = undefined;
    }

    const shellPackets = this.parserShell.convertToPerfettoPackets(0);
    this.handlerMappingPacket = shellPackets[0];
    const shellTransitions = shellPackets
      .slice(1)
      .map((packet) => assertDefined(packet.shellTransition));

    const wmTransitions = this.parserWm
      .convertToPerfettoPackets(0)
      .map((packet) => assertDefined(packet.shellTransition));

    this.decodedEntries = this.compressEntries(
      wmTransitions.concat(shellTransitions),
    );

    this.createTimestamps();
  }

  createTimestamps() {
    this.timestamps = [];
    const zeroTs = this.timestampConverter.makeZeroTimestamp();
    for (let index = 0; index < this.getLengthEntries(); index++) {
      const entry = assertDefined(this.decodedEntries)[index];
      const ns = this.getTimestampNsFromTransitionProperties(entry);
      const ts =
        ns !== undefined && ns !== 0n
          ? this.timestampConverter.makeTimestampFromBootTimeNs(ns)
          : zeroTs;
      this.timestamps.push(ts);
    }
  }

  getTimestamps(): Timestamp[] {
    if (!this.timestamps) {
      throw NOT_IMPLEMENTED_ERROR;
    }
    return this.timestamps;
  }

  getLengthEntries(): number {
    return assertDefined(this.decodedEntries).length;
  }

  getDescriptors(): string[] {
    return this.descriptors;
  }

  getTraceType(): TraceType {
    return TraceType.TRANSITION;
  }

  getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  convertToPerfettoPackets(sequenceId: number): TracePacket[] {
    const packets = [];

    const handlerMappingPacket = assertDefined(this.handlerMappingPacket);
    handlerMappingPacket.trustedPacketSequenceId = sequenceId;
    packets.push(handlerMappingPacket);

    for (const entry of assertDefined(this.decodedEntries)) {
      const packet = new TracePacket();
      packet.trustedPacketSequenceId = sequenceId;
      const ns = this.getTimestampNsFromTransitionProperties(entry) ?? 0n;
      packet.timestamp = Long.fromString(ns.toString());
      packet.timestampClockId = ClockSnapshot.Clock.BuiltinClocks.BOOTTIME;
      packet.shellTransition = entry;
      packets.push(packet);
    }

    return packets;
  }

  private compressEntries(
    transitions: PerfettoTransition[],
  ): PerfettoTransition[] {
    const idToTransition = new Map<number, PerfettoTransition>();
    for (const transition of transitions) {
      const id = assertDefined(transition.id);
      const accumulatedTransition = idToTransition.get(id);
      if (!accumulatedTransition) {
        idToTransition.set(id, transition);
      } else {
        const mergedTransition = this.mergePartialTransitions(
          accumulatedTransition,
          transition,
        );
        idToTransition.set(id, mergedTransition);
      }
    }
    const compressedTransitions = Array.from(idToTransition.values());
    return compressedTransitions.sort((a, b) => this.compareByTimestamp(a, b));
  }

  private compareByTimestamp(
    a: PerfettoTransition,
    b: PerfettoTransition,
  ): number {
    const aNs = this.getTimestampNsFromTransitionProperties(a) ?? 0n;
    const bNs = this.getTimestampNsFromTransitionProperties(b) ?? 0n;
    if (aNs !== bNs) {
      return aNs < bNs ? -1 : 1;
    }
    // fallback to id
    assertTrue(a.id !== b.id);
    return assertDefined(a.id) < assertDefined(b.id) ? -1 : 1;
  }

  private getTimestampNsFromTransitionProperties(
    transition: PerfettoTransition,
  ): bigint | undefined {
    // Entry timestamps are defined as send time - if this is null and shell
    // dispatch time is not null we fall back on shell dispatch time
    const ns = transition.sendTimeNs ?? transition.dispatchTimeNs;
    if (!ns) {
      return undefined;
    }
    return BigInt(ns.toString());
  }

  private mergePartialTransitions(
    transition1: PerfettoTransition,
    transition2: PerfettoTransition,
  ): PerfettoTransition {
    assertTrue(transition1.id === transition2.id);
    const mergedTransition = Object.assign({}, transition1);
    Object.entries(transition2).forEach(([key, value]) => {
      if (value !== undefined) {
        Object.assign(mergedTransition, {[key]: value});
      }
    });
    return mergedTransition;
  }
}

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
import {NOT_IMPLEMENTED_ERROR} from '@common/errors';
import {Timestamp} from '@common/time/time';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {PerfettoClockSnapshot, PerfettoShellTransition, PerfettoTracePacket,} from '@compat/protobuf';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

/**
 * A parser that processes and merges WM and Shell transition traces.
 */
export class FileReaderTransitions implements LegacyFileReader {
  private readonly parserShell: LegacyFileReader;
  private readonly parserWm: LegacyFileReader;
  private readonly descriptors: string[];
  private readonly timestampConverter: ParserTimestampConverter;
  private decodedEntries: PerfettoShellTransition[] | undefined;
  private realToBootTimeOffsetNs: bigint | undefined;
  private handlerMappingPacket: PerfettoTracePacket | undefined;
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
      .map((packet) => assertDefined(packet.getShellTransition()));

    const wmTransitions = this.parserWm
      .convertToPerfettoPackets(0)
      .map((packet) => assertDefined(packet.getShellTransition()));

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

  convertToPerfettoPackets(sequenceId: number): PerfettoTracePacket[] {
    const packets = [];

    const handlerMappingPacket = assertDefined(this.handlerMappingPacket);
    handlerMappingPacket.setTrustedPacketSequenceId(sequenceId);
    packets.push(handlerMappingPacket);

    for (const entry of assertDefined(this.decodedEntries)) {
      const packet = new PerfettoTracePacket();
      packet.setTrustedPacketSequenceId(sequenceId);
      const ns = this.getTimestampNsFromTransitionProperties(entry) ?? 0n;
      packet.setTimestamp(ns.toString());
      packet.setTimestampClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );
      const shellTransition = new PerfettoShellTransition();
      if (entry.hasId()) shellTransition.setId(assertDefined(entry.getId()));
      if (entry.hasCreateTimeNs()) {
        shellTransition.setCreateTimeNs(assertDefined(entry.getCreateTimeNs()));
      }
      if (entry.hasSendTimeNs()) {
        shellTransition.setSendTimeNs(assertDefined(entry.getSendTimeNs()));
      }
      if (entry.hasWmAbortTimeNs()) {
        shellTransition.setWmAbortTimeNs(
          assertDefined(entry.getWmAbortTimeNs()),
        );
      }
      if (entry.hasFinishTimeNs()) {
        shellTransition.setFinishTimeNs(assertDefined(entry.getFinishTimeNs()));
      }
      if (entry.hasStartTransactionId()) {
        shellTransition.setStartTransactionId(
          assertDefined(entry.getStartTransactionId()),
        );
      }
      if (entry.hasFinishTransactionId()) {
        shellTransition.setFinishTransactionId(
          assertDefined(entry.getFinishTransactionId()),
        );
      }
      if (entry.hasType()) {
        shellTransition.setType(assertDefined(entry.getType()));
      }
      if (entry.getChangesList().length > 0) {
        shellTransition.setChangesList(
          entry
            .getChangesList()
            .map((change: PerfettoShellTransition.Change) => {
              const t = new PerfettoShellTransition.Change();
              if (change.hasMode()) t.setMode(assertDefined(change.getMode()));
              if (change.hasLayerId()) {
                t.setLayerId(assertDefined(change.getLayerId()));
              }
              if (change.hasWindowId()) {
                t.setWindowId(assertDefined(change.getWindowId()));
              }
              if (change.hasFlags()) {
                t.setFlags(assertDefined(change.getFlags()));
              }
              return t;
            }),
        );
      }
      if (entry.hasFlags()) {
        shellTransition.setFlags(assertDefined(entry.getFlags()));
      }
      if (
        entry.hasStartingWindowRemoveTimeNs() &&
        entry.getStartingWindowRemoveTimeNs()?.toString() !== '0'
      ) {
        shellTransition.setStartingWindowRemoveTimeNs(
          assertDefined(entry.getStartingWindowRemoveTimeNs()),
        );
      }
      if (
        entry.hasDispatchTimeNs() &&
        entry.getDispatchTimeNs()?.toString() !== '0'
      ) {
        shellTransition.setDispatchTimeNs(
          assertDefined(entry.getDispatchTimeNs()),
        );
      }
      if (
        entry.hasMergeTimeNs() &&
        entry.getMergeTimeNs()?.toString() !== '0'
      ) {
        shellTransition.setMergeTimeNs(assertDefined(entry.getMergeTimeNs()));
      }
      if (
        entry.hasMergeRequestTimeNs() &&
        entry.getMergeRequestTimeNs()?.toString() !== '0'
      ) {
        shellTransition.setMergeRequestTimeNs(
          assertDefined(entry.getMergeRequestTimeNs()),
        );
      }
      if (
        entry.hasShellAbortTimeNs() &&
        entry.getShellAbortTimeNs()?.toString() !== '0'
      ) {
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
    }

    return packets;
  }

  private compressEntries(
    transitions: PerfettoShellTransition[],
  ): PerfettoShellTransition[] {
    const idToTransition = new Map<number, PerfettoShellTransition>();
    for (const transition of transitions) {
      const id = assertDefined(transition.getId());
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
    a: PerfettoShellTransition,
    b: PerfettoShellTransition,
  ): number {
    const aNs = this.getTimestampNsFromTransitionProperties(a) ?? 0n;
    const bNs = this.getTimestampNsFromTransitionProperties(b) ?? 0n;
    if (aNs !== bNs) {
      return aNs < bNs ? -1 : 1;
    }
    // fallback to id
    assertTrue(a.getId() !== b.getId());
    return assertDefined(a.getId()) < assertDefined(b.getId()) ? -1 : 1;
  }

  private getTimestampNsFromTransitionProperties(
    transition: PerfettoShellTransition,
  ): bigint | undefined {
    // Entry timestamps are defined as send time - if this is null and shell
    // dispatch time is not null we fall back on shell dispatch time
    let ns: string | undefined;
    if (
      transition.hasSendTimeNs() &&
      transition.getSendTimeNs()?.toString() !== '0'
    ) {
      ns = transition.getSendTimeNs()?.toString();
    } else if (
      transition.hasDispatchTimeNs() &&
      transition.getDispatchTimeNs()?.toString() !== '0'
    ) {
      ns = transition.getDispatchTimeNs()?.toString();
    }

    if (!ns) {
      return undefined;
    }
    return BigInt(ns);
  }

  private mergePartialTransitions(
    transition1: PerfettoShellTransition,
    transition2: PerfettoShellTransition,
  ): PerfettoShellTransition {
    assertTrue(transition1.getId() === transition2.getId());
    const mergedTransition = transition1.clone();

    if (
      transition2.hasCreateTimeNs() &&
      transition2.getCreateTimeNs()?.toString() !== '0'
    ) {
      mergedTransition.setCreateTimeNs(
        assertDefined(transition2.getCreateTimeNs()),
      );
    }
    if (
      transition2.hasSendTimeNs() &&
      transition2.getSendTimeNs()?.toString() !== '0'
    ) {
      mergedTransition.setSendTimeNs(
        assertDefined(transition2.getSendTimeNs()),
      );
    }
    if (
      transition2.hasDispatchTimeNs() &&
      transition2.getDispatchTimeNs()?.toString() !== '0'
    ) {
      mergedTransition.setDispatchTimeNs(
        assertDefined(transition2.getDispatchTimeNs()),
      );
    }
    if (
      transition2.hasMergeTimeNs() &&
      transition2.getMergeTimeNs()?.toString() !== '0'
    ) {
      mergedTransition.setMergeTimeNs(
        assertDefined(transition2.getMergeTimeNs()),
      );
    }
    if (
      transition2.hasMergeRequestTimeNs() &&
      transition2.getMergeRequestTimeNs()?.toString() !== '0'
    ) {
      mergedTransition.setMergeRequestTimeNs(
        assertDefined(transition2.getMergeRequestTimeNs()),
      );
    }
    if (
      transition2.hasShellAbortTimeNs() &&
      transition2.getShellAbortTimeNs()?.toString() !== '0'
    ) {
      mergedTransition.setShellAbortTimeNs(
        assertDefined(transition2.getShellAbortTimeNs()),
      );
    }
    if (
      transition2.hasWmAbortTimeNs() &&
      transition2.getWmAbortTimeNs()?.toString() !== '0'
    ) {
      mergedTransition.setWmAbortTimeNs(
        assertDefined(transition2.getWmAbortTimeNs()),
      );
    }
    if (
      transition2.hasFinishTimeNs() &&
      transition2.getFinishTimeNs()?.toString() !== '0'
    ) {
      mergedTransition.setFinishTimeNs(
        assertDefined(transition2.getFinishTimeNs()),
      );
    }
    if (
      transition2.hasStartTransactionId() &&
      transition2.getStartTransactionId()?.toString() !== '0'
    ) {
      mergedTransition.setStartTransactionId(
        assertDefined(transition2.getStartTransactionId()),
      );
    }
    if (
      transition2.hasFinishTransactionId() &&
      transition2.getFinishTransactionId()?.toString() !== '0'
    ) {
      mergedTransition.setFinishTransactionId(
        assertDefined(transition2.getFinishTransactionId()),
      );
    }
    if (transition2.hasType() && transition2.getType() !== 0) {
      mergedTransition.setType(assertDefined(transition2.getType()));
    }
    if (transition2.getChangesList().length > 0) {
      mergedTransition.setChangesList(transition2.getChangesList());
    }
    if (transition2.hasFlags() && transition2.getFlags() !== 0) {
      mergedTransition.setFlags(assertDefined(transition2.getFlags()));
    }
    if (
      transition2.hasStartingWindowRemoveTimeNs() &&
      transition2.getStartingWindowRemoveTimeNs()?.toString() !== '0'
    ) {
      mergedTransition.setStartingWindowRemoveTimeNs(
        assertDefined(transition2.getStartingWindowRemoveTimeNs()),
      );
    }
    if (transition2.hasHandler() && transition2.getHandler() !== 0) {
      mergedTransition.setHandler(assertDefined(transition2.getHandler()));
    }
    if (transition2.hasMergeTarget() && transition2.getMergeTarget() !== 0) {
      mergedTransition.setMergeTarget(
        assertDefined(transition2.getMergeTarget()),
      );
    }

    return mergedTransition;
  }
}

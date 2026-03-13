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
import {PerfettoClockSnapshot, PerfettoShellTransition, PerfettoTracePacket, TargetUdc, TransitionTraceProtoUdc, TransitionUdc,} from '@compat/protobuf';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

/**
 * Parser for WM Transition trace files.
 */
export class FileReaderTransitionsWm extends AbstractFileReader<TransitionUdc> {
  private realToBootTimeOffsetNs: bigint | undefined;

  static async createInstance(
    trace: TraceFile,
    timestampConverter: ParserTimestampConverter,
  ): Promise<LegacyFileReader[]> {
    return new FileReaderTransitionsWm(trace, timestampConverter).read();
  }

  override getTraceType(): TraceType {
    return TraceType.WM_TRANSITION;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override decodeTrace(buffer: Uint8Array): readonly TransitionUdc[] {
    const decodedProto = TransitionTraceProtoUdc.deserializeBinary(buffer);

    const timeOffset = BigInt(
      decodedProto.getRealToElapsedTimeOffsetNanos() ?? '0',
    );
    this.realToBootTimeOffsetNs = timeOffset !== 0n ? timeOffset : undefined;

    return decodedProto.getTransitionsList();
  }

  override getMagicNumber(): number[] {
    return [0x09, 0x54, 0x52, 0x4e, 0x54, 0x52, 0x41, 0x43, 0x45]; // .TRNTRACE
  }

  override convertToPerfettoPackets(): PerfettoTracePacket[] {
    return this.decodedEntries.map((entry) => {
      const packet = new PerfettoTracePacket();
      const ns = entry.getSendTimeNs() ?? 0n;
      packet.setTimestamp(ns.toString());
      packet.setTimestampClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );

      const shellTransition = new PerfettoShellTransition();
      shellTransition.setId(entry.getId() ?? 0);
      if (entry.hasCreateTimeNs()) {
        shellTransition.setCreateTimeNs(assertDefined(entry.getCreateTimeNs()));
      }
      if (entry.hasSendTimeNs()) {
        shellTransition.setSendTimeNs(assertDefined(entry.getSendTimeNs()));
      }
      if (entry.hasAbortTimeNs()) {
        shellTransition.setWmAbortTimeNs(assertDefined(entry.getAbortTimeNs()));
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
      if (entry.hasStartingWindowRemoveTimeNs()) {
        shellTransition.setStartingWindowRemoveTimeNs(
          assertDefined(entry.getStartingWindowRemoveTimeNs()),
        );
      }
      if (entry.hasType()) {
        shellTransition.setType(assertDefined(entry.getType()));
      }
      if (entry.hasFlags()) {
        shellTransition.setFlags(assertDefined(entry.getFlags()));
      }
      const targets = entry.getTargetsList();
      if (targets && targets.length > 0) {
        shellTransition.setChangesList(
          targets.map((target: TargetUdc) => {
            const t = new PerfettoShellTransition.Change();
            if (target.hasMode()) t.setMode(assertDefined(target.getMode()));
            if (target.hasLayerId()) {
              t.setLayerId(assertDefined(target.getLayerId()));
            }
            if (target.hasWindowId()) {
              t.setWindowId(assertDefined(target.getWindowId()));
            }
            if (target.hasFlags()) t.setFlags(assertDefined(target.getFlags()));
            return t;
          }),
        );
      }
      packet.setShellTransition(shellTransition);
      return packet;
    });
  }

  protected override getTimestamp(entry: TransitionUdc): Timestamp {
    // for consistency with all transitions, elapsed nanos are defined as
    // wm send time else INVALID_TIME_NS
    return entry.hasSendTimeNs()
      ? this.timestampConverter.makeTimestampFromBootTimeNs(
          BigInt(entry.getSendTimeNs() ?? '0'),
        )
      : this.timestampConverter.makeZeroTimestamp();
  }
}

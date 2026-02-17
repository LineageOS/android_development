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
import Long from 'long';
import {com} from 'protos/transitions/udc/static';
import {TraceType} from '@trace_api/trace_type';
import {nullifyIfDefaultValue} from './perfetto_conversion_helpers';
import {IShellTransition as PerfettoTransition} from '@compat/winscope_protos';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';
import {ClockSnapshot, TracePacket} from '@compat/perfetto';

/**
 * Parser for WM Transition trace files.
 */
export class FileReaderTransitionsWm extends AbstractFileReader<PerfettoTransition> {
  private realToBootTimeOffsetNs: bigint | undefined;

  override getTraceType(): TraceType {
    return TraceType.WM_TRANSITION;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override decodeTrace(buffer: Uint8Array): PerfettoTransition[] {
    const decodedProto =
      com.android.server.wm.shell.TransitionTraceProto.decode(buffer);

    const timeOffset = BigInt(
      decodedProto.realToElapsedTimeOffsetNanos?.toString() ?? '0',
    );
    this.realToBootTimeOffsetNs = timeOffset !== 0n ? timeOffset : undefined;

    return (
      decodedProto.transitions?.map((transition) => {
        return this.convertToPerfettoTransition(transition);
      }) ?? []
    );
  }

  override getMagicNumber(): number[] {
    return [0x09, 0x54, 0x52, 0x4e, 0x54, 0x52, 0x41, 0x43, 0x45]; // .TRNTRACE
  }

  override convertToPerfettoPackets(): TracePacket[] {
    return this.decodedEntries.map((entry) => {
      const packet = new TracePacket();
      const ns = entry.sendTimeNs ?? 0n;
      packet.timestamp = Long.fromString(ns.toString());
      packet.timestampClockId = ClockSnapshot.Clock.BuiltinClocks.BOOTTIME;
      packet.shellTransition = entry;
      return packet;
    });
  }

  protected override getTimestamp(entry: LegacyTransition): Timestamp {
    // for consistency with all transitions, elapsed nanos are defined as
    // wm send time else INVALID_TIME_NS
    return entry.sendTimeNs
      ? this.timestampConverter.makeTimestampFromBootTimeNs(
          BigInt(entry.sendTimeNs.toString()),
        )
      : this.timestampConverter.makeZeroTimestamp();
  }

  private convertToPerfettoTransition(
    wmTransition: LegacyTransition,
  ): PerfettoTransition {
    const perfettoTransition: PerfettoTransition = {
      id: wmTransition.id,
      createTimeNs: nullifyIfDefaultValue(wmTransition.createTimeNs),
      sendTimeNs: nullifyIfDefaultValue(wmTransition.sendTimeNs),
      wmAbortTimeNs: nullifyIfDefaultValue(wmTransition.abortTimeNs),
      finishTimeNs: nullifyIfDefaultValue(wmTransition.finishTimeNs),
      startTransactionId: nullifyIfDefaultValue(
        wmTransition.startTransactionId,
      ),
      finishTransactionId: nullifyIfDefaultValue(
        wmTransition.finishTransactionId,
      ),
      type: nullifyIfDefaultValue(wmTransition.type),
      targets: nullifyIfDefaultValue(wmTransition.targets),
      flags: nullifyIfDefaultValue(wmTransition.flags),
      startingWindowRemoveTimeNs: nullifyIfDefaultValue(
        wmTransition.startingWindowRemoveTimeNs,
      ),
    };
    return perfettoTransition;
  }
}

type LegacyTransition = com.android.server.wm.shell.ITransition;

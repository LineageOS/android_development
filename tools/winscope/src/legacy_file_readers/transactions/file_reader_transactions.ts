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
import {TransactionTraceEntry} from '@compat/winscope_protos';
import {TracePacket, ClockSnapshot} from '@compat/perfetto';
import {android} from 'protos/transactions/udc/static';
import {TraceType} from '@trace_api/trace_type';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';

type TraceEntryProto = android.surfaceflinger.proto.ITransactionTraceEntry;

export class FileReaderTransactions extends AbstractFileReader<TraceEntryProto> {
  private static readonly MAGIC_NUMBER = [
    0x09, 0x54, 0x4e, 0x58, 0x54, 0x52, 0x41, 0x43, 0x45,
  ]; // .TNXTRACE

  private realToMonotonicTimeOffsetNs: bigint | undefined;

  override getTraceType(): TraceType {
    return TraceType.TRANSACTIONS;
  }

  override getMagicNumber(): number[] {
    return FileReaderTransactions.MAGIC_NUMBER;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return this.realToMonotonicTimeOffsetNs;
  }

  override decodeTrace(buffer: Uint8Array): TraceEntryProto[] {
    const decodedProto =
      android.surfaceflinger.proto.TransactionTraceFile.decode(buffer);

    const timeOffset = BigInt(
      decodedProto.realToElapsedTimeOffsetNanos?.toString() ?? '0',
    );
    this.realToMonotonicTimeOffsetNs =
      timeOffset !== 0n ? timeOffset : undefined;

    return decodedProto.entry ?? [];
  }

  override convertToPerfettoPackets(sequenceId: number): TracePacket[] {
    const packets = [];
    for (const entry of this.decodedEntries) {
      const packet = new TracePacket();
      packet.timestamp = assertDefined(entry.elapsedRealtimeNanos);
      packet.timestampClockId = ClockSnapshot.Clock.BuiltinClocks.MONOTONIC;
      packet.trustedPacketSequenceId = sequenceId;
      packet.surfaceflingerTransactions =
        TransactionTraceEntry.fromObject(entry);
      packets.push(packet);
    }
    return packets;
  }

  protected override getTimestamp(entryProto: TraceEntryProto): Timestamp {
    return this.timestampConverter.makeTimestampFromMonotonicNs(
      BigInt(assertDefined(entryProto.elapsedRealtimeNanos).toString()),
    );
  }
}

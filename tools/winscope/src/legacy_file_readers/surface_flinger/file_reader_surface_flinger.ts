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
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {LayersTraceFileProtoUdc, LayersTraceProtoUdc, PerfettoClockSnapshot, PerfettoLayersSnapshotProto, PerfettoTracePacket,} from '@compat/protobuf';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

export class FileReaderSurfaceFlinger extends AbstractFileReader<LayersTraceProtoUdc> {
  private static readonly MAGIC_NUMBER = [
    0x09, 0x4c, 0x59, 0x52, 0x54, 0x52, 0x41, 0x43, 0x45,
  ]; // .LYRTRACE

  private realToMonotonicTimeOffsetNs: bigint | undefined;
  private isDump = false;

  static async createInstance(
    trace: TraceFile,
    timestampConverter: ParserTimestampConverter,
  ): Promise<LegacyFileReader[]> {
    return new FileReaderSurfaceFlinger(trace, timestampConverter).read();
  }

  override getTraceType(): TraceType {
    return TraceType.SURFACE_FLINGER;
  }

  override getMagicNumber(): number[] {
    return FileReaderSurfaceFlinger.MAGIC_NUMBER;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return this.realToMonotonicTimeOffsetNs;
  }

  override decodeTrace(buffer: Uint8Array): readonly LayersTraceProtoUdc[] {
    const decoded = LayersTraceFileProtoUdc.deserializeBinary(buffer);

    const timeOffset = BigInt(decoded.getRealToElapsedTimeOffsetNanos() ?? '0');
    this.realToMonotonicTimeOffsetNs =
      timeOffset !== 0n ? timeOffset : undefined;

    const entries = decoded.getEntryList();
    this.isDump = entries.length === 1 && !entries[0].hasElapsedRealtimeNanos();

    return entries;
  }

  override convertToPerfettoPackets(sequenceId: number): PerfettoTracePacket[] {
    const packets: PerfettoTracePacket[] = [];
    for (const entry of this.decodedEntries) {
      const packet = new PerfettoTracePacket();
      if (this.isDump) {
        packet.setTimestamp('0');
      } else {
        packet.setTimestamp(assertDefined(entry.getElapsedRealtimeNanos()));
      }
      if (BigInt(assertDefined(entry.getElapsedRealtimeNanos())) < 0n) {
        throw new Error('negative time offset');
      }

      packet.setTimestampClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
      );
      packet.clearClockSnapshot();
      packet.setTrustedPacketSequenceId(sequenceId);
      packet.setSurfaceflingerLayersSnapshot(
        PerfettoLayersSnapshotProto.deserializeBinary(entry.serializeBinary()),
      );
      packets.push(packet);
    }
    return packets;
  }

  protected override getTimestamp(entry: LayersTraceProtoUdc): Timestamp {
    if (this.isDump) {
      return this.timestampConverter.makeZeroTimestamp();
    }
    return this.timestampConverter.makeTimestampFromMonotonicNs(
      BigInt(assertDefined(entry.getElapsedRealtimeNanos())),
    );
  }
}

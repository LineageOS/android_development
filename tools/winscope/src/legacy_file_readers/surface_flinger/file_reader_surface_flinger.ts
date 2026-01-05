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
import Long from 'long';
import {LayersSnapshotProto} from '@compat/winscope_protos';
import {TracePacket, ClockSnapshot} from '@compat/perfetto';
import {android} from 'protos/surfaceflinger/udc/static';
import {TraceType} from '@trace_api/trace_type';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';

type LayerTraceProto = android.surfaceflinger.ILayersTraceProto;

export class FileReaderSurfaceFlinger extends AbstractFileReader<LayerTraceProto> {
  private static readonly MAGIC_NUMBER = [
    0x09, 0x4c, 0x59, 0x52, 0x54, 0x52, 0x41, 0x43, 0x45,
  ]; // .LYRTRACE

  private realToMonotonicTimeOffsetNs: bigint | undefined;
  private isDump = false;

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

  override decodeTrace(buffer: Uint8Array): LayerTraceProto[] {
    const decoded = android.surfaceflinger.LayersTraceFileProto.decode(buffer);

    const timeOffset = BigInt(
      decoded.realToElapsedTimeOffsetNanos?.toString() ?? '0',
    );
    this.realToMonotonicTimeOffsetNs =
      timeOffset !== 0n ? timeOffset : undefined;
    this.isDump =
      decoded.entry?.length === 1 &&
      !Object.prototype.hasOwnProperty.call(
        decoded.entry[0],
        'elapsedRealtimeNanos',
      );
    return decoded.entry ?? [];
  }

  override convertToPerfettoPackets(sequenceId: number): TracePacket[] {
    const packets = [];
    for (const entry of this.decodedEntries) {
      const packet = new TracePacket();
      packet.timestamp = this.isDump
        ? Long.fromInt(0)
        : assertDefined(entry.elapsedRealtimeNanos);
      packet.timestampClockId = ClockSnapshot.Clock.BuiltinClocks.MONOTONIC;
      packet.trustedPacketSequenceId = sequenceId;
      packet.surfaceflingerLayersSnapshot =
        LayersSnapshotProto.fromObject(entry);
      packets.push(packet);
    }
    return packets;
  }

  protected override getTimestamp(entry: LayerTraceProto): Timestamp {
    if (this.isDump) {
      return this.timestampConverter.makeZeroTimestamp();
    }
    return this.timestampConverter.makeTimestampFromMonotonicNs(
      BigInt(assertDefined(entry.elapsedRealtimeNanos).toString()),
    );
  }
}

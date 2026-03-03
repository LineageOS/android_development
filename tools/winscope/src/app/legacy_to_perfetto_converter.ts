/*
 * Copyright (C) 2025 The Android Open Source Project
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
// TODO(b/311642700): Not compatible with google3
import Long from 'long';
import {makeWarningFailedToConvertLegacyTraces} from './warnings';
import {UserNotifier} from '@services/user_notifier';
// TODO(b/311642700): Not compatible with google3
import {Writer} from 'protobufjs';
import {
  Trace,
  TracePacket,
  ITracePacket,
  ClockSnapshot as PerfettoClockSnapshot,
} from '@compat/perfetto';
import {TraceFile} from '@trace/trace_file';
import {getLogger, Logger} from '@compat/logging';
import {
  getReaderWithLatestRealToBootTimeOffset,
  getReaderWithLatestRealToMonotonicTimeOffset,
} from './file_reader_helpers';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {FileReader} from '@trace_api/file_reader';
import {INVALID_TIME_NS} from '@common/time/time';

/**
 * An interface for a clock snapshot.
 */
export interface ClockSnapshot {
  realtime: bigint;
  boottime: bigint | undefined;
  monotonic: bigint | undefined;
}

/**
 * A class for converting legacy traces to Perfetto format.
 */
export class LegacyToPerfettoConverter {
  private legacyReaders: LegacyFileReader[] = [];
  private allReaders: FileReader[] = [];
  private perfettoFile: TraceFile | undefined;

  constructor(
    private readonly logger: Logger = getLogger('LegacyToPerfettoConverter'),
  ) {}

  setLegacyFileReaders(value: LegacyFileReader[]): this {
    this.legacyReaders = value;
    return this;
  }

  setAllFileReaders(value: FileReader[]): this {
    this.allReaders = value;
    return this;
  }

  setPerfettoFile(value: TraceFile): this {
    this.perfettoFile = value;
    return this;
  }

  async convert(): Promise<TraceFile | undefined> {
    let trace: Trace;
    try {
      trace = await this.makePerfettoTrace();
    } catch (e) {
      this.logger.error((e as Error).message);
      UserNotifier.add(
        makeWarningFailedToConvertLegacyTraces((e as Error).message),
      ).notify();
      return this.perfettoFile;
    }

    const legacyPackets = this.makeTraceDataPackets(trace);
    if (legacyPackets.length === 0) {
      return undefined;
    }
    trace.packet.push(...legacyPackets);

    // Packets with zero timestamps must be assigned a timestamp within
    // the range of timestamps present in the trace to avoid issues with
    // timestamp syncing. The packets for these traces will be parsed by
    // TP with the "has_invalid_elapsed_ts" column set to true.
    const nonZeroTs = trace.packet.find((packet) => {
      return packet.timestamp && !packet.timestamp.isZero();
    })?.timestamp;
    legacyPackets.forEach((packet) => {
      if (nonZeroTs && packet.timestamp.isZero()) {
        packet.timestamp = nonZeroTs;
      }
    });

    // To avoid out-of-memory crashes with larger traces, we add encoded
    // packets to size-limited chunks. TraceProcessor can load files in
    // arbitrary chunks so we don't need to worry about how/where the
    // encoded packets are split into chunks.
    const chunks: BlobPart[] = [];
    let currBuffer: Uint8Array[] = [];
    let currSize = 0;

    for (const packet of trace.packet) {
      const encodedPacket = this.encodePacket(packet);

      if (
        currSize + encodedPacket.byteLength >
        LegacyToPerfettoConverter.MAX_BUFFER_SIZE
      ) {
        if (currBuffer.length > 0) {
          const chunk = this.createChunk(currSize, currBuffer);
          chunks.push(chunk);
        }
        currBuffer = [encodedPacket];
        currSize = encodedPacket.byteLength;
      } else {
        currBuffer.push(encodedPacket);
        currSize += encodedPacket.byteLength;
      }
    }

    if (currBuffer.length > 0) {
      const chunk = this.createChunk(currSize, currBuffer);
      chunks.push(chunk);
    }

    return new TraceFile(
      new File(chunks, 'combined_winscope_trace.perfetto-trace'),
    );
  }

  private async makePerfettoTrace(): Promise<Trace> {
    let trace: Trace;
    if (!this.perfettoFile) {
      const clockSnapshots = this.makeClockSnapshots();
      trace = new Trace();
      if (clockSnapshots.length === 0) {
        throw new Error('no file readers or Perfetto file provided');
      }
      clockSnapshots.forEach((snapshot) => {
        const clockSnapshot = this.makeTracePacketWithClockSnapshot(snapshot);
        trace.packet.push(clockSnapshot);
      });
    } else {
      const fileBuffer = new Uint8Array(
        await this.perfettoFile.file.arrayBuffer(),
      );
      trace = Trace.decode(fileBuffer);
    }

    return trace;
  }

  private makeClockSnapshots(): ClockSnapshot[] {
    if (this.allReaders.length === 0) {
      return [];
    }
    const clockSnapshots: ClockSnapshot[] = [];

    const boottimeFileReader = getReaderWithLatestRealToBootTimeOffset(
      this.allReaders,
    );
    const monotonicFileReader = getReaderWithLatestRealToMonotonicTimeOffset(
      this.allReaders,
    );

    const boottimeSnapshots: ClockSnapshot[] = [];
    const monotonicSnapshots: ClockSnapshot[] = [];

    if (boottimeFileReader === undefined && monotonicFileReader === undefined) {
      this.getRealTimestampsForClockSnapshots(this.allReaders[0]).forEach(
        (realtime) => {
          clockSnapshots.push({
            realtime,
            boottime: realtime,
            monotonic: realtime,
          });
        },
      );
    }

    if (boottimeFileReader) {
      const boottimeOffset = boottimeFileReader.getRealToBootTimeOffsetNs();
      this.getRealTimestampsForClockSnapshots(boottimeFileReader).forEach(
        (rt) => {
          const offset = assertDefined(boottimeOffset);
          const realtime = rt === INVALID_TIME_NS ? offset : rt;
          const boottime = realtime - offset;
          boottimeSnapshots.push({realtime, boottime, monotonic: undefined});
        },
      );
    }

    if (monotonicFileReader) {
      const monotonicOffset =
        monotonicFileReader.getRealToMonotonicTimeOffsetNs();
      this.getRealTimestampsForClockSnapshots(monotonicFileReader).forEach(
        (rt) => {
          const offset = assertDefined(monotonicOffset);
          const realtime = rt === INVALID_TIME_NS ? offset : rt;
          const monotonic = realtime - offset;

          // Monotonic snapshots must contain a boottime timestamp for TP to be able
          // to convert monotonic timestamps to boottime
          let boottime: bigint;
          if (boottimeFileReader) {
            const snapshotB = boottimeSnapshots[boottimeSnapshots.length - 1];
            const realtimeDiff = snapshotB.realtime - realtime;
            boottime = assertDefined(snapshotB.boottime) - realtimeDiff;
          } else {
            boottime = monotonic;
          }

          monotonicSnapshots.push({realtime, boottime, monotonic});
        },
      );
    }

    clockSnapshots.push(...boottimeSnapshots);
    clockSnapshots.push(...monotonicSnapshots);

    return clockSnapshots;
  }

  private getRealTimestampsForClockSnapshots(
    reader: FileReader,
  ): Array<bigint> {
    const ts = reader.getTimestamps();
    const realTs: Array<bigint> = [];
    if (ts.length > 0) {
      realTs.push(ts[0].getValueNs());
    }
    if (ts.length > 1) {
      // to adjust against drift in TP, we add clock snapshots at the
      // start and end of the trace
      realTs.push(ts[reader.getLengthEntries() - 1].getValueNs());
    }
    return realTs;
  }

  private makeTracePacketWithClockSnapshot(
    legacySnapshot: ClockSnapshot,
  ): TracePacket {
    const packet = new TracePacket();
    packet.trustedPacketSequenceId = 1;

    const snapshot = new PerfettoClockSnapshot();

    const realtime = Long.fromString(legacySnapshot.realtime.toString());

    const clockRealtimeCoarse = new PerfettoClockSnapshot.Clock();
    clockRealtimeCoarse.clockId =
      PerfettoClockSnapshot.Clock.BuiltinClocks.REALTIME_COARSE;
    clockRealtimeCoarse.timestamp = realtime;
    snapshot.clocks.push(clockRealtimeCoarse);

    const clockRealtime = new PerfettoClockSnapshot.Clock();
    clockRealtime.clockId = PerfettoClockSnapshot.Clock.BuiltinClocks.REALTIME;
    clockRealtime.timestamp = realtime;
    snapshot.clocks.push(clockRealtime);

    if (legacySnapshot.boottime !== undefined) {
      const boottime = Long.fromString(legacySnapshot.boottime.toString());
      const clockBoottime = new PerfettoClockSnapshot.Clock();
      clockBoottime.clockId =
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME;
      clockBoottime.timestamp = boottime;
      snapshot.clocks.push(clockBoottime);
    }

    if (legacySnapshot.monotonic !== undefined) {
      const monotonic = Long.fromString(legacySnapshot.monotonic.toString());
      const clockMonotonic = new PerfettoClockSnapshot.Clock();
      clockMonotonic.clockId =
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC;
      clockMonotonic.timestamp = monotonic;
      snapshot.clocks.push(clockMonotonic);

      const clockMonotonicCoarse = new PerfettoClockSnapshot.Clock();
      clockMonotonicCoarse.clockId =
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC_COARSE;
      clockMonotonicCoarse.timestamp = monotonic;
      snapshot.clocks.push(clockMonotonicCoarse);

      const clockMonotonicRaw = new PerfettoClockSnapshot.Clock();
      clockMonotonicRaw.clockId =
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC_RAW;
      clockMonotonicRaw.timestamp = monotonic;
      snapshot.clocks.push(clockMonotonicRaw);
    }

    packet.clockSnapshot = snapshot;

    return packet;
  }

  private makeTraceDataPackets(trace: Trace): TracePacket[] {
    const [largestUid, largestPid] = trace.packet.reduce(
      ([uid, pid], packet) => {
        return [
          Math.max(packet.trustedUid ?? 0, uid),
          Math.max(packet.trustedPid ?? 0, pid),
        ];
      },
      [0, 0],
    );
    let [trustedUid, trustedPid] = [largestUid + 1, largestPid + 1];

    const packets: TracePacket[] = [];
    let sequenceId =
      Math.max(
        ...trace.packet.map((packet) => packet.trustedPacketSequenceId ?? 0),
      ) + 1;
    for (const reader of this.legacyReaders) {
      try {
        const legacyPackets = reader.convertToPerfettoPackets(
          sequenceId,
          trustedUid,
          trustedPid,
        );

        if (legacyPackets.length > 0) {
          legacyPackets[0].firstPacketOnSequence = true;
          packets.push(...legacyPackets);
          sequenceId++;
          trustedUid++;
          trustedPid++;
        }
      } catch (e) {
        this.logger.error((e as Error).message);
      }
    }
    return packets;
  }

  // Since larger traces cannot be encoded using the Trace.encode function
  // provided by protobufjs as this causes an out-of-memory crash, we
  // manually encode the packet. The encoded packet should have the following
  // protobuf format:
  // [<field_tag>][<packet_length>][<packet_bytes>]
  // where field tag is given by (field_number << 3) | wire_type.

  // Trace proto from external/perfetto/protos/perfetto/trace/trace.proto:
  // message Trace {
  //   repeated TracePacket packet = 1;
  // }

  // TracePacket has field number 1 and wire type 2 (LEN = length-delimited).

  private encodePacket(packet: ITracePacket): Uint8Array {
    const encodedPacket = TracePacket.encode(packet).finish();
    const prefix = this.createPacketPrefix(encodedPacket.byteLength);
    const packetWithPrefix = new Uint8Array(
      prefix.byteLength + encodedPacket.byteLength,
    );
    packetWithPrefix.set(prefix, 0);
    packetWithPrefix.set(encodedPacket, prefix.length);
    return packetWithPrefix;
  }

  private createPacketPrefix(packetLength: number): Uint8Array {
    const writer = new Writer();
    writer.uint32(LegacyToPerfettoConverter.FIELD_TAG);
    writer.uint32(packetLength);
    return writer.finish();
  }

  private createChunk(size: number, buffers: Uint8Array[]): BlobPart {
    const chunk = new Uint8Array(size);
    let offset = 0;
    for (const buffer of buffers) {
      chunk.set(buffer, offset);
      offset += buffer.byteLength;
    }
    return chunk;
  }

  private static readonly FIELD_TAG = 0x0a; // (1 << 3) | 2
  private static readonly MAX_BUFFER_SIZE = 2 ** 31 - 1;
}

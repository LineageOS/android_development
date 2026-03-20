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
import {INVALID_TIME_NS} from '@common/time/time';
import {getLogger, Logger} from '@compat/logging';
import {PerfettoClockSnapshot, PerfettoTrace, PerfettoTracePacket,} from '@compat/protobuf';
import {UserNotifier} from '@services/user_notifier';
import {FileReader} from '@trace_api/file_reader';
import {TraceFile} from '@trace_api/trace_file';

import {getReaderWithLatestRealToBootTimeOffset, getReaderWithLatestRealToMonotonicTimeOffset,} from './file_reader_helpers';
import {LegacyFileReader} from './legacy_file_reader';
import {makeWarningFailedToConvertLegacyTraces} from './warnings';

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
    let trace: PerfettoTrace;
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
    legacyPackets.forEach((p) => trace.addPacket(p));

    // Packets with zero timestamps must be assigned a timestamp within
    // the range of timestamps present in the trace to avoid issues with
    // timestamp syncing. The packets for these traces will be parsed by
    // TP with the "has_invalid_elapsed_ts" column set to true.
    const hasValidTs = (packet: PerfettoTracePacket) => {
      return packet.hasTimestamp() && packet.getTimestamp()?.toString() !== '0';
    };
    const nonZeroTs = trace
      .getPacketList()
      .find((packet) => hasValidTs(packet))
      ?.getTimestamp();
    legacyPackets.forEach((packet) => {
      if (nonZeroTs && !hasValidTs(packet)) {
        packet.setTimestamp(nonZeroTs);
      }
    });

    const serializedTrace = trace.serializeBinary();
    return new TraceFile(
      new File(
        [serializedTrace as unknown as BlobPart],
        'combined_winscope_trace.perfetto-trace',
      ),
    );
  }

  private async makePerfettoTrace(): Promise<PerfettoTrace> {
    let trace: PerfettoTrace;
    if (!this.perfettoFile) {
      const clockSnapshots = this.makeClockSnapshots();
      trace = new PerfettoTrace();
      if (clockSnapshots.length === 0) {
        throw new Error('no file readers or Perfetto file provided');
      }
      clockSnapshots.forEach((snapshot) => {
        const clockSnapshot = this.makeTracePacketWithClockSnapshot(snapshot);
        trace.addPacket(clockSnapshot);
      });
    } else {
      const fileBuffer = new Uint8Array(
        await this.perfettoFile.file.arrayBuffer(),
      );
      trace = PerfettoTrace.deserializeBinary(fileBuffer);
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

  private getRealTimestampsForClockSnapshots(reader: FileReader): bigint[] {
    const ts = reader.getTimestamps();
    const realTs: bigint[] = [];
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
  ): PerfettoTracePacket {
    const packet = new PerfettoTracePacket();
    packet.setTrustedPacketSequenceId(1);

    const snapshot = new PerfettoClockSnapshot();

    const realtime = legacySnapshot.realtime.toString();

    const clockRealtimeCoarse = new PerfettoClockSnapshot.Clock();
    clockRealtimeCoarse.setClockId(
      PerfettoClockSnapshot.Clock.BuiltinClocks.REALTIME_COARSE,
    );
    clockRealtimeCoarse.setTimestamp(realtime);
    snapshot.addClocks(clockRealtimeCoarse);

    const clockRealtime = new PerfettoClockSnapshot.Clock();
    clockRealtime.setClockId(
      PerfettoClockSnapshot.Clock.BuiltinClocks.REALTIME,
    );
    clockRealtime.setTimestamp(realtime);
    snapshot.addClocks(clockRealtime);

    if (legacySnapshot.boottime !== undefined) {
      const boottime = legacySnapshot.boottime.toString();
      const clockBoottime = new PerfettoClockSnapshot.Clock();
      clockBoottime.setClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );
      clockBoottime.setTimestamp(boottime);
      snapshot.addClocks(clockBoottime);
    }

    if (legacySnapshot.monotonic !== undefined) {
      const monotonic = legacySnapshot.monotonic.toString();
      const clockMonotonic = new PerfettoClockSnapshot.Clock();
      clockMonotonic.setClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
      );
      clockMonotonic.setTimestamp(monotonic);
      snapshot.addClocks(clockMonotonic);

      const clockMonotonicCoarse = new PerfettoClockSnapshot.Clock();
      clockMonotonicCoarse.setClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC_COARSE,
      );
      clockMonotonicCoarse.setTimestamp(monotonic);
      snapshot.addClocks(clockMonotonicCoarse);

      const clockMonotonicRaw = new PerfettoClockSnapshot.Clock();
      clockMonotonicRaw.setClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC_RAW,
      );
      clockMonotonicRaw.setTimestamp(monotonic);
      snapshot.addClocks(clockMonotonicRaw);
    }

    packet.setClockSnapshot(snapshot);

    return packet;
  }

  private makeTraceDataPackets(trace: PerfettoTrace): PerfettoTracePacket[] {
    const [largestUid, largestPid] = trace.getPacketList().reduce(
      ([uid, pid], packet) => {
        return [
          Math.max(packet.getTrustedUid() ?? 0, uid),
          Math.max(packet.getTrustedPid() ?? 0, pid),
        ];
      },
      [0, 0],
    );
    let [trustedUid, trustedPid] = [largestUid + 1, largestPid + 1];

    const packets: PerfettoTracePacket[] = [];
    let sequenceId =
      Math.max(
        ...trace
          .getPacketList()
          .map((packet) => packet.getTrustedPacketSequenceId() ?? 0),
      ) + 1;
    for (const reader of this.legacyReaders) {
      try {
        const legacyPackets = reader.convertToPerfettoPackets(
          sequenceId,
          trustedUid,
          trustedPid,
        );

        if (legacyPackets.length > 0) {
          legacyPackets[0].setFirstPacketOnSequence(true);
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
}

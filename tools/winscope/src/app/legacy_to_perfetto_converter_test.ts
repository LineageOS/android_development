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
import Long from 'long';
import {makeWarningFailedToConvertLegacyTraces} from './warnings';
import {
  ClockSnapshot as PerfettoClockSnapshot,
  Trace,
  TracePacket,
} from '@compat/perfetto';
import {makeRealTimestamp} from '@test/unit/time_test_helpers';
import {UserNotifierChecker} from '@test/unit/user_notifier_checker';
import {TraceFile} from '@trace/trace_file';
import {
  ClockSnapshot,
  LegacyToPerfettoConverter,
} from './legacy_to_perfetto_converter';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {FileReader} from '@trace_api/file_reader';
import {TestLegacyFileReaderBuilder} from '@test/unit/test_legacy_file_reader_builder';

describe('LegacyToPerfettoConverter', () => {
  const packetB1 = makePacketWithBoottimeTs(10);
  const packetB2 = makePacketWithBoottimeTs(15);
  const packetB3 = makePacketWithBoottimeTs(18);
  const packetM1 = makePacketWithMonotonicTs(14);
  const packetM2 = makePacketWithMonotonicTs(20);
  const packetM3 = makePacketWithMonotonicTs(25);

  const perfettoClock = {realtime: 50n, boottime: 30n, monotonic: 40n};
  const perfettoSnapshot = makeExpectedClockSnapshot(perfettoClock);
  const emptyPacket = new TracePacket();
  const existingFile = makeExistingPerfettoFile(perfettoSnapshot, emptyPacket);

  it('converts multiple legacy files to new perfetto file', async () => {
    const legacyReader1 = makeFileReader([packetB1]);
    spyOn(legacyReader1, 'getRealToMonotonicTimeOffsetNs').and.returnValue(
      undefined,
    );
    const legacyReader2 = makeFileReader([packetB2]);
    spyOn(legacyReader2, 'getRealToMonotonicTimeOffsetNs').and.returnValue(
      undefined,
    );

    const perfettoFile = await convertToPerfetto([
      legacyReader1,
      legacyReader2,
    ]);
    const trace = await checkAndDecodePerfettoFile(assertDefined(perfettoFile));
    expect(trace.packet).toEqual([
      makeExpectedClockSnapshot({
        realtime: 15n,
        boottime: 15n,
        monotonic: undefined,
      }),
      packetB1,
      packetB2,
    ]);
  });

  it('adds multiple legacy files to existing perfetto file', async () => {
    const readers = [makeFileReader([packetB1]), makeFileReader([packetM1])];
    const perfettoFile = await convertToPerfetto(
      readers,
      readers,
      existingFile,
    );
    const trace = await checkAndDecodePerfettoFile(assertDefined(perfettoFile));
    expect(trace.packet).toEqual([
      perfettoSnapshot,
      emptyPacket,
      packetB1,
      packetM1,
    ]);
  });

  it('adds legacy trace without timestamp to existing perfetto file', async () => {
    const packetB0 = makePacketWithBoottimeTs(0);
    const readers = [makeFileReader([packetB0])];
    expect(packetB0.timestamp).toEqual(Long.fromInt(0, true));

    const existingPacket = new TracePacket();
    existingPacket.timestamp = Long.fromInt(50, true);
    const fileWithPacket = makeExistingPerfettoFile(
      perfettoSnapshot,
      existingPacket,
    );

    const perfettoFile = assertDefined(
      await convertToPerfetto(readers, readers, fileWithPacket),
    );
    const trace = await checkAndDecodePerfettoFile(perfettoFile);

    expect(trace.packet).toEqual([perfettoSnapshot, existingPacket, packetB0]);
    expect(packetB0.timestamp).toEqual(Long.fromInt(50, true));
  });

  it('ignores legacy file that cannot be converted to perfetto format', async () => {
    const reader1 = makeFileReader([]);
    expect(await convertToPerfetto([reader1])).toBeUndefined();
    expect(
      await convertToPerfetto([reader1], [reader1], existingFile),
    ).toBeUndefined();

    const reader2 = makeFileReader([packetM1]);
    const readers = [reader1, reader2];
    const perfettoFile = await convertToPerfetto(
      readers,
      readers,
      existingFile,
    );
    const trace = await checkAndDecodePerfettoFile(assertDefined(perfettoFile));
    expect(trace.packet).toEqual([perfettoSnapshot, emptyPacket, packetM1]);
  });

  it('converts elapsed legacy trace to new perfetto trace', async () => {
    await testElapsedTraces([packetB1]);
  });

  it('converts elapsed legacy trace with multiple entries', async () => {
    const packets = [packetB1, packetB2, packetB3];
    await testElapsedTraces(packets);
  });

  it('converts legacy trace with real-to-boottime offset', async () => {
    await testBoottimeTraces([packetB1]);
  });

  it('converts legacy trace with real-to-boottime offset with multiple entries', async () => {
    const packets = [packetB1, packetB2, packetB3];
    await testBoottimeTraces(packets);
  });

  it('converts legacy trace with real-to-monotonic offset', async () => {
    await testMonotonicTraces([packetM1]);
  });

  it('converts legacy trace with real-to-monotonic offset with multiple entries', async () => {
    const packets = [packetM1, packetM2, packetM3];
    await testMonotonicTraces(packets);
  });

  it('converts boot-time and monotonically offset traces', async () => {
    const readerB = makeFileReader([packetB1]);
    spyOn(readerB, 'getRealToBootTimeOffsetNs').and.returnValue(2n);
    spyOn(readerB, 'getRealToMonotonicTimeOffsetNs').and.returnValue(undefined);

    const readerM = makeFileReader([packetM1]);
    spyOn(readerM, 'getRealToBootTimeOffsetNs').and.returnValue(undefined);
    spyOn(readerM, 'getRealToMonotonicTimeOffsetNs').and.returnValue(3n);

    const perfettoFile = await new LegacyToPerfettoConverter()
      .setLegacyFileReaders([readerM])
      .setAllFileReaders([readerM, readerB])
      .convert();
    const trace = await checkAndDecodePerfettoFile(assertDefined(perfettoFile));
    expect(trace.packet).toEqual([
      makeExpectedClockSnapshot({
        realtime: 10n,
        boottime: 8n,
        monotonic: undefined,
      }),
      makeExpectedClockSnapshot({
        realtime: 14n,
        boottime: 12n,
        monotonic: 11n,
      }),
      packetM1,
    ]);
  });

  it('converts legacy trace with zero timestamp', async () => {
    const packet = makePacketWithBoottimeTs(0);
    const reader = makeFileReader([packet]);
    spyOn(reader, 'getRealToBootTimeOffsetNs').and.returnValue(undefined);
    spyOn(reader, 'getRealToMonotonicTimeOffsetNs').and.returnValue(undefined);
    const perfettoFile = await convertToPerfetto([reader]);
    const trace = await checkAndDecodePerfettoFile(assertDefined(perfettoFile));
    const clockSnapshot = makeExpectedClockSnapshot({
      realtime: 0n,
      boottime: 0n,
      monotonic: 0n,
    });
    expect(trace.packet).toEqual([clockSnapshot, packet]);
  });

  it('robust to errors in existing trace decoding', async () => {
    const userNotifierChecker = new UserNotifierChecker();
    const readers = [makeFileReader([])];
    spyOn(Trace, 'decode').and.throwError('decoding failed');
    const perfettoFile = await convertToPerfetto(
      readers,
      readers,
      existingFile,
    );
    expect(perfettoFile).toEqual(existingFile);
    userNotifierChecker.expectNotified([
      makeWarningFailedToConvertLegacyTraces('decoding failed'),
    ]);
  });

  it('robust to errors in packet conversion', async () => {
    const reader = makeFileReader([], true);
    expect(await convertToPerfetto([reader])).toBeUndefined();
  });

  it('robust to errors if allReaders empty and no Perfetto file provided', async () => {
    const userNotifierChecker = new UserNotifierChecker();
    const reader = makeFileReader([], true);
    const perfettoFile = await new LegacyToPerfettoConverter()
      .setLegacyFileReaders([reader])
      .setAllFileReaders([])
      .convert();
    expect(perfettoFile).toBeUndefined();
    userNotifierChecker.expectNotified([
      makeWarningFailedToConvertLegacyTraces(
        'no file readers or Perfetto file provided',
      ),
    ]);
  });

  function makePacketWithMonotonicTs(ts: number) {
    return TracePacket.create({
      trustedPacketSequenceId: 1,
      timestamp: Long.fromInt(ts, true),
      timestampClockId: PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
    });
  }

  function makePacketWithBoottimeTs(ts: number) {
    return TracePacket.create({
      trustedPacketSequenceId: 1,
      timestamp: Long.fromInt(ts, true),
      timestampClockId: PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
    });
  }

  async function convertToPerfetto(
    readers: LegacyFileReader[],
    allReaders: FileReader[] = readers,
    perfettoFile?: TraceFile,
  ) {
    const converter = new LegacyToPerfettoConverter()
      .setLegacyFileReaders(readers)
      .setAllFileReaders(allReaders);
    if (perfettoFile) {
      converter.setPerfettoFile(perfettoFile);
    }
    return await converter.convert();
  }

  async function testElapsedTraces(packets: TracePacket[]) {
    const reader = makeFileReader(packets);
    spyOn(reader, 'getRealToBootTimeOffsetNs').and.returnValue(undefined);
    spyOn(reader, 'getRealToMonotonicTimeOffsetNs').and.returnValue(undefined);
    const perfettoFile = await convertToPerfetto([reader]);
    const trace = await checkAndDecodePerfettoFile(assertDefined(perfettoFile));
    const snapshotPackets = [
      makeExpectedClockSnapshot({
        realtime: 10n,
        boottime: 10n,
        monotonic: 10n,
      }),
    ];
    if (packets.length > 1) {
      snapshotPackets.push(
        makeExpectedClockSnapshot({
          realtime: 18n,
          boottime: 18n,
          monotonic: 18n,
        }),
      );
    }
    expect(trace.packet).toEqual([...snapshotPackets, ...packets]);
  }

  async function testBoottimeTraces(packets: TracePacket[]) {
    const reader = makeFileReader(packets);
    spyOn(reader, 'getRealToBootTimeOffsetNs').and.returnValue(3n);
    spyOn(reader, 'getRealToMonotonicTimeOffsetNs').and.returnValue(undefined);
    await testConversion(reader, packets, false);
  }

  async function testMonotonicTraces(packets: TracePacket[]) {
    const reader = makeFileReader(packets);
    spyOn(reader, 'getRealToBootTimeOffsetNs').and.returnValue(undefined);
    spyOn(reader, 'getRealToMonotonicTimeOffsetNs').and.returnValue(3n);
    await testConversion(reader, packets, true);
  }

  async function testConversion(
    reader: LegacyFileReader,
    packets: TracePacket[],
    isMonotonic: boolean,
  ) {
    const perfettoFile = await convertToPerfetto([reader]);
    const trace = await checkAndDecodePerfettoFile(assertDefined(perfettoFile));
    const snapshotPackets = [makeSnapshotFromPacket(packets[0], isMonotonic)];
    if (packets.length > 1) {
      snapshotPackets.push(
        makeSnapshotFromPacket(packets[packets.length - 1], isMonotonic),
      );
    }
    expect(trace.packet).toEqual([...snapshotPackets, ...packets]);
  }

  function makeSnapshotFromPacket(packet: TracePacket, isMonotonic = false) {
    const realtime = BigInt(packet.timestamp?.toString() ?? 0n);
    return makeExpectedClockSnapshot({
      realtime,
      boottime: realtime - 3n,
      monotonic: isMonotonic ? realtime - 3n : undefined,
    });
  }

  function makeExistingPerfettoFile(
    clockSnapshot20: TracePacket,
    emptyPacket: TracePacket,
  ) {
    const existingTrace = Trace.fromObject({
      packet: [clockSnapshot20, emptyPacket],
    });
    return new TraceFile(
      new File([Trace.encode(existingTrace).finish()], 'existing_trace'),
    );
  }

  function makeFileReader(
    testPackets: TracePacket[],
    conversionError = false,
  ): LegacyFileReader {
    const ts =
      testPackets.length === 0
        ? [makeRealTimestamp(0n)]
        : testPackets.map((testPacket) => {
            const ns = BigInt(testPacket?.timestamp.toString() ?? 0n);
            return makeRealTimestamp(ns);
          });
    const fileReader = new TestLegacyFileReaderBuilder()
      .setTracePackets(testPackets)
      .setTimestamps(ts)
      .build();
    if (conversionError) {
      spyOn(fileReader, 'convertToPerfettoPackets').and.throwError(
        'conversion failed',
      );
    }
    return fileReader;
  }

  async function checkAndDecodePerfettoFile(
    perfettoFile: TraceFile,
  ): Promise<Trace> {
    const expectedPerfettoTraceName = 'combined_winscope_trace.perfetto-trace';
    expect(perfettoFile.getDescriptor()).toEqual(expectedPerfettoTraceName);
    const fileBuffer = new Uint8Array(await perfettoFile.file.arrayBuffer());
    return Trace.decode(fileBuffer);
  }

  function makeExpectedClockSnapshot(
    clockSnapshot: ClockSnapshot,
  ): TracePacket {
    const realtime = Long.fromString(clockSnapshot.realtime.toString());
    const clocks = [
      {
        clockId: PerfettoClockSnapshot.Clock.BuiltinClocks.REALTIME_COARSE,
        timestamp: realtime,
      },
      {
        clockId: PerfettoClockSnapshot.Clock.BuiltinClocks.REALTIME,
        timestamp: realtime,
      },
    ];

    if (clockSnapshot.boottime !== undefined) {
      clocks.push({
        clockId: PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
        timestamp: Long.fromString(clockSnapshot.boottime.toString()),
      });
    }

    if (clockSnapshot.monotonic !== undefined) {
      const monotonic = Long.fromString(clockSnapshot.monotonic.toString());
      clocks.push(
        ...[
          {
            clockId: PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
            timestamp: monotonic,
          },
          {
            clockId: PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC_COARSE,
            timestamp: monotonic,
          },
          {
            clockId: PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC_RAW,
            timestamp: monotonic,
          },
        ],
      );
    }

    return TracePacket.fromObject({
      trustedPacketSequenceId: 1,
      clockSnapshot: {
        clocks,
      },
    });
  }
});

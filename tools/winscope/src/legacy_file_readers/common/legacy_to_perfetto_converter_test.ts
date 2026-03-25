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
import {makeRealTimestamp} from '@common/time/testing/test_helpers';
import {PerfettoClockSnapshot, PerfettoTrace, PerfettoTracePacket,} from '@compat/protobuf';
import {TestLegacyFileReaderBuilder} from '@legacy_file_readers/testing/test_legacy_file_reader_builder';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {FileReader} from '@trace_api/file_reader';
import {TraceFile} from '@trace_api/trace_file';

import {LegacyFileReader} from './legacy_file_reader';
import {ClockSnapshot, LegacyToPerfettoConverter,} from './legacy_to_perfetto_converter';
import {makeWarningFailedToConvertLegacyTraces} from './warnings';

describe('LegacyToPerfettoConverter', () => {
  const packetB1 = makePacketWithBoottimeTs(10);
  const packetB2 = makePacketWithBoottimeTs(15);
  const packetB3 = makePacketWithBoottimeTs(18);
  const packetM1 = makePacketWithMonotonicTs(14);
  const packetM2 = makePacketWithMonotonicTs(20);
  const packetM3 = makePacketWithMonotonicTs(25);

  const perfettoClock = {realtime: 50n, boottime: 30n, monotonic: 40n};
  const perfettoSnapshot = makeExpectedClockSnapshot(perfettoClock);
  const emptyPacket = new PerfettoTracePacket();
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
    expect(
      trace.getPacketList().map((p: PerfettoTracePacket) => p.toObject()),
    ).toEqual(
      [
        makeExpectedClockSnapshot({
          realtime: 15n,
          boottime: 15n,
          monotonic: undefined,
        }),
        packetB1,
        packetB2,
      ].map((p: PerfettoTracePacket) => p.toObject()),
    );
  });

  it('adds multiple legacy files to existing perfetto file', async () => {
    const readers = [makeFileReader([packetB1]), makeFileReader([packetM1])];
    const perfettoFile = await convertToPerfetto(
      readers,
      readers,
      existingFile,
    );
    const trace = await checkAndDecodePerfettoFile(assertDefined(perfettoFile));
    expect(
      trace.getPacketList().map((p: PerfettoTracePacket) => p.toObject()),
    ).toEqual(
      [perfettoSnapshot, emptyPacket, packetB1, packetM1].map(
        (p: PerfettoTracePacket) => p.toObject(),
      ),
    );
  });

  it('adds legacy trace without timestamp to existing perfetto file', async () => {
    const packetB0 = makePacketWithBoottimeTs(0);
    const readers = [makeFileReader([packetB0])];
    expect(packetB0.getTimestamp()?.toString()).toEqual('0');

    const existingPacket = new PerfettoTracePacket();
    existingPacket.setTimestamp('50');
    const fileWithPacket = makeExistingPerfettoFile(
      perfettoSnapshot,
      existingPacket,
    );

    const perfettoFile = assertDefined(
      await convertToPerfetto(readers, readers, fileWithPacket),
    );
    const trace = await checkAndDecodePerfettoFile(perfettoFile);

    expect(
      trace.getPacketList().map((p: PerfettoTracePacket) => p.toObject()),
    ).toEqual(
      [perfettoSnapshot, existingPacket, packetB0].map(
        (p: PerfettoTracePacket) => p.toObject(),
      ),
    );
    expect(packetB0.getTimestamp()?.toString()).toEqual('50');
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
    expect(
      trace.getPacketList().map((p: PerfettoTracePacket) => p.toObject()),
    ).toEqual(
      [perfettoSnapshot, emptyPacket, packetM1].map((p: PerfettoTracePacket) =>
        p.toObject(),
      ),
    );
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
    expect(
      trace.getPacketList().map((p: PerfettoTracePacket) => p.toObject()),
    ).toEqual(
      [
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
      ].map((p: PerfettoTracePacket) => p.toObject()),
    );
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
    expect(
      trace.getPacketList().map((p: PerfettoTracePacket) => p.toObject()),
    ).toEqual(
      [clockSnapshot, packet].map((p: PerfettoTracePacket) => p.toObject()),
    );
  });

  it('converts legacy trace with zero timestamp and non-zero monotonic offset', async () => {
    const packet = makePacketWithBoottimeTs(0);
    const reader = makeFileReader([packet]);
    spyOn(reader, 'getRealToBootTimeOffsetNs').and.returnValue(undefined);
    spyOn(reader, 'getRealToMonotonicTimeOffsetNs').and.returnValue(10n);
    const perfettoFile = await convertToPerfetto([reader]);
    const trace = await checkAndDecodePerfettoFile(assertDefined(perfettoFile));
    const clockSnapshot = makeExpectedClockSnapshot({
      realtime: 10n,
      boottime: 0n,
      monotonic: 0n,
    });
    expect(
      trace.getPacketList().map((p: PerfettoTracePacket) => p.toObject()),
    ).toEqual(
      [clockSnapshot, packet].map((p: PerfettoTracePacket) => p.toObject()),
    );
  });

  it('robust to errors in existing trace decoding', async () => {
    const userNotifierChecker = new UserNotifierChecker();
    const readers = [makeFileReader([])];
    spyOn(PerfettoTrace, 'deserializeBinary').and.throwError('decoding failed');
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
    const packet = new PerfettoTracePacket();
    packet.setTrustedPacketSequenceId(1);
    packet.setTimestamp(ts.toString());
    packet.setTimestampClockId(
      PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
    );
    return packet;
  }

  function makePacketWithBoottimeTs(ts: number) {
    const packet = new PerfettoTracePacket();
    packet.setTrustedPacketSequenceId(1);
    packet.setTimestamp(ts.toString());
    packet.setTimestampClockId(
      PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
    );
    return packet;
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

  async function testElapsedTraces(packets: PerfettoTracePacket[]) {
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
    expect(
      trace.getPacketList().map((p: PerfettoTracePacket) => p.toObject()),
    ).toEqual(
      [...snapshotPackets, ...packets].map((p: PerfettoTracePacket) =>
        p.toObject(),
      ),
    );
  }

  async function testBoottimeTraces(packets: PerfettoTracePacket[]) {
    const reader = makeFileReader(packets);
    spyOn(reader, 'getRealToBootTimeOffsetNs').and.returnValue(3n);
    spyOn(reader, 'getRealToMonotonicTimeOffsetNs').and.returnValue(undefined);
    await testConversion(reader, packets, false);
  }

  async function testMonotonicTraces(packets: PerfettoTracePacket[]) {
    const reader = makeFileReader(packets);
    spyOn(reader, 'getRealToBootTimeOffsetNs').and.returnValue(undefined);
    spyOn(reader, 'getRealToMonotonicTimeOffsetNs').and.returnValue(3n);
    await testConversion(reader, packets, true);
  }

  async function testConversion(
    reader: LegacyFileReader,
    packets: PerfettoTracePacket[],
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
    expect(
      trace.getPacketList().map((p: PerfettoTracePacket) => p.toObject()),
    ).toEqual(
      [...snapshotPackets, ...packets].map((p: PerfettoTracePacket) =>
        p.toObject(),
      ),
    );
  }

  function makeSnapshotFromPacket(
    packet: PerfettoTracePacket,
    isMonotonic = false,
  ) {
    const tsFn = packet.getTimestamp();
    const tsStr = tsFn !== undefined ? tsFn.toString() : '0';
    const realtime = BigInt(tsStr);
    return makeExpectedClockSnapshot({
      realtime,
      boottime: realtime - 3n,
      monotonic: isMonotonic ? realtime - 3n : undefined,
    });
  }

  function makeExistingPerfettoFile(
    clockSnapshot20: PerfettoTracePacket,
    emptyPacket: PerfettoTracePacket,
  ) {
    const existingTrace = new PerfettoTrace();
    existingTrace.setPacketList([clockSnapshot20, emptyPacket]);
    return new TraceFile(
      new File(
        [existingTrace.serializeBinary() as unknown as ArrayBuffer],
        'existing_trace',
      ),
    );
  }

  function makeFileReader(
    testPackets: PerfettoTracePacket[],
    conversionError = false,
  ): LegacyFileReader {
    const ts =
      testPackets.length === 0
        ? [makeRealTimestamp(0n)]
        : testPackets.map((testPacket) => {
            const ns = BigInt(testPacket?.getTimestamp() ?? '0');
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
  ): Promise<PerfettoTrace> {
    const expectedPerfettoTraceName = 'combined_winscope_trace.perfetto-trace';
    expect(perfettoFile.getDescriptor()).toEqual(expectedPerfettoTraceName);
    const fileBuffer = new Uint8Array(await perfettoFile.file.arrayBuffer());
    return PerfettoTrace.deserializeBinary(fileBuffer);
  }

  function makeExpectedClockSnapshot(
    clockSnapshot: ClockSnapshot,
  ): PerfettoTracePacket {
    const realtime = clockSnapshot.realtime.toString();

    const clockRealtimeCoarse = new PerfettoClockSnapshot.Clock();
    clockRealtimeCoarse.setClockId(
      PerfettoClockSnapshot.Clock.BuiltinClocks.REALTIME_COARSE,
    );
    clockRealtimeCoarse.setTimestamp(realtime);

    const clockRealtime = new PerfettoClockSnapshot.Clock();
    clockRealtime.setClockId(
      PerfettoClockSnapshot.Clock.BuiltinClocks.REALTIME,
    );
    clockRealtime.setTimestamp(realtime);

    const clocks = [clockRealtimeCoarse, clockRealtime];

    if (clockSnapshot.boottime !== undefined) {
      const clockBoottime = new PerfettoClockSnapshot.Clock();
      clockBoottime.setClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.BOOTTIME,
      );
      clockBoottime.setTimestamp(clockSnapshot.boottime.toString());
      clocks.push(clockBoottime);
    }

    if (clockSnapshot.monotonic !== undefined) {
      const monotonic = clockSnapshot.monotonic.toString();

      const clockMonotonic = new PerfettoClockSnapshot.Clock();
      clockMonotonic.setClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
      );
      clockMonotonic.setTimestamp(monotonic);

      const clockMonotonicCoarse = new PerfettoClockSnapshot.Clock();
      clockMonotonicCoarse.setClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC_COARSE,
      );
      clockMonotonicCoarse.setTimestamp(monotonic);

      const clockMonotonicRaw = new PerfettoClockSnapshot.Clock();
      clockMonotonicRaw.setClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC_RAW,
      );
      clockMonotonicRaw.setTimestamp(monotonic);

      clocks.push(clockMonotonic, clockMonotonicCoarse, clockMonotonicRaw);
    }

    const packet = new PerfettoTracePacket();
    packet.setTrustedPacketSequenceId(1);
    const snapshot = new PerfettoClockSnapshot();
    snapshot.setClocksList(clocks);
    packet.setClockSnapshot(snapshot);
    return packet;
  }
});

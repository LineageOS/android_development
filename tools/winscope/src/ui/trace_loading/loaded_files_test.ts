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
import {unzipFile} from '@common/io';
import {makeElapsedTimestamp, makeRealTimestamp,} from '@common/time/testing/test_helpers';
import {TimeRange} from '@common/time/time';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TestFileReaderBuilder} from '@legacy_file_readers/testing/test_file_reader_builder';
import {TestLegacyFileReaderBuilder} from '@legacy_file_readers/testing/test_legacy_file_reader_builder';
import {UserWarning} from '@messaging/user_warning';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {FileReader} from '@trace_api/file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

import {LoadedFiles} from './loaded_files';
import {makeWarningTraceHasElapsedTimestamps, makeWarningTraceHasOldData, makeWarningTraceOverridden,} from './warnings';

describe('LoadedFiles', () => {
  const realZeroTimestamp = makeRealTimestamp(0n);
  const elapsedZeroTimestamp = makeElapsedTimestamp(0n);
  const oldTimestamps = [
    realZeroTimestamp,
    makeRealTimestamp(1n),
    makeRealTimestamp(2n),
    makeRealTimestamp(3n),
    makeRealTimestamp(4n),
  ];

  const timestamps = [
    makeRealTimestamp(5n * 60n * 1000000000n + 10n), // 5m10ns
    makeRealTimestamp(5n * 60n * 1000000000n + 11n), // 5m11ns
    makeRealTimestamp(5n * 60n * 1000000000n + 12n), // 5m12ns
  ];

  const legacyReaderSf0 = new TestLegacyFileReaderBuilder()
    .setType(TraceType.SURFACE_FLINGER)
    .setTimestamps(timestamps)
    .setDescriptors(['sf0'])
    .build();
  const legacyReaderWm0 = new TestLegacyFileReaderBuilder()
    .setType(TraceType.WINDOW_MANAGER)
    .setTimestamps(timestamps)
    .setDescriptors(['wm0'])
    .build();
  const legacyReaderSf_elapsed = new TestLegacyFileReaderBuilder()
    .setType(TraceType.SURFACE_FLINGER)
    .setTimestamps(timestamps)
    .setDescriptors(['sf elapsed'])
    .setNoOffsets(true)
    .build();
  const legacyReaderWm_elapsed = new TestLegacyFileReaderBuilder()
    .setType(TraceType.WINDOW_MANAGER)
    .setTimestamps(timestamps)
    .setDescriptors(['wm elapsed'])
    .setNoOffsets(true)
    .build();
  const legacyReaderNoOffsets = new TestLegacyFileReaderBuilder()
    .setType(TraceType.CUJS)
    .setTimestamps(timestamps)
    .setDescriptors(['cujs'])
    .setNoOffsets(true)
    .build();
  const legacyReaderSf_longButOldData = new TestLegacyFileReaderBuilder()
    .setType(TraceType.SURFACE_FLINGER)
    .setTimestamps(oldTimestamps)
    .setDescriptors(['sf old'])
    .build();
  const legacyReaderWm_dump = new TestLegacyFileReaderBuilder()
    .setType(TraceType.WINDOW_MANAGER)
    .setTimestamps([realZeroTimestamp])
    .setDescriptors(['wm dump'])
    .build();
  const legacyReaderWmTransitions = new TestLegacyFileReaderBuilder()
    .setType(TraceType.WM_TRANSITION)
    .setTimestamps([
      elapsedZeroTimestamp,
      elapsedZeroTimestamp,
      elapsedZeroTimestamp,
    ])
    .setDescriptors(['wm transitions'])
    .build();
  const legacyReaderSf_empty = new TestLegacyFileReaderBuilder()
    .setType(TraceType.SURFACE_FLINGER)
    .setTimestamps([])
    .setDescriptors(['sf empty'])
    .build();

  const readerSf1 = new TestFileReaderBuilder()
    .setType(TraceType.SURFACE_FLINGER)
    .setTimestamps(timestamps)
    .setDescriptors(['sf1'])
    .build();
  const readerWm1 = new TestFileReaderBuilder()
    .setType(TraceType.WINDOW_MANAGER)
    .setTimestamps(timestamps)
    .setDescriptors(['wm1'])
    .build();
  const readerScreenRecording = new TestFileReaderBuilder()
    .setType(TraceType.SCREEN_RECORDING)
    .setTimestamps(timestamps)
    .setDescriptors(['screen recording'])
    .build();
  const readerViewCapture0 = new TestFileReaderBuilder()
    .setType(TraceType.VIEW_CAPTURE)
    .setTimestamps([])
    .setDescriptors(['vc0'])
    .build();
  const readerViewCapture1 = new TestFileReaderBuilder()
    .setType(TraceType.VIEW_CAPTURE)
    .setTimestamps([])
    .setDescriptors(['vc1'])
    .build();
  const perfettoFilename = 'perfetto trace';

  let loadedFiles: LoadedFiles<FileReader>;
  let userNotifierChecker: UserNotifierChecker;

  beforeAll(() => {
    userNotifierChecker = new UserNotifierChecker();
  });

  beforeEach(() => {
    loadedFiles = new LoadedFiles();
    userNotifierChecker.reset();
  });

  it('can load a single legacy file reader', () => {
    loadReaders([legacyReaderSf0], [], []);
    expectLoadResult([legacyReaderSf0], [], []);
  });

  it('can load a single non-perfetto reader', () => {
    loadReaders([], [legacyReaderSf0], []);
    expectLoadResult([], [legacyReaderSf0], []);
  });

  it('can load a single perfetto reader', () => {
    loadReaders([], [], [legacyReaderSf0]);
    expectLoadResult([], [legacyReaderSf0], []);
  });

  it('loads multiple perfetto readers with same trace type', async () => {
    loadReaders([], [], [legacyReaderSf0, readerSf1]);
    expectLoadResult([], [legacyReaderSf0, readerSf1], []);
  });

  it('loads legacy file reader without dropping already-loaded legacy reader (different trace type)', async () => {
    loadReaders([legacyReaderSf0], [], []);
    expectLoadResult([legacyReaderSf0], [], []);

    loadReaders([legacyReaderWm0], [], []);
    expectLoadResult([legacyReaderSf0, legacyReaderWm0], [], []);
  });

  it('loads legacy file reader without dropping already-loaded legacy reader (same trace type)', async () => {
    loadReaders([legacyReaderSf0], [], []);
    expectLoadResult([legacyReaderSf0], [], []);

    loadReaders([legacyReaderSf0], [], []);
    expectLoadResult([legacyReaderSf0, legacyReaderSf0], [], []);
  });

  it('loads non-perfetto reader without dropping already-loaded non-perfetto reader (same trace type)', async () => {
    loadReaders([], [legacyReaderSf0], []);
    expectLoadResult([], [legacyReaderSf0], []);

    loadReaders([], [legacyReaderSf0], []);
    expectLoadResult([], [legacyReaderSf0, legacyReaderSf0], []);
  });

  it('warns about elapsed-only legacy readers if readers with real timestamps present', () => {
    loadReaders([legacyReaderSf_elapsed, legacyReaderSf0], [], []);
    expectLoadResult(
      [legacyReaderSf_elapsed, legacyReaderSf0],
      [],
      [makeWarningTraceHasElapsedTimestamps('sf elapsed')],
    );
  });

  it('warns about elapsed-only readers if readers with real timestamps present', () => {
    loadReaders([], [legacyReaderSf_elapsed, legacyReaderSf0], []);
    expectLoadResult(
      [],
      [legacyReaderSf_elapsed, legacyReaderSf0],
      [makeWarningTraceHasElapsedTimestamps('sf elapsed')],
    );
  });

  it('does not warn about elapsed-only legacy readers if no readers with real timestamps present', () => {
    loadReaders([legacyReaderSf_elapsed, legacyReaderWm_elapsed], [], []);
    expectLoadResult([legacyReaderSf_elapsed, legacyReaderWm_elapsed], [], []);
  });

  it('does not warn about elapsed-only non-perfetto readers if no readers with real timestamps present', () => {
    loadReaders([], [legacyReaderSf_elapsed, legacyReaderWm_elapsed], []);
    expectLoadResult([], [legacyReaderSf_elapsed, legacyReaderWm_elapsed], []);
  });

  it('keeps real-time legacy readers without offset', () => {
    loadReaders([legacyReaderSf0, legacyReaderNoOffsets], [], []);
    expectLoadResult([legacyReaderSf0, legacyReaderNoOffsets], [], []);
  });

  it('keeps real-time readers without offset', () => {
    loadReaders([], [legacyReaderSf0, legacyReaderNoOffsets], []);
    expectLoadResult([], [legacyReaderSf0, legacyReaderNoOffsets], []);
  });

  describe('drops legacy reader with old data (dangling old trace file)', () => {
    const timeGapFrom = assertDefined(
      legacyReaderSf_longButOldData.getTimestamps().at(-1),
    );
    const timeGapTo = assertDefined(legacyReaderWm0.getTimestamps().at(0));
    const timeGap = new TimeRange(timeGapFrom, timeGapTo);

    it('taking into account other legacy readers', () => {
      loadReaders([legacyReaderSf_longButOldData, legacyReaderWm0], [], []);
      expectLoadResult(
        [legacyReaderWm0],
        [],
        [makeWarningTraceHasOldData(['sf old'], timeGap)],
      );
    });

    it('taking into account other non-perfetto readers', () => {
      loadReaders([], [legacyReaderSf_longButOldData, legacyReaderWm0], []);
      expectLoadResult(
        [],
        [legacyReaderWm0],
        [makeWarningTraceHasOldData(['sf old'], timeGap)],
      );
    });

    it('taking into account other legacy and non-perfetto readers', () => {
      loadReaders([legacyReaderWm0], [legacyReaderSf_longButOldData], []);
      expectLoadResult(
        [legacyReaderWm0],
        [],
        [makeWarningTraceHasOldData(['sf old'], timeGap)],
      );
    });

    it('taking into account perfetto readers', () => {
      loadReaders([legacyReaderSf_longButOldData], [], [legacyReaderWm0]);
      expectLoadResult(
        [],
        [legacyReaderWm0],
        [makeWarningTraceHasOldData(['sf old'], timeGap)],
      );
    });

    it('taking into account already-loaded legacy readers', () => {
      loadReaders([legacyReaderWm0], [], []);

      // Drop reader with old data, even if it provides a longer trace than the
      // already-loaded reader
      loadReaders([legacyReaderSf_longButOldData], [], []);
      expectLoadResult(
        [legacyReaderWm0],
        [],
        [makeWarningTraceHasOldData(['sf old'], timeGap)],
      );
    });

    it('doesnt drop legacy reader with dump (zero timestamp)', () => {
      loadReaders([legacyReaderWm_dump, legacyReaderSf0], [], []);
      expectLoadResult([legacyReaderWm_dump, legacyReaderSf0], [], []);
    });

    it('doesnt drop non-perfetto reader with dump (zero timestamp)', () => {
      loadReaders([], [legacyReaderWm_dump, legacyReaderSf0], []);
      expectLoadResult([], [legacyReaderWm_dump, legacyReaderSf0], []);
    });

    it('doesnt drop legacy reader with wm transitions', () => {
      // Only Shell Transition data used to set timestamps of merged Transition trace,
      // so WM Transition data should not be considered by "old data" policy
      loadReaders([legacyReaderWmTransitions, legacyReaderSf0], [], []);
      expectLoadResult([legacyReaderWmTransitions, legacyReaderSf0], [], []);
    });

    it('is robust to traces with time range overlap', () => {
      const reader = legacyReaderSf0;
      const timestamps = reader.getTimestamps();
      const filename = 'overlapping';

      const timestampsOverlappingFront = [
        timestamps[0].add(-1n),
        timestamps[0].add(1n),
      ];
      const readerOverlappingFront = new TestLegacyFileReaderBuilder()
        .setType(TraceType.TRANSACTIONS)
        .setTimestamps(timestampsOverlappingFront)
        .setDescriptors([filename])
        .build();

      const timestampsOverlappingBack = [
        timestamps[timestamps.length - 1].add(-1n),
        timestamps[timestamps.length - 1].add(1n),
      ];
      const readerOverlappingBack = new TestLegacyFileReaderBuilder()
        .setType(TraceType.TRANSITION)
        .setTimestamps(timestampsOverlappingBack)
        .setDescriptors([filename])
        .build();

      const timestampsOverlappingEntirely = [
        timestamps[0].add(-1n),
        timestamps[timestamps.length - 1].add(1n),
      ];
      const readerOverlappingEntirely = new TestLegacyFileReaderBuilder()
        .setType(TraceType.VIEW_CAPTURE)
        .setTimestamps(timestampsOverlappingEntirely)
        .setDescriptors([filename])
        .build();

      const timestampsOverlappingExactly = [
        timestamps[0],
        timestamps[timestamps.length - 1],
      ];
      const readerOverlappingExactly = new TestLegacyFileReaderBuilder()
        .setType(TraceType.WINDOW_MANAGER)
        .setTimestamps(timestampsOverlappingExactly)
        .setDescriptors([filename])
        .build();

      loadReaders(
        [reader, readerOverlappingFront, readerOverlappingBack],
        [readerOverlappingEntirely, readerOverlappingExactly],
        [],
      );
      expectLoadResult(
        [reader, readerOverlappingFront, readerOverlappingBack],
        [readerOverlappingEntirely, readerOverlappingExactly],
        [],
      );
    });
  });

  it('loads perfetto reader dropping all already-loaded perfetto readers', () => {
    loadReaders([], [], [legacyReaderSf0, legacyReaderWm0]);
    expectLoadResult([], [legacyReaderSf0, legacyReaderWm0], []);

    // We currently run only one Perfetto TP WebWorker at a time, so Perfetto
    // readers previously loaded are now invalid and must be removed (previous
    // WebWorker is not running anymore).
    loadReaders([], [], [readerSf1, readerWm1]);
    expectLoadResult([], [readerSf1, readerWm1], []);
  });

  describe('prioritizes perfetto readers over legacy readers', () => {
    // While transitioning to the Perfetto format, devices might still have old
    // legacy trace files dangling in the disk that get automatically included
    // into bugreports. Hence, Perfetto readers must always override legacy ones
    // so that dangling legacy files are ignored.

    it('when a perfetto reader is already loaded', () => {
      loadReaders([legacyReaderSf0], [], [readerSf1]);
      expectLoadResult([], [readerSf1], []);
      userNotifierChecker.reset();
      loadReaders([legacyReaderSf0], [], []);
      expectLoadResult([], [readerSf1], []);
    });

    it('when a perfetto reader is loaded afterwards', () => {
      loadReaders([legacyReaderSf0], [], []);
      expectLoadResult([legacyReaderSf0], [], []);

      loadReaders([], [], [readerSf1]);
      expectLoadResult([], [readerSf1], []);
    });
  });

  it('robust to legacy + perfetto readers of same type', () => {
    loadReaders([legacyReaderSf0, legacyReaderSf0], [], [readerSf1]);
    expectLoadResult([], [readerSf1], []);
  });

  describe('is robust to reader with no entries', () => {
    it('legacy reader', () => {
      loadReaders([legacyReaderSf_empty], [], []);
      expectLoadResult([legacyReaderSf_empty], [], []);
    });

    it('non-perfetto reader', () => {
      loadReaders([], [legacyReaderSf_empty], []);
      expectLoadResult([], [legacyReaderSf_empty], []);
    });

    it('perfetto reader', () => {
      loadReaders([], [], [legacyReaderSf_empty]);
      expectLoadResult([], [legacyReaderSf_empty], []);
    });
  });

  describe('handles screen recordings and screenshots', () => {
    const readerScreenRecording0 = new TestFileReaderBuilder()
      .setType(TraceType.SCREEN_RECORDING)
      .setTimestamps(timestamps)
      .setDescriptors(['screen_recording.mp4'])
      .build();
    const readerScreenRecording1 = new TestFileReaderBuilder()
      .setType(TraceType.SCREEN_RECORDING)
      .setTimestamps(timestamps)
      .setDescriptors(['screen_recording.mp4'])
      .build();
    const readerScreenshot0 = new TestFileReaderBuilder()
      .setType(TraceType.SCREENSHOT)
      .setTimestamps(timestamps)
      .setDescriptors(['screenshot.png'])
      .build();
    const overrideError = makeWarningTraceOverridden(
      'screenshot.png',
      TraceType.SCREEN_RECORDING,
    );

    it('loads screenshot reader', () => {
      loadReaders([], [readerScreenshot0], []);
      expectLoadResult([], [readerScreenshot0], []);
    });

    it('loads screen recording reader', () => {
      loadReaders([], [readerScreenRecording0], []);
      expectLoadResult([], [readerScreenRecording0], []);
    });

    it('does not load screenshot reader after loading screen recording reader in same call', () => {
      loadReaders([], [readerScreenshot0, readerScreenRecording0], []);
      expectLoadResult([], [readerScreenRecording0], [overrideError]);
    });

    it('does not load screenshot reader after loading screen recording reader in previous call', () => {
      loadReaders([], [readerScreenRecording0], []);
      expectLoadResult([], [readerScreenRecording0], []);

      loadReaders([], [readerScreenshot0], []);
      expectLoadResult([], [readerScreenRecording0], [overrideError]);
    });

    it('overrides previously loaded screenshot reader with screen recording reader', () => {
      loadReaders([], [readerScreenshot0], []);
      expectLoadResult([], [readerScreenshot0], []);

      loadReaders([], [readerScreenRecording0], []);
      expectLoadResult([], [readerScreenRecording0], [overrideError]);
    });

    it('loads multiple screen recordings', () => {
      loadReaders([], [readerScreenRecording0], []);
      expectLoadResult([], [readerScreenRecording0], []);

      loadReaders([], [readerScreenRecording1], []);
      expectLoadResult(
        [],
        [readerScreenRecording0, readerScreenRecording1],
        [],
      );
    });
  });

  it('can remove readers', () => {
    loadReaders([legacyReaderSf0], [], [legacyReaderWm0]);
    expectLoadResult([legacyReaderSf0], [legacyReaderWm0], []);

    loadedFiles.remove(legacyReaderWm0);
    expectLoadResult([legacyReaderSf0], [], []);

    loadedFiles.remove(legacyReaderSf0);
    expectLoadResult([], [], []);
  });

  it('can make zip archive of traces with appropriate directories and extensions', async () => {
    const filename = 'filename';
    const fileDuplicated = new File([], filename);

    const legacyFiles = [
      // ScreenRecording
      new File([], filename),

      // ViewCapture
      // Multiple readers point to the same viewcapture file,
      // but we expect to see only one in the output archive (deduplicated)
      fileDuplicated,
      fileDuplicated,

      // WM
      new File([], filename + '.pb'),

      // WM
      // Same filename as above.
      // Expect this file to be automatically renamed to avoid clashes/overwrites
      new File([], filename + '.pb'),
    ];

    const readers = [
      readerScreenRecording,
      readerViewCapture0,
      readerViewCapture1,
      legacyReaderWm0,
      readerWm1,
    ];

    readers.forEach((reader, index) => {
      spyOn(reader, 'getFiles').and.returnValue([
        new TraceFile(legacyFiles[index]),
      ]);
    });

    loadReaders([], readers, [legacyReaderSf0, legacyReaderWmTransitions]);
    expectLoadResult(
      [],
      [
        readerScreenRecording,
        readerViewCapture0,
        readerViewCapture1,
        legacyReaderWm0,
        readerWm1,
        legacyReaderSf0,
        legacyReaderWmTransitions,
      ],
      [],
    );

    await expectDownloadResult([
      'filename.mp4',
      'perfetto trace.perfetto-trace',
      'vc/filename.winscope',
      'wm/filename (1).pb',
      'wm/filename.pb',
    ]);
  });

  it('makes zip archive with progress listener', async () => {
    loadReaders([], [legacyReaderSf0], [legacyReaderWm0]);
    expectLoadResult([], [legacyReaderSf0, legacyReaderWm0], []);

    const progressSpy = jasmine.createSpy();
    await loadedFiles.makeZipArchive(progressSpy);

    expect(progressSpy).toHaveBeenCalledTimes(5);
    expect(progressSpy).toHaveBeenCalledWith(0);
    expect(progressSpy).toHaveBeenCalledWith(0.25);
    expect(progressSpy).toHaveBeenCalledWith(0.5);
    expect(progressSpy).toHaveBeenCalledWith(0.75);
    expect(progressSpy).toHaveBeenCalledWith(1);
  });

  function loadReaders(
    legacy: LegacyFileReader[],
    nonPerfetto: FileReader[],
    perfetto: FileReader[],
  ) {
    const perfettoTraceFile = new TraceFile(new File([], perfettoFilename));
    perfetto.forEach((file) => {
      spyOn(file, 'getFiles').and.returnValue([perfettoTraceFile]);
    });
    loadedFiles.addFiles(legacy, nonPerfetto, perfetto);
  }

  function expectLoadResult(
    expectedLegacyReaders: LegacyFileReader[],
    expectedNonLegacyReaders: FileReader[],
    expectedWarnings: UserWarning[],
  ) {
    const legacyReaders = loadedFiles.getLegacyFileReaders();
    expect(legacyReaders.length).toEqual(expectedLegacyReaders.length);
    expect(new Set([...legacyReaders])).toEqual(
      new Set([...expectedLegacyReaders]),
    );

    const nonLegacyReaders = loadedFiles
      .getPerfettoFileReaders()
      .concat(loadedFiles.getNonPerfettoFileReaders());
    expect(nonLegacyReaders.length).toEqual(expectedNonLegacyReaders.length);
    expect(new Set([...nonLegacyReaders])).toEqual(
      new Set([...expectedNonLegacyReaders]),
    );

    userNotifierChecker.expectAdded(expectedWarnings);
  }

  async function expectDownloadResult(expectedArchiveContents: string[]) {
    const zipArchive = await loadedFiles.makeZipArchive();
    const actualArchiveContents = (await unzipFile(zipArchive))
      .map((file) => file.name)
      .sort();
    expect(actualArchiveContents).toEqual(expectedArchiveContents);
  }
});

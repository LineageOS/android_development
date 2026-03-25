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

import {getFixtureFile} from '@common/testing/io_helpers';
import {ASIA_TIMEZONE_INFO} from '@common/time/testing/test_helpers';
import {TimezoneInfo} from '@common/time/time';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {ProcessedFiles} from '@legacy_file_readers/common/processed_files';
import {TestFileReaderBuilder} from '@legacy_file_readers/testing/test_file_reader_builder';
import {TestLegacyFileReaderBuilder} from '@legacy_file_readers/testing/test_legacy_file_reader_builder';
import {WinscopeEvent} from '@messaging/winscope_event';
import {UserNotifierChecker} from '@services/testing/user_notifier_checker';
import {FileReader} from '@trace_api/file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceMetadata} from '@trace_api/trace_metadata';
import {BugreportFileSelected, BugreportFileSelectionRequest,} from '@ui/shared/events/misc_events';

import {BuildType} from './bugreport_data';
import {TraceFileIdentifier} from './trace_file_identifier';
import {makeWarningMissingPersistentTrace, makeWarningNoValidFiles, makeWarningTraceOverridden,} from './warnings';

describe('TraceFileIdentifier', () => {
  const identifier = new TraceFileIdentifier<FileReader>();
  const persistentTracingProperty =
    'persist.debug.perfetto.persistent_sysui_tracing_for_bugreport';

  // Could be any file, we just need an instance of File to be used as a fake bugreport archive
  const bugreportArchive = new File([new ArrayBuffer(0)], 'test_bugreport.zip');

  let userNotifierChecker: UserNotifierChecker;

  beforeAll(() => {
    userNotifierChecker = new UserNotifierChecker();
  });

  beforeEach(() => {
    userNotifierChecker.reset();
  });

  describe('bugreport (detects it is a bugreport)', () => {
    it('ignores non-trace dirs', async () => {
      const pickedBugreportFiles = [
        makeTraceFile(
          'FS/data/misc/wmtrace/surface_flinger.bp',
          bugreportArchive,
        ),
        makeTraceFile('FS/data/misc/wmtrace/transactions.bp', bugreportArchive),
        makeTraceFile('proto/window_CRITICAL.proto', bugreportArchive),
        makeTraceFile('proto/input_method_CRITICAL.proto', bugreportArchive),
        makeTraceFile('proto/SurfaceFlinger_CRITICAL.proto', bugreportArchive),
      ];

      const ignoredBugreportFile = makeTraceFile(
        'FS/data/misc/ignored-dir/wm_transition_trace.bp',
        bugreportArchive,
      );

      const bugreportFiles = [
        await makeBugreportMainEntryTraceFile(),
        await makeBugreportCodenameTraceFile(),
        ...pickedBugreportFiles,
        ignoredBugreportFile,
      ];

      // Corner case:
      // A plain trace file is loaded along the bugreport
      //    -> trace file must not be ignored
      //
      // Note:
      // The even weirder corner case where two bugreports are loaded at the same time is
      // currently not properly handled.
      const plainTraceFile = makeTraceFile(
        'would-be-ignored-if-was-part-of-bugreport/input_method_clients.pb',
      );

      const result = await identifier.identifyFiles(
        [...bugreportFiles, plainTraceFile],
        tryIdentifyLegacy,
        tryIdentifyNonPerfetto,
        (file) => tryIdentifyPerfetto(file, []),
      );
      expect(result.perfetto.length).toBe(0);

      const actualLegacy = result.legacy.flatMap((p) => p.getFiles());
      expect(actualLegacy).toEqual([...pickedBugreportFiles, plainTraceFile]);
      userNotifierChecker.expectNone();
    });

    it('picks perfetto sysui.pftrace (persistent session)', async () => {
      const perfettoSysUi = makeTraceFile(
        'FS/data/misc/perfetto-traces/bugreport/sysui.pftrace',
        bugreportArchive,
      );
      const otherFiles = [
        makeTraceFile(
          'FS/data/misc/perfetto-traces/other.perfetto-trace',
          bugreportArchive,
        ),
        makeTraceFile(
          'FS/data/misc/perfetto-traces/other.pftrace',
          bugreportArchive,
        ),
        makeTraceFile(
          'FS/data/misc/perfetto-traces/bugreport/other.pftrace',
          bugreportArchive,
          10,
        ),
      ];
      await checkPerfettoPicked(perfettoSysUi, otherFiles);
    });

    it('picks perfetto systrace.pftrace (traceur or aot session) over sysui.pftrace', async () => {
      const perfettoSysTrace = makeTraceFile(
        'FS/data/misc/perfetto-traces/bugreport/systrace.pftrace',
        bugreportArchive,
      );
      await checkPerfettoPicked(perfettoSysTrace, [
        makeTraceFile(
          'FS/data/misc/perfetto-traces/bugreport/sysui.pftrace',
          bugreportArchive,
          10,
        ),
      ]);
    });

    it('picks single file in perfetto directory', async () => {
      const perfettoTest = makeTraceFile(
        'FS/data/misc/perfetto-traces/bugreport/test.pftrace',
        bugreportArchive,
      );
      await checkPerfettoPicked(perfettoTest, []);
    });

    it('sends request for file selection if multiple files in perfetto directory', async () => {
      let requested: string[] | undefined;
      identifier.setEmitEvent(async (event: WinscopeEvent) => {
        if (event instanceof BugreportFileSelectionRequest) {
          requested = event.filenames;
          await identifier.onWinscopeEvent(
            new BugreportFileSelected(event.filenames[1]),
          );
        }
      });

      const perfettoTest = makeTraceFile(
        'FS/data/misc/perfetto-traces/bugreport/test.pftrace',
        bugreportArchive,
      );
      const perfettoOther = makeTraceFile(
        'FS/data/misc/perfetto-traces/bugreport/other.pftrace',
        bugreportArchive,
      );
      await checkPerfettoPicked(perfettoOther, [perfettoTest]);
      expect(requested).toEqual([
        'FS/data/misc/perfetto-traces/bugreport/test.pftrace',
        'FS/data/misc/perfetto-traces/bugreport/other.pftrace',
      ]);
    });

    it('ignores perfetto traces not in bugreport directory', async () => {
      const perfettoFiles = [
        makeTraceFile(
          'FS/data/misc/perfetto-traces/other.perfetto-trace',
          bugreportArchive,
        ),
        makeTraceFile(
          'FS/data/misc/perfetto-traces/other.pftrace',
          bugreportArchive,
        ),
      ];
      const bugreportFiles = [
        await makeBugreportMainEntryTraceFile(),
        await makeBugreportCodenameTraceFile(),
        ...perfettoFiles,
      ];
      const result = await identifier.identifyFiles(
        bugreportFiles,
        tryIdentifyLegacy,
        tryIdentifyNonPerfetto,
        (file) => tryIdentifyPerfetto(file, perfettoFiles),
      );
      expect(result.perfetto.length).toBe(0);
      expect(result.legacy).toEqual([]);
      userNotifierChecker.expectAdded([makeWarningNoValidFiles()]);
    });

    it('identifies timezone information from bugreport codename file', async () => {
      const legacyFile = makeTraceFile(
        'proto/window_CRITICAL.proto',
        bugreportArchive,
      );
      const bugreportFiles = [
        await makeBugreportMainEntryTraceFile(),
        await makeBugreportCodenameTraceFile(),
        legacyFile,
      ];

      let identifiedTimezoneInfo: TimezoneInfo | undefined;
      const tryIdentifyLegacyFiles = (
        files: TraceFile[],
        timezoneInfo?: TimezoneInfo,
      ) => {
        identifiedTimezoneInfo = timezoneInfo;
        return tryIdentifyLegacy(files);
      };

      const result = await identifier.identifyFiles(
        bugreportFiles,
        tryIdentifyLegacyFiles,
        tryIdentifyNonPerfetto,
        (file) => tryIdentifyPerfetto(file, []),
      );
      expect(result.legacy.flatMap((f) => f.getFiles())).toEqual([legacyFile]);
      expect(result.perfetto.length).toBe(0);
      expect(identifiedTimezoneInfo).toEqual(ASIA_TIMEZONE_INFO);
      userNotifierChecker.expectNone();
    });

    it('unzips trace files within bugreport zip', async () => {
      const zippedTraceFile = await makeZippedTraceFile();

      const bugreportFiles = [
        await makeBugreportMainEntryTraceFile(),
        await makeBugreportCodenameTraceFile(),
        zippedTraceFile,
      ];

      const result = await identifier.identifyFiles(
        bugreportFiles,
        tryIdentifyLegacy,
        tryIdentifyNonPerfetto,
        (file) => tryIdentifyPerfetto(file, []),
      );
      expect(result.perfetto.length).toBe(0);
      expect(
        result.legacy.flatMap((fileReaders) => {
          return fileReaders.getFiles().map((f) => f.file.name);
        }),
      ).toEqual([
        'Surface Flinger/SurfaceFlinger.pb',
        'Window Manager/WindowManager.pb',
      ]);
      userNotifierChecker.expectNone();
    });

    it('warns about missing trace on user build', async () => {
      await checkMissingPerfettoTraceWarning(BuildType.USER, undefined, false, [
        "'user' builds",
        'expected',
      ]);
    });

    it('warns about missing trace on userdebug build with persistent flag disabled', async () => {
      await checkMissingPerfettoTraceWarning(BuildType.USERDEBUG, '0', false, [
        'seems to be disabled',
        'adb shell setprop',
      ]);
    });

    it('warns about missing trace on userdebug build with persistent flag enabled', async () => {
      await checkMissingPerfettoTraceWarning(BuildType.USERDEBUG, '1', true, [
        'No Winscope Perfetto trace found in bug report. Ensure the bugreport comes from a device where persistent tracing is enabled',
      ]);
    });

    it('warns about missing trace on userdebug build with persistent flag unknown', async () => {
      await checkMissingPerfettoTraceWarning(
        BuildType.USERDEBUG,
        undefined,
        false,
        [
          'No Winscope Perfetto trace found in bug report.',
          `The persistent tracing property ('${persistentTracingProperty}') seems to be disabled`,
        ],
      );
    });

    it('warns about missing trace on eng build with persistent flag disabled', async () => {
      await checkMissingPerfettoTraceWarning(BuildType.ENG, '0', false, [
        'No Winscope Perfetto trace found in bug report.',
        `The persistent tracing property ('${persistentTracingProperty}') seems to be disabled`,
      ]);
    });

    it('warns about missing trace on eng build with persistent flag enabled', async () => {
      await checkMissingPerfettoTraceWarning(BuildType.ENG, '1', true, [
        'No Winscope Perfetto trace found in bug report. Ensure the bugreport comes from a device where persistent tracing is enabled',
      ]);
    });

    it('does not warn if a valid perfetto trace is found', async () => {
      const perfettoSysTrace = makeTraceFile(
        'FS/data/misc/perfetto-traces/bugreport/systrace.pftrace',
        bugreportArchive,
      );
      const mainBugreportFilename = 'bugreport-user-build.txt';
      const bugreportFiles = [
        await makeCustomBugreportMainEntryTraceFile(mainBugreportFilename),
        makeMainBugreportFile(mainBugreportFilename, {
          'persist.sys.timezone': 'America/Los_Angeles',
        }),
        perfettoSysTrace, // Include the trace file
      ];

      const result = await identifier.identifyFiles(
        bugreportFiles,
        tryIdentifyLegacy,
        tryIdentifyNonPerfetto,
        (file) => tryIdentifyPerfetto(file, [perfettoSysTrace]),
      );
      expect(result.perfetto[0].getFiles()).toEqual([perfettoSysTrace]);
      expect(result.criticalWarnings.length).toBe(0); // No warnings expected
      userNotifierChecker.expectNone();
    });

    async function checkPerfettoPicked(
      perfetto: TraceFile,
      other: TraceFile[],
    ) {
      const bugreportFiles = [
        await makeBugreportMainEntryTraceFile(),
        await makeBugreportCodenameTraceFile(),
        ...other,
        perfetto,
      ];
      const result = await identifier.identifyFiles(
        bugreportFiles,
        tryIdentifyLegacy,
        tryIdentifyNonPerfetto,
        (file) => tryIdentifyPerfetto(file, [perfetto, ...other]),
      );
      expect(result.perfetto[0].getFiles()).toEqual([perfetto]);
      expect(result.legacy).toEqual([]);
      userNotifierChecker.expectNone();
    }
  });

  describe('plain input (no bugreport)', () => {
    it('picks perfetto trace with .perfetto-trace extension', async () => {
      const perfettoTrace = makeTraceFile('file.perfetto-trace');
      await checkPerfettoFilePickedWithoutErrors(perfettoTrace);
    });

    it('picks perfetto trace with .pftrace extension', async () => {
      const pftrace = makeTraceFile('file.pftrace');
      await checkPerfettoFilePickedWithoutErrors(pftrace);
    });

    it('picks perfetto trace with .perfetto extension', async () => {
      const perfetto = makeTraceFile('file.perfetto');
      await checkPerfettoFilePickedWithoutErrors(perfetto);
    });

    it('picks perfetto trace with .perfetto-trace.gz extension', async () => {
      const perfettoTraceGz = makeTraceFile('file.perfetto-trace.gz');
      await checkPerfettoFilePickedWithoutErrors(perfettoTraceGz);
    });

    it('picks perfetto trace with .pftrace.gz extension', async () => {
      const pftraceGz = makeTraceFile('file.pftrace.gz');
      await checkPerfettoFilePickedWithoutErrors(pftraceGz);
    });

    it('picks perfetto trace with .perfetto.gz extension', async () => {
      const perfettoGz = makeTraceFile('file.perfetto.gz');
      await checkPerfettoFilePickedWithoutErrors(perfettoGz);
    });

    it('picks largest perfetto trace', async () => {
      const small = makeTraceFile('small.perfetto-trace', undefined, 10);
      const medium = makeTraceFile('medium.perfetto-trace', undefined, 20);
      const large = makeTraceFile('large.perfetto-trace', undefined, 30);
      const result = await identifier.identifyFiles(
        [small, large, medium],
        tryIdentifyLegacy,
        tryIdentifyNonPerfetto,
        (file) => tryIdentifyPerfetto(file, [small, medium, large]),
      );
      expect(result.perfetto[0].getFiles()[0]).toEqual(large);
      expect(result.legacy).toEqual([]);
      userNotifierChecker.expectAdded([
        makeWarningTraceOverridden(small.getDescriptor()),
        makeWarningTraceOverridden(medium.getDescriptor()),
      ]);
    });

    it('picks largest perfetto trace from those without perfetto ext', async () => {
      const small = makeTraceFile('small', undefined, 10);
      const medium = makeTraceFile('medium', undefined, 20);
      const large = makeTraceFile('large', undefined, 30);

      const tryIdentifyUnsupported = async (files: TraceFile[]) => {
        return {
          supportedFiles: [],
          unsupportedFiles: files,
        };
      };

      const result = await identifier.identifyFiles(
        [small, large, medium],
        tryIdentifyUnsupported,
        tryIdentifyUnsupported,
        (file) => tryIdentifyPerfetto(file, [small, medium, large]),
      );
      expect(result.perfetto[0].getFiles()[0]).toEqual(large);
      expect(result.legacy).toEqual([]);
      userNotifierChecker.expectNone();
    });

    it('extracts screen recording metadata', async () => {
      const metadataJson = await makeMetadataJsonFile();
      const screenRecording = makeTraceFile('screen_recording.mp4');

      const tryIdentifyLegacyFiles = async () => {
        return {
          supportedFiles: [],
          unsupportedFiles: [screenRecording],
        };
      };

      let identifiedMetadata: TraceMetadata | undefined;
      const tryIdentifyNonPerfettoFiles = (
        files: TraceFile[],
        metadata: TraceMetadata,
      ) => {
        identifiedMetadata = metadata;
        return tryIdentifyNonPerfetto(files);
      };

      const result = await identifier.identifyFiles(
        [screenRecording, metadataJson],
        tryIdentifyLegacyFiles,
        tryIdentifyNonPerfettoFiles,
        (file) => tryIdentifyPerfetto(file, []),
      );
      expect(result.legacy.length).toBe(0);
      expect(result.nonPerfetto.flatMap((f) => f.getFiles())).toEqual([
        screenRecording,
      ]);
      expect(identifiedMetadata?.screenRecordingOffsets).toEqual({
        elapsedRealTimeNanos: 0n,
        realToElapsedTimeOffsetNanos: 1732721670187419904n,
      });
      userNotifierChecker.expectNone();
    });

    async function checkPerfettoFilePickedWithoutErrors(
      perfettoFile: TraceFile,
    ) {
      const result = await identifier.identifyFiles(
        [perfettoFile],
        tryIdentifyLegacy,
        tryIdentifyNonPerfetto,
        (file) => tryIdentifyPerfetto(file, [perfettoFile]),
      );
      expect(result.perfetto[0].getFiles()[0]).toEqual(perfettoFile);
      expect(result.legacy).toEqual([]);
      userNotifierChecker.expectNone();
    }
  });

  async function checkMissingPerfettoTraceWarning(
    buildType: BuildType,
    persistentFlag: string | undefined,
    isPersistentTracingEnabled: boolean,
    expectedMessageSubstrings: string[],
  ) {
    const mainBugreportFilename = `bugreport-${buildType}-build${
      persistentFlag ? '-flag' + persistentFlag : ''
    }.txt`;
    const properties: {[key: string]: string} = {
      'ro.build.type': buildType,
      'persist.sys.timezone': 'America/Los_Angeles', // Example timezone
    };
    if (persistentFlag !== undefined) {
      properties[persistentTracingProperty] = persistentFlag;
    }

    const bugreportFiles = [
      await makeCustomBugreportMainEntryTraceFile(mainBugreportFilename),
      makeMainBugreportFile(mainBugreportFilename, properties),
    ];

    const result = await identifier.identifyFiles(
      bugreportFiles,
      tryIdentifyLegacy,
      tryIdentifyNonPerfetto,
      (file) => tryIdentifyPerfetto(file, []),
    );

    expect(result.perfetto.length).toBe(0);
    expect(result.criticalWarnings.length).toBe(1);
    const warning = result.criticalWarnings[0];
    expect(warning).toEqual(
      makeWarningMissingPersistentTrace(
        {
          buildType,
          isPersistentTracingEnabled,
        },
        persistentTracingProperty,
      ),
    );

    expectedMessageSubstrings.forEach((substring) => {
      expect(warning.message).toContain(substring);
    });

    userNotifierChecker.expectAdded([makeWarningNoValidFiles()]);
  }

  function makeTraceFile(
    filename: string,
    parentArchive?: File,
    size?: number,
  ): TraceFile {
    size = size ?? 0;
    const file = new File([new ArrayBuffer(size)], filename);
    return new TraceFile(file as unknown as File, parentArchive);
  }

  function makeMainBugreportFile(
    filename: string, // Should match the content of main_entry.txt
    properties: {[key: string]: string},
    parentArchive?: File,
  ): TraceFile {
    let content = 'some initial bugreport content...\n';
    for (const [key, value] of Object.entries(properties)) {
      // Add other properties if needed for testing timezone etc.
      content += `[${key}]: [${value}]\n`;
    }
    content += '...some trailing bugreport content\n';

    const file = new File([content], filename);
    return new TraceFile(file, parentArchive ?? bugreportArchive);
  }

  async function makeCustomBugreportMainEntryTraceFile(
    mainBugreportFilename = 'bugreport-codename_beta-UPB2.230407.019-2023-05-30-14-33-48.txt',
  ): Promise<TraceFile> {
    // Ensure the content matches the filename used in makeMainBugreportFile
    const file = new File([mainBugreportFilename], 'main_entry.txt');
    return new TraceFile(file, bugreportArchive);
  }

  async function makeBugreportMainEntryTraceFile(): Promise<TraceFile> {
    const file = await getFixtureFile(
      'bugreports/main_entry.txt',
      'main_entry.txt',
    );
    return new TraceFile(file, bugreportArchive);
  }

  async function makeBugreportCodenameTraceFile(): Promise<TraceFile> {
    const file = await getFixtureFile(
      'bugreports/bugreport-codename_beta-UPB2.230407.019-2023-05-30-14-33-48.txt',
      'bugreport-codename_beta-UPB2.230407.019-2023-05-30-14-33-48.txt',
    );
    return new TraceFile(file, bugreportArchive);
  }

  async function makeZippedTraceFile(): Promise<TraceFile> {
    const file = await getFixtureFile(
      'archives/winscope.zip',
      'FS/data/misc/wmtrace/winscope.zip',
    );
    return new TraceFile(file, bugreportArchive);
  }

  async function makeMetadataJsonFile(): Promise<TraceFile> {
    const file = await getFixtureFile(
      'traces/elapsed_and_real_timestamp/screen_recording_metadata.json',
    );
    return new TraceFile(file, bugreportArchive);
  }

  async function tryIdentifyNonPerfetto(
    files: TraceFile[],
  ): Promise<ProcessedFiles<FileReader>> {
    return {
      supportedFiles: files.map((f) => {
        return new TestFileReaderBuilder()
          .setTraceFile(f)
          .setTimestamps([])
          .build();
      }),
      unsupportedFiles: [],
    };
  }

  async function tryIdentifyLegacy(
    files: TraceFile[],
  ): Promise<ProcessedFiles<LegacyFileReader>> {
    return {
      supportedFiles: files.map((f) => {
        return new TestLegacyFileReaderBuilder()
          .setTraceFile(f)
          .setTimestamps([])
          .build();
      }),
      unsupportedFiles: [],
    };
  }

  async function tryIdentifyPerfetto(
    file: TraceFile,
    perfettoFiles: TraceFile[],
  ): Promise<FileReader[]> {
    if (perfettoFiles.includes(file)) {
      return [
        new TestFileReaderBuilder()
          .setTraceFile(file)
          .setTimestamps([])
          .build(),
      ];
    } else {
      return [];
    }
  }
});

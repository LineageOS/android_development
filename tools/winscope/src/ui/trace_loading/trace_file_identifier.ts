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

import {assertDefined} from '@common/assert';
import {getFileDirectory, isZipFile, unzipFile} from '@common/io';
import {utf8Decode} from '@common/string_helpers';
import {TimezoneInfo} from '@common/time/time';
import {getLogger, Logger} from '@compat/logging';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {ProcessedFiles} from '@legacy_file_readers/common/processed_files';
import {Analytics} from '@logging/analytics';
import {UserWarning} from '@messaging/user_warning';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent, WinscopeEventEmitter,} from '@messaging/winscope_event_emitter';
import {WinscopeEventListener} from '@messaging/winscope_event_listener';
import {UserNotifier} from '@services/user_notifier';
import {FileReader} from '@trace_api/file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceMetadata} from '@trace_api/trace_metadata';
import {BugreportFileSelected, BugreportFileSelectionRequest,} from '@ui/shared/events/misc_events';

import {BugreportData, BuildType} from './bugreport_data';
import {makeWarningMissingPersistentTrace, makeWarningNoValidFiles, makeWarningTraceOverridden, makeWarningUnsupportedFileFormat,} from './warnings';

/**
 * The result of filtering and identifying a set of files.
 */
export interface IdentifiedFiles<T extends FileReader> {
  legacy: LegacyFileReader[];
  nonPerfetto: T[];
  perfetto: T[];
  criticalWarnings: UserWarning[];
}

interface FilterResult {
  criticalWarnings: UserWarning[];
  legacy: TraceFile[];
  perfetto: TraceFile[];
  timezoneInfo?: TimezoneInfo;
}

type IdentifyPerfettoFileStrategy<T> = (file: TraceFile) => Promise<T[]>;

/**
 * A strategy for identifying legacy files and returning the relevant file readers.
 */
export type IdentifyLegacyFilesStrategy = (
  files: TraceFile[],
  timezoneInfo?: TimezoneInfo,
) => Promise<ProcessedFiles<LegacyFileReader>>;

/**
 * A strategy for identifying non-perfetto i.e. non legacy-convertible files and
 * returning the relevant parsers.
 */
export type IdentifyNonPerfettoFilesStrategy<T extends FileReader> = (
  files: TraceFile[],
  metadata: TraceMetadata,
) => Promise<ProcessedFiles<T>>;

/**
 * An identifier for trace files.
 *
 * The identifier is responsible for:
 * - filtering received files
 * - identifying the type of each file
 * - if applicable, extracting metadata from it
 * - returning corresponding file readers/parsers for identified files
 */
export class TraceFileIdentifier<T extends FileReader>
  implements WinscopeEventListener, WinscopeEventEmitter
{
  private static readonly BUGREPORT_PERFETTO_TRACE_DIR =
    'FS/data/misc/perfetto-traces/bugreport';
  private static readonly BUGREPORT_PERFETTO_TRACE_ORDER = [
    TraceFileIdentifier.BUGREPORT_PERFETTO_TRACE_DIR + '/systrace.pftrace',
    TraceFileIdentifier.BUGREPORT_PERFETTO_TRACE_DIR + '/sysui.pftrace',
  ];
  private static readonly BUGREPORT_LEGACY_FILES_ALLOWLIST = [
    'FS/data/misc/wmtrace/',
    'FS/data/misc/perfetto-traces/',
    'proto/window_CRITICAL.proto',
    'proto/input_method_CRITICAL.proto',
    'proto/SurfaceFlinger_CRITICAL.proto',
  ];
  private static readonly PERFETTO_EXTENSIONS = [
    '.pftrace',
    '.perfetto-trace',
    '.perfetto',
  ];
  private static readonly PERSISTENT_TRACING_PROPERTY =
    'persist.debug.perfetto.persistent_sysui_tracing_for_bugreport';

  private emitEvent: EmitEvent = () => Promise.resolve();
  private selectedFile: string | undefined;

  constructor(
    private readonly logger: Logger = getLogger('TraceFileIdentifier'),
  ) {}

  setEmitEvent(callback: EmitEvent) {
    this.emitEvent = callback;
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    if (event instanceof BugreportFileSelected) {
      this.onBugreportFileSelected(event as BugreportFileSelected);
    }
  }

  async identifyFiles(
    files: TraceFile[],
    tryIdentifyLegacy: IdentifyLegacyFilesStrategy,
    tryIdentifyNonPerfetto: IdentifyNonPerfettoFilesStrategy<T>,
    tryIdentifyPerfetto: IdentifyPerfettoFileStrategy<T>,
  ): Promise<IdentifiedFiles<T>> {
    const startTimeMs = Date.now();

    const {result, metadata, isBugreport} = await this.filter(files);

    const size = result.legacy
      .concat(result.perfetto)
      .reduce((totalSize, f) => (totalSize += f.file.size), 0);

    if (isBugreport) {
      Analytics.Loading.logFileExtractionTime(
        'bugreport',
        Date.now() - startTimeMs,
        size,
      );
    }

    if (result.perfetto.length === 0 && result.legacy.length === 0) {
      UserNotifier.add(makeWarningNoValidFiles());
      return {
        criticalWarnings: result.criticalWarnings,
        perfetto: [],
        legacy: [],
        nonPerfetto: [],
      };
    }

    let {supportedFiles: legacyFileReaders, unsupportedFiles} =
      await tryIdentifyLegacy(result.legacy, result.timezoneInfo);

    let nonPerfettoParsers: T[] = [];
    if (unsupportedFiles.length > 0) {
      const {supportedFiles, unsupportedFiles: stillUnsupported} =
        await tryIdentifyNonPerfetto(unsupportedFiles, metadata);
      nonPerfettoParsers = supportedFiles;
      unsupportedFiles = stillUnsupported;
    }

    let perfettoParsers: T[] = [];
    const largestPerfettoFile = this.pickLargestFile(result.perfetto);
    if (largestPerfettoFile) {
      perfettoParsers = await tryIdentifyPerfetto(largestPerfettoFile);
      unsupportedFiles.forEach((file: TraceFile) => {
        UserNotifier.add(
          makeWarningUnsupportedFileFormat(file.getDescriptor()),
        );
      });
    } else {
      unsupportedFiles.sort(
        (a: TraceFile, b: TraceFile) => b.file.size - a.file.size,
      );
      for (const file of unsupportedFiles) {
        perfettoParsers = await tryIdentifyPerfetto(file);
        if (perfettoParsers) {
          break;
        }
      }
    }

    return {
      criticalWarnings: result.criticalWarnings,
      legacy: legacyFileReaders,
      nonPerfetto: nonPerfettoParsers,
      perfetto: perfettoParsers,
    };
  }

  private async filter(files: TraceFile[]): Promise<{
    result: FilterResult;
    metadata: TraceMetadata;
    isBugreport: boolean;
  }> {
    const bugreportMainEntry = files.find((file) =>
      file.file.name.endsWith('main_entry.txt'),
    );

    const perfettoFiles = files.filter((file) => this.isPerfettoFile(file));
    const {mFiles, metadata} = await this.extractAndAnalyzeMetadata(files);
    const legacyFiles = files.filter(
      (file) => !this.isPerfettoFile(file) && !mFiles.includes(file),
    );

    const isBugReportArchive = await this.isBugreport(
      bugreportMainEntry,
      files,
    );

    if (!isBugReportArchive) {
      const result: FilterResult = {
        perfetto: perfettoFiles,
        legacy: legacyFiles,
        criticalWarnings: [],
      };
      return {result, metadata, isBugreport: false};
    }

    const bugreportData = await this.getBugreportData(
      assertDefined(bugreportMainEntry),
      files,
    );

    const result = await this.filterBugreport(
      assertDefined(bugreportMainEntry),
      perfettoFiles,
      legacyFiles,
      bugreportData,
    );
    return {result, metadata, isBugreport: true};
  }

  private async getBugreportData(
    bugreportMainEntry: TraceFile,
    files: TraceFile[],
  ): Promise<BugreportData | undefined> {
    const bugreportName = (await bugreportMainEntry.file.text()).trim();
    const mainBugreportFile = files.find(
      (file) => file.file.name === bugreportName,
    );
    if (!mainBugreportFile) {
      return undefined;
    }

    const traceBuffer = new Uint8Array(
      await mainBugreportFile.file.arrayBuffer(),
    );
    const fileData = utf8Decode(traceBuffer);

    const timezone = this.extractBugreportProperty(
      fileData,
      'persist.sys.timezone',
    );
    const timezoneInfo = timezone ? {timezone, locale: 'en-US'} : undefined;
    const buildTypeString = this.extractBugreportProperty(
      fileData,
      'ro.build.type',
    );
    const persistentTracingFlag = this.extractBugreportProperty(
      fileData,
      TraceFileIdentifier.PERSISTENT_TRACING_PROPERTY,
    );
    const isPersistentTracingEnabled = persistentTracingFlag === '1';

    return {
      timezoneInfo,
      buildType: this.parseBuildType(buildTypeString),
      isPersistentTracingEnabled,
    };
  }

  private parseBuildType(
    buildTypeString: string | undefined,
  ): BuildType | undefined {
    if (!buildTypeString) {
      return undefined;
    }
    const lowerCaseBuildType = buildTypeString.toLowerCase();
    if (Object.values(BuildType).includes(lowerCaseBuildType as BuildType)) {
      return lowerCaseBuildType as BuildType;
    }
    this.logger.warn(
      `Unknown build type found in bugreport: ${buildTypeString}`,
    );
    return undefined;
  }

  private extractBugreportProperty(
    fileData: string,
    propertyKey: string,
  ): string | undefined {
    const keyWithBrackets = `[${propertyKey}]`;
    const startIndex = fileData.indexOf(keyWithBrackets);
    if (startIndex === -1) {
      return undefined;
    }
    return this.extractValueFromRawBugReport(fileData, startIndex);
  }

  private extractValueFromRawBugReport(
    fileData: string,
    startIndex: number,
  ): string {
    return fileData
      .slice(startIndex)
      .split(']', 2)
      .map((substr) => {
        const start = substr.lastIndexOf('[');
        return substr.slice(start + 1);
      })[1];
  }

  private async isBugreport(
    bugreportMainEntry: TraceFile | undefined,
    files: TraceFile[],
  ): Promise<boolean> {
    if (!bugreportMainEntry) {
      return false;
    }
    const bugreportName = (await bugreportMainEntry.file.text()).trim();
    return files.some((file) => {
      return (
        file.parentArchive === bugreportMainEntry.parentArchive &&
        file.file.name === bugreportName
      );
    });
  }

  private async filterBugreport(
    bugreportMainEntry: TraceFile,
    perfettoFiles: TraceFile[],
    legacyFiles: TraceFile[],
    bugreportData?: BugreportData,
  ): Promise<FilterResult> {
    const isFileAllowlisted = (file: TraceFile) => {
      for (const traceDir of TraceFileIdentifier.BUGREPORT_LEGACY_FILES_ALLOWLIST) {
        if (file.file.name.startsWith(traceDir)) {
          return true;
        }
      }
      return false;
    };

    const fileBelongsToBugreport = (file: TraceFile) =>
      file.parentArchive === bugreportMainEntry.parentArchive;

    legacyFiles = legacyFiles.filter((file) => {
      return isFileAllowlisted(file) || !fileBelongsToBugreport(file);
    });

    const unzippedLegacyFiles: TraceFile[] = [];

    for (const file of legacyFiles) {
      if (await isZipFile(file.file)) {
        try {
          const subFiles = await unzipFile(file.file);
          const subTraceFiles = subFiles.map((subFile: File) => {
            return new TraceFile(subFile, file.file);
          });
          unzippedLegacyFiles.push(...subTraceFiles);
        } catch {
          unzippedLegacyFiles.push(file);
        }
      } else {
        unzippedLegacyFiles.push(file);
      }
    }
    const brPerfettoFiles = perfettoFiles.filter(
      (file) =>
        getFileDirectory(file.file.name) ===
        TraceFileIdentifier.BUGREPORT_PERFETTO_TRACE_DIR,
    );

    const getIndex = (fileName: string) => {
      return TraceFileIdentifier.BUGREPORT_PERFETTO_TRACE_ORDER.findIndex(
        (name) => name === fileName,
      );
    };
    let perfettoFile = brPerfettoFiles
      .filter((file) =>
        TraceFileIdentifier.BUGREPORT_PERFETTO_TRACE_ORDER.includes(
          file.file.name,
        ),
      )
      .sort((f1, f2) => getIndex(f1.file.name) - getIndex(f2.file.name))
      .at(0);

    if (!perfettoFile && brPerfettoFiles.length === 1) {
      perfettoFile = brPerfettoFiles[0];
    }

    if (!perfettoFile && brPerfettoFiles.length > 1) {
      // emitEvent must be set to propagate event to mediator, which routes file selection
      // request to AppComponent. User is prompted by dialog to select which file to
      // process. Once dialog is closed, selected file is sent back to TraceFileIdentifier
      // via BugreportFileSelected event and handled above in onWinscopeEvent where
      // it is stored in selectedFile. Promise below only resolves after BugreportFileSelected
      // event has been handled.
      await this.emitEvent(
        new BugreportFileSelectionRequest(
          brPerfettoFiles.map((file) => file.file.name),
        ),
      );
      if (this.selectedFile) {
        perfettoFile = brPerfettoFiles.find(
          (file) => file.file.name === this.selectedFile,
        );
        this.selectedFile = undefined;
      }
    }

    const criticalWarnings: UserWarning[] = [];
    if (!perfettoFile && bugreportData) {
      criticalWarnings.push(
        makeWarningMissingPersistentTrace(
          bugreportData,
          TraceFileIdentifier.PERSISTENT_TRACING_PROPERTY,
        ),
      );
    }

    return {
      criticalWarnings,
      perfetto: perfettoFile ? [perfettoFile] : [],
      legacy: unzippedLegacyFiles,
      timezoneInfo: bugreportData?.timezoneInfo,
    };
  }

  private isPerfettoFile(file: TraceFile): boolean {
    return TraceFileIdentifier.PERFETTO_EXTENSIONS.some((perfettoExt) => {
      return (
        file.file.name.endsWith(perfettoExt) ||
        file.file.name.endsWith(`${perfettoExt}.gz`)
      );
    });
  }

  private async extractAndAnalyzeMetadata(
    files: TraceFile[],
  ): Promise<{mFiles: TraceFile[]; metadata: TraceMetadata}> {
    const mFiles = [];
    const metadata: TraceMetadata = {};
    for (const file of files) {
      const buffer = new Uint8Array(await file.file.arrayBuffer());
      const text = utf8Decode(buffer);
      try {
        const data = JSON.parse(text);
        if (
          data.realToElapsedTimeOffsetNanos !== undefined &&
          data.elapsedRealTimeNanos !== undefined
        ) {
          metadata.screenRecordingOffsets = {
            realToElapsedTimeOffsetNanos: BigInt(
              data.realToElapsedTimeOffsetNanos,
            ),
            elapsedRealTimeNanos: BigInt(data.elapsedRealTimeNanos),
          };
          mFiles.push(file);
          break;
        }
      } catch {
        // swallow - looking for metadata json
      }
    }
    return {metadata, mFiles};
  }

  private pickLargestFile(files: TraceFile[]): TraceFile | undefined {
    if (files.length === 0) {
      return undefined;
    }
    return files.reduce((largestSoFar, file) => {
      const [largest, overridden] =
        largestSoFar.file.size > file.file.size
          ? [largestSoFar, file]
          : [file, largestSoFar];
      UserNotifier.add(makeWarningTraceOverridden(overridden.getDescriptor()));
      return largest;
    });
  }

  private async onBugreportFileSelected(event: BugreportFileSelected) {
    this.selectedFile = event.filename;
  }
}

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

import {assertDefined} from 'common/assert';
import {getFileDirectory, isZipFile, unzipFile} from 'common/io';
import {utf8Decode} from 'common/string_helpers';
import {TimezoneInfo} from 'common/time/time';
import {Analytics} from 'logging/analytics';
import {UserWarning} from 'messaging/user_warning';
import {
  MissingPersistentTrace,
  NoValidFiles,
  TraceOverridden,
  UnsupportedFileFormat,
} from 'messaging/user_warnings';
import {
  BugreportFileSelectionRequest,
  WinscopeEvent,
  WinscopeEventType,
} from 'messaging/winscope_event';
import {
  EmitEvent,
  WinscopeEventEmitter,
} from 'messaging/winscope_event_emitter';
import {WinscopeEventListener} from 'messaging/winscope_event_listener';
import {FileAndParser} from 'parsers/file_and_parser';
import {FileAndParsers} from 'parsers/file_and_parsers';
import {ProcessedFiles} from 'parsers/legacy/parser_factory';
import {UserNotifier} from 'services/user_notifier';
import {TraceFile} from 'trace/trace_file';
import {TraceMetadata} from 'trace_api/trace_metadata';

/**
 * The build type of the Android device that generated the bugreport.
 */
export enum BuildType {
  /**
   * A user build of the Android device.
   */
  USER = 'user',

  /**
   * A userdebug build of the Android device.
   */
  USERDEBUG = 'userdebug',

  /**
   * An eng build of the Android device.
   */
  ENG = 'eng',
}

/**
 * Metadata extracted from a bugreport.
 */
export interface BugreportData {
  timezoneInfo?: TimezoneInfo;
  buildType?: BuildType;
  isPersistentTracingEnabled: boolean;
}

/**
 * The result of parsing a set of files.
 */
export interface ParsedFiles {
  legacy: FileAndParser[];
  perfetto: FileAndParsers | undefined;
  criticalWarnings?: UserWarning[];
}

interface FilterResult {
  legacy: TraceFile[];
  metadata: TraceMetadata;
  perfetto: TraceFile[];
  timezoneInfo?: TimezoneInfo;
  criticalWarnings?: UserWarning[];
}

type ParsePerfettoFileStrategy = (
  file: TraceFile,
) => Promise<FileAndParsers | undefined>;

/**
 * A strategy for parsing legacy files.
 */
export type ParseLegacyFilesStrategy = (
  files: TraceFile[],
  metadata: TraceMetadata,
  timezoneInfo?: TimezoneInfo,
) => Promise<ProcessedFiles>;

/**
 * A filter for trace files.
 *
 * The filter identifies the type of each file and, if applicable, extracts metadata from it.
 * The filter is also responsible for parsing the files and returning the corresponding parsers.
 */
export class TraceFileFilter
  implements WinscopeEventListener, WinscopeEventEmitter
{
  private static readonly BUGREPORT_PERFETTO_TRACE_DIR =
    'FS/data/misc/perfetto-traces/bugreport';
  private static readonly BUGREPORT_PERFETTO_TRACE_ORDER = [
    TraceFileFilter.BUGREPORT_PERFETTO_TRACE_DIR + '/systrace.pftrace',
    TraceFileFilter.BUGREPORT_PERFETTO_TRACE_DIR + '/sysui.pftrace',
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

  private emitEvent: EmitEvent = () => Promise.resolve();
  private selectedFile: string | undefined;

  setEmitEvent(callback: EmitEvent) {
    this.emitEvent = callback;
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    await event.visit(
      WinscopeEventType.BUGREPORT_FILE_SELECTED,
      async (event) => {
        this.selectedFile = event.filename;
      },
    );
  }

  async filterAndParse(
    files: TraceFile[],
    tryParseLegacy: ParseLegacyFilesStrategy,
    tryParsePerfetto: ParsePerfettoFileStrategy,
  ): Promise<ParsedFiles> {
    const startTimeMs = Date.now();

    const {result, isBugreport} = await this.filterWithoutParsing(files);

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
      UserNotifier.add(new NoValidFiles());
      return {
        perfetto: undefined,
        legacy: [],
        criticalWarnings: result.criticalWarnings,
      };
    }

    const {parsers: legacyParsers, unsupportedFiles} = await tryParseLegacy(
      result.legacy,
      result.metadata,
      result.timezoneInfo,
    );

    let perfettoParsers: FileAndParsers | undefined;

    const largestPerfettoFile = this.pickLargestFile(result.perfetto);

    if (largestPerfettoFile) {
      perfettoParsers = await tryParsePerfetto(largestPerfettoFile);
      unsupportedFiles.forEach((file) => {
        UserNotifier.add(new UnsupportedFileFormat(file.getDescriptor()));
      });
    } else {
      unsupportedFiles.sort((a, b) => b.file.size - a.file.size);
      for (const file of unsupportedFiles) {
        perfettoParsers = await tryParsePerfetto(file);
        if (perfettoParsers) {
          break;
        }
      }
    }

    return {
      legacy: legacyParsers,
      perfetto: perfettoParsers,
      criticalWarnings: result.criticalWarnings,
    };
  }

  private async filterWithoutParsing(
    files: TraceFile[],
  ): Promise<{result: FilterResult; isBugreport: boolean}> {
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
      const result = {
        perfetto: perfettoFiles,
        legacy: legacyFiles,
        metadata,
      };
      return {result, isBugreport: false};
    }

    const bugreportData = await this.getBugreportData(
      assertDefined(bugreportMainEntry),
      files,
    );

    const result = await this.filterBugreport(
      assertDefined(bugreportMainEntry),
      perfettoFiles,
      legacyFiles,
      metadata,
      bugreportData,
    );
    return {result, isBugreport: true};
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
      'persist.debug.perfetto.persistent_sysui_tracing_for_bugreport',
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
    console.warn(`Unknown build type found in bugreport: ${buildTypeString}`);
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
    metadata: TraceMetadata,
    bugreportData?: BugreportData,
  ): Promise<FilterResult> {
    const isFileAllowlisted = (file: TraceFile) => {
      for (const traceDir of TraceFileFilter.BUGREPORT_LEGACY_FILES_ALLOWLIST) {
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
          const subTraceFiles = subFiles.map((subFile) => {
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
        TraceFileFilter.BUGREPORT_PERFETTO_TRACE_DIR,
    );

    const getIndex = (fileName: string) => {
      return TraceFileFilter.BUGREPORT_PERFETTO_TRACE_ORDER.findIndex(
        (name) => name === fileName,
      );
    };
    let perfettoFile = brPerfettoFiles
      .filter((file) =>
        TraceFileFilter.BUGREPORT_PERFETTO_TRACE_ORDER.includes(file.file.name),
      )
      .sort((f1, f2) => getIndex(f1.file.name) - getIndex(f2.file.name))
      .at(0);

    if (!perfettoFile && brPerfettoFiles.length === 1) {
      perfettoFile = brPerfettoFiles[0];
    }

    if (!perfettoFile && brPerfettoFiles.length > 1) {
      // emitEvent must be set to propagate event to mediator, which routes file selection
      // request to AppComponent. User is prompted by dialog to select which file to
      // process. Once dialog is closed, selected file is sent back to TraceFileFilter
      // via BugreportFileSelected event and handled above in onWinscopeEvent, where
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
      criticalWarnings.push(new MissingPersistentTrace(bugreportData));
    }

    return {
      perfetto: perfettoFile ? [perfettoFile] : [],
      legacy: unzippedLegacyFiles,
      metadata,
      timezoneInfo: bugreportData?.timezoneInfo,
      criticalWarnings,
    };
  }

  private isPerfettoFile(file: TraceFile): boolean {
    return TraceFileFilter.PERFETTO_EXTENSIONS.some((perfettoExt) => {
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
      UserNotifier.add(new TraceOverridden(overridden.getDescriptor()));
      return largest;
    });
  }
}

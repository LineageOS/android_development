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
import {createZipArchive, getFileExtension, OnProgressUpdateType, removeDirFromFileName, removeExtensionFromFilename,} from '@common/io';
import {INVALID_TIME_NS, TimeRange, Timestamp} from '@common/time/time';
import {TIME_UNIT_TO_NANO} from '@common/time/time_units';
import {getReaderWithLatestRealToBootTimeOffset, getReaderWithLatestRealToMonotonicTimeOffset,} from '@legacy_file_readers/common/file_reader_helpers';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {UserNotifier} from '@services/user_notifier';
import {FileReader} from '@trace_api/file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';

import {makeWarningTraceHasElapsedTimestamps, makeWarningTraceHasOldData, makeWarningTraceOverridden,} from './warnings';

/**
 * A collection of file readers loaded from user-provided files.
 *
 * The collection can be updated with new files. When this happens, the
 * collection tries to filter out files with old data that would produce
 * a confusing visualization.
 */
export class LoadedFiles<T extends FileReader> {
  static readonly MAX_ALLOWED_TIME_GAP_BETWEEN_TRACES_NS =
    5n * TIME_UNIT_TO_NANO.m; // 5m
  static readonly MAX_ALLOWED_TIME_GAP_BETWEEN_RTE_OFFSET =
    5n * TIME_UNIT_TO_NANO.s; // 5s
  static readonly REAL_TIME_TRACES_WITHOUT_RTE_OFFSET = [TraceType.CUJS];

  private legacyReaders = new Array<LegacyFileReader>();
  private nonPerfettoReaders = new Array<T>();
  private perfettoReaders = new Array<T>();

  addFiles(
    legacyFileReaders: LegacyFileReader[],
    nonPerfettoFileReaders: T[],
    perfettoFileReaders: T[],
    clearExistingPerfetto = true,
  ) {
    if (perfettoFileReaders.length > 0) {
      this.addPerfettoFileReaders(perfettoFileReaders, clearExistingPerfetto);
    }
    const nonPerfettoReaders: FileReader[] = [
      ...legacyFileReaders,
      ...nonPerfettoFileReaders,
    ];
    this.checkIfMixedTimestampType(nonPerfettoReaders, perfettoFileReaders);

    // Traces were simultaneously upgraded to contain real-to-boottime
    // or real-to-monotonic offsets. If we have a mix of readers with
    // and without offsets, the ones without must be dangling trace files
    // with old data, and should be filtered out.
    let {newLegacyReaders, newNonPerfettoReaders} =
      this.filterOutReadersWithOldData(
        legacyFileReaders,
        nonPerfettoFileReaders,
      );
    newNonPerfettoReaders = this.filterScreenshotReadersIfRequired(
      newNonPerfettoReaders,
    );
    this.addLegacyReaders(newLegacyReaders);
    this.addNonPerfettoReaders(newNonPerfettoReaders);
  }

  getLegacyFileReaders(): LegacyFileReader[] {
    return this.legacyReaders;
  }

  getNonPerfettoFileReaders(): T[] {
    return this.nonPerfettoReaders;
  }

  getPerfettoFileReaders(): T[] {
    return this.perfettoReaders;
  }

  getPerfettoFile(): TraceFile | undefined {
    return this.perfettoReaders.at(0)?.getFiles()[0];
  }

  remove(reader: FileReader) {
    const predicate = (r: FileReader) => {
      return r !== reader;
    };
    this.removeWithPredicate(predicate);
  }

  async makeZipArchive(onProgressUpdate?: OnProgressUpdateType): Promise<Blob> {
    const outputFilesSoFar = new Set<File>();
    const outputFilenameToFiles = new Map<string, File[]>();

    if (onProgressUpdate) onProgressUpdate(0);
    const totalReaders =
      this.perfettoReaders.length +
      this.legacyReaders.length +
      this.nonPerfettoReaders.length;
    let progress = 0;

    const tryPushOutputFile = (file: File, filename: string) => {
      // Remove duplicates because some readers (e.g. view capture) could share the same file
      if (outputFilesSoFar.has(file)) {
        return;
      }
      outputFilesSoFar.add(file);

      if (outputFilenameToFiles.get(filename) === undefined) {
        outputFilenameToFiles.set(filename, []);
      }
      assertDefined(outputFilenameToFiles.get(filename)).push(file);
    };

    const makeArchiveFile = (
      filename: string,
      file: File,
      clashCount: number,
    ): File => {
      if (clashCount === 0) {
        return new File([file], filename);
      }

      const filenameWithoutExt = removeExtensionFromFilename(filename);
      const extension = getFileExtension(filename);

      if (extension === undefined) {
        return new File([file], `${filename} (${clashCount})`);
      }

      return new File(
        [file],
        `${filenameWithoutExt} (${clashCount}).${extension}`,
      );
    };

    if (this.perfettoReaders.length > 0) {
      const file = this.perfettoReaders[0].getFiles()[0].file;
      let outputFilename = removeDirFromFileName(file.name);
      if (getFileExtension(file.name) === undefined) {
        outputFilename += '.perfetto-trace';
      }
      tryPushOutputFile(file, outputFilename);
    }

    if (onProgressUpdate) {
      progress = this.perfettoReaders.length;
      onProgressUpdate((0.5 * progress) / totalReaders);
    }

    const tryPushOutputLegacyFile = (reader: FileReader) => {
      const traceFiles = reader.getFiles();
      const traceType = reader.getTraceType();
      const archiveDir =
        TRACE_INFO[traceType].downloadArchiveDir.length > 0
          ? TRACE_INFO[traceType].downloadArchiveDir + '/'
          : '';
      traceFiles.forEach((traceFile) => {
        let outputFilename =
          archiveDir + removeDirFromFileName(traceFile.file.name);
        if (getFileExtension(traceFile.file.name) === undefined) {
          outputFilename += TRACE_INFO[traceType].legacyExt;
        }
        tryPushOutputFile(traceFile.file, outputFilename);
      });
      if (onProgressUpdate) {
        progress++;
        onProgressUpdate((0.5 * progress) / totalReaders);
      }
    };

    this.legacyReaders.forEach(tryPushOutputLegacyFile);
    this.nonPerfettoReaders.forEach(tryPushOutputLegacyFile);

    const archiveFiles = [...outputFilenameToFiles.entries()]
      .map(([filename, files]) => {
        return files.map((file, clashCount) =>
          makeArchiveFile(filename, file, clashCount),
        );
      })
      .flat();

    return await createZipArchive(
      archiveFiles,
      onProgressUpdate
        ? (perc: number) => onProgressUpdate(0.5 * (1 + perc))
        : undefined,
    );
  }

  private addLegacyReaders(readers: LegacyFileReader[]) {
    readers.forEach((reader) => {
      if (this.shouldUseLegacyReader(reader)) {
        this.legacyReaders.push(reader);
      }
    });
  }

  private addNonPerfettoReaders(readers: T[]) {
    readers.forEach((reader) => {
      if (this.shouldUseLegacyReader(reader)) {
        this.nonPerfettoReaders.push(reader);
      }
    });
  }

  private addPerfettoFileReaders(readers: T[], clearExistingPerfetto: boolean) {
    if (clearExistingPerfetto) {
      // We currently run only one Perfetto TP WebWorker at a time, so Perfetto readers previously
      // loaded are now invalid and must be removed (previous WebWorker is not running anymore).
      this.perfettoReaders = [];
    }

    readers.forEach((perfettoReader) => {
      this.perfettoReaders.push(perfettoReader);

      // While transitioning to the Perfetto format, devices might still have old
      // legacy trace files dangling in the disk that get automatically included
      // into bugreports. Hence, Perfetto readers must always override legacy ones
      // so that dangling legacy files are ignored.
      this.legacyReaders = this.legacyReaders.filter((legacyReader) => {
        return legacyReader.getTraceType() !== perfettoReader.getTraceType();
      });
      this.nonPerfettoReaders = this.nonPerfettoReaders.filter(
        (nonPerfettoReader) => {
          return (
            nonPerfettoReader.getTraceType() !== perfettoReader.getTraceType()
          );
        },
      );
    });
  }

  private shouldUseLegacyReader(newReader: FileReader): boolean {
    // While transitioning to the Perfetto format, devices might still have old
    // legacy trace files dangling in the disk that get automatically included
    // into bugreports. Hence, Perfetto readers must always override legacy ones
    // so that dangling legacy files are ignored.
    return !this.perfettoReaders.some(
      (reader) => reader.getTraceType() === newReader.getTraceType(),
    );
  }

  private filterOutReadersWithOldData<T extends FileReader>(
    newLegacyReaders: LegacyFileReader[],
    newNonPerfettoReaders: T[],
  ): {
    newLegacyReaders: LegacyFileReader[];
    newNonPerfettoReaders: T[];
  } {
    let allReaders = [
      ...newLegacyReaders,
      ...newNonPerfettoReaders,
      ...this.legacyReaders,
      ...this.nonPerfettoReaders,
      ...this.perfettoReaders,
    ];

    const latestMonotonicOffset =
      getReaderWithLatestRealToMonotonicTimeOffset(
        allReaders,
      )?.getRealToMonotonicTimeOffsetNs();
    const latestBootTimeOffset =
      getReaderWithLatestRealToBootTimeOffset(
        allReaders,
      )?.getRealToBootTimeOffsetNs();

    const predicate = (reader: FileReader) => {
      const monotonicOffset = reader.getRealToMonotonicTimeOffsetNs();
      if (monotonicOffset && latestMonotonicOffset) {
        const isOldData =
          Math.abs(Number(monotonicOffset - latestMonotonicOffset)) >
          LoadedFiles.MAX_ALLOWED_TIME_GAP_BETWEEN_RTE_OFFSET;
        if (isOldData) {
          UserNotifier.add(makeWarningTraceHasOldData(reader.getDescriptors()));
          return false;
        }
      }

      const bootTimeOffset = reader.getRealToBootTimeOffsetNs();
      if (bootTimeOffset && latestBootTimeOffset) {
        const isOldData =
          Math.abs(Number(bootTimeOffset - latestBootTimeOffset)) >
          LoadedFiles.MAX_ALLOWED_TIME_GAP_BETWEEN_RTE_OFFSET;
        if (isOldData) {
          UserNotifier.add(makeWarningTraceHasOldData(reader.getDescriptors()));
          return false;
        }
      }

      return true;
    };

    newLegacyReaders = newLegacyReaders.filter(predicate);
    newNonPerfettoReaders = newNonPerfettoReaders.filter(predicate);

    allReaders = [
      ...newLegacyReaders,
      ...newNonPerfettoReaders,
      ...this.legacyReaders,
      ...this.nonPerfettoReaders,
      ...this.perfettoReaders,
    ];

    const timeRanges = allReaders
      .map((reader) => {
        const timestamps = reader.getTimestamps();
        if (timestamps.length === 0) {
          return undefined;
        }
        return new TimeRange(
          this.getSmallestNonZeroTimestamp(timestamps),
          this.getLargestNonZeroTimestamp(timestamps),
        );
      })
      .filter((range) => range !== undefined);

    const timeGap = this.findLastTimeGapAboveThreshold(timeRanges);
    if (!timeGap) {
      return {newLegacyReaders, newNonPerfettoReaders};
    }

    const hasOldData = (reader: FileReader) => {
      const timestamps = reader.getTimestamps();
      if (!this.hasValidTimestamps(timestamps)) {
        return true;
      }
      const endTimestamp = this.getLargestNonZeroTimestamp(timestamps);
      const isOldData = endTimestamp.getValueNs() <= timeGap.startNs;
      if (isOldData) {
        UserNotifier.add(
          makeWarningTraceHasOldData(reader.getDescriptors(), timeGap),
        );
        return false;
      }

      return true;
    };

    newLegacyReaders = newLegacyReaders.filter((reader) => {
      // Only Shell Transition data used to set timestamps of merged Transition trace,
      // so WM Transition data should not be considered by "old data" policy
      if (reader.getTraceType() === TraceType.WM_TRANSITION) {
        return true;
      }
      return hasOldData(reader);
    });
    newNonPerfettoReaders = newNonPerfettoReaders.filter(hasOldData);
    return {newLegacyReaders, newNonPerfettoReaders};
  }

  private filterScreenshotReadersIfRequired(newNonPerfettoReaders: T[]): T[] {
    const hasOldScreenRecordingReaders = this.nonPerfettoReaders.some(
      (reader) => reader.getTraceType() === TraceType.SCREEN_RECORDING,
    );
    const hasNewScreenRecordingReaders = newNonPerfettoReaders.some(
      (reader) => reader.getTraceType() === TraceType.SCREEN_RECORDING,
    );
    const hasScreenRecordingReaders =
      hasOldScreenRecordingReaders || hasNewScreenRecordingReaders;

    if (!hasScreenRecordingReaders) {
      return newNonPerfettoReaders;
    }

    const oldScreenshotReaders = this.nonPerfettoReaders.filter(
      (reader) => reader.getTraceType() === TraceType.SCREENSHOT,
    );
    const newScreenshotReaders = newNonPerfettoReaders.filter(
      (reader) => reader.getTraceType() === TraceType.SCREENSHOT,
    );

    oldScreenshotReaders.forEach((reader) => {
      UserNotifier.add(
        makeWarningTraceOverridden(
          reader.getDescriptors().join(),
          TraceType.SCREEN_RECORDING,
        ),
      );
      this.remove(reader);
    });

    newScreenshotReaders.forEach((reader) => {
      UserNotifier.add(
        makeWarningTraceOverridden(
          reader.getDescriptors().join(),
          TraceType.SCREEN_RECORDING,
        ),
      );
    });

    return newNonPerfettoReaders.filter(
      (reader) => reader.getTraceType() !== TraceType.SCREENSHOT,
    );
  }

  private checkIfMixedTimestampType(
    newNonPerfettoReaders: FileReader[],
    perfettoReaders: FileReader[],
  ): void {
    const hasReaderWithOffset =
      perfettoReaders.length > 0 ||
      newNonPerfettoReaders.some((reader) => {
        return (
          reader.getRealToBootTimeOffsetNs() !== undefined ||
          reader.getRealToMonotonicTimeOffsetNs() !== undefined
        );
      });
    const hasReaderWithoutOffset = newNonPerfettoReaders.some((reader) => {
      const timestamps = reader.getTimestamps();
      return (
        this.hasValidTimestamps(timestamps) &&
        reader.getRealToBootTimeOffsetNs() === undefined &&
        reader.getRealToMonotonicTimeOffsetNs() === undefined
      );
    });

    if (hasReaderWithOffset && hasReaderWithoutOffset) {
      newNonPerfettoReaders.forEach((reader) => {
        if (
          LoadedFiles.REAL_TIME_TRACES_WITHOUT_RTE_OFFSET.some(
            (traceType) => reader.getTraceType() === traceType,
          )
        ) {
          return;
        }
        const hasOffset =
          reader.getRealToMonotonicTimeOffsetNs() !== undefined ||
          reader.getRealToBootTimeOffsetNs() !== undefined;
        if (!hasOffset) {
          UserNotifier.add(
            makeWarningTraceHasElapsedTimestamps(
              reader.getDescriptors().join(),
            ),
          );
        }
      });
    }
  }

  private findLastTimeGapAboveThreshold(
    ranges: readonly TimeRange[],
  ): TimeRange | undefined {
    const rangesSortedByEnd = ranges
      .slice()
      .sort((a, b) => (a.endNs < b.endNs ? -1 : +1));

    for (let i = rangesSortedByEnd.length - 2; i >= 0; --i) {
      const curr = rangesSortedByEnd[i];
      const next = rangesSortedByEnd[i + 1];
      const gap = next.startNs - curr.endNs;
      if (gap > LoadedFiles.MAX_ALLOWED_TIME_GAP_BETWEEN_TRACES_NS) {
        return new TimeRange(curr.to, next.from);
      }
    }

    return undefined;
  }

  private removeWithPredicate(predicate: (reader: FileReader) => boolean) {
    this.legacyReaders = this.legacyReaders.filter(predicate);
    this.nonPerfettoReaders = this.nonPerfettoReaders.filter(predicate);
    this.perfettoReaders = this.perfettoReaders.filter(predicate);
  }

  private hasValidTimestamps(timestamps: Timestamp[]): boolean {
    if (timestamps.length === 0) {
      return false;
    }

    const isDump =
      timestamps.length === 1 && timestamps[0].getValueNs() === INVALID_TIME_NS;
    if (isDump) {
      return false;
    }
    return true;
  }

  // Non-zero timestamps are time-ordered within the trace, but zero timestamps
  // may occur anywhere.

  // Search from the start for the first non-zero timestamp to get the smallest.
  private getSmallestNonZeroTimestamp(timestamps: Timestamp[]): Timestamp {
    return (
      timestamps.find((ts) => ts.getValueNs() !== INVALID_TIME_NS) ??
      timestamps[0]
    );
  }

  // Search from the end for the first non-zero timestamp to get the largest.
  private getLargestNonZeroTimestamp(timestamps: Timestamp[]): Timestamp {
    for (let i = timestamps.length - 1; i >= 0; i--) {
      const ts = timestamps[i];
      if (ts.getValueNs() !== INVALID_TIME_NS) {
        return ts;
      }
    }
    return timestamps[timestamps.length - 1];
  }
}

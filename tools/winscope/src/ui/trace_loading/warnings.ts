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

import {TimeRange} from '@common/time/time';
import {TimeDuration} from '@common/time/time_duration';
import {UserWarning} from '@messaging/user_warning';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';

import {BugreportData, BuildType} from './bugreport_data';
import {ParsingErrorType} from './parsing_error_type';

/**
 * A warning for when not all transitions in a trace can be parsed.
 */
export function makeWarningCannotParseAllTransitions() {
  return new UserWarning(
    'cannot parse all transitions',
    'Cannot parse all transitions. Some may be missing in Transitions viewer.',
  );
}

/**
 * A warning for when a trace entry cannot be visualized.
 */
export function makeWarningCannotVisualizeTraceEntry(errorMessage: string) {
  return new UserWarning('cannot visualize trace entry', errorMessage);
}

/**
 * A warning for a corrupted archive.
 */
export function makeWarningCorruptedArchive(file: File) {
  return new UserWarning(
    'corrupted archive',
    `${file.name}: corrupted archive`,
  );
}

/**
 * A warning for when timeline data fails to initialize.
 */
export function makeWarningFailedToInitializeTimelineData() {
  return new UserWarning(
    'failed to initialize timeline data',
    'Cannot visualize all traces: Failed to initialize timeline data.\nTry removing some traces.',
  );
}

/**
 * A warning for an incomplete frame mapping.
 */
export function makeWarningIncompleteFrameMapping(errorMessage: string) {
  return new UserWarning(
    'incomplete frame mapping',
    `Error occurred in frame mapping: ${errorMessage}`,
  );
}

/**
 * A warning to notify the user that trace processor errors are present in the stats table.
 */
export function makeWarningTraceProcessorError(
  traceTypesWithParsingErrors: Map<TraceType, ParsingErrorType>,
) {
  const traceTypeNames = Array.from(traceTypesWithParsingErrors)
    .map(([traceType, _]) => TRACE_INFO[traceType].name)
    .join(', ');
  return new UserWarning(
    'trace processor error',
    `Trace processor errors were identified on the following traces: ${traceTypeNames}`,
  );
}

/**
 * A warning for a missing persistent trace.
 */
export function makeWarningMissingPersistentTrace(
  bugreportData: BugreportData,
  persistentTracingProperty: string,
) {
  return new UserWarning(
    'missing persistent trace',
    makeMissingPersistentTraceErrorMessage(
      bugreportData,
      persistentTracingProperty,
    ),
  );
}

/**
 * A warning for when no trace targets are selected.
 */
export function makeWarningNoTraceTargetsSelected() {
  return new UserWarning(
    'No trace targets selected.',
    'No trace targets selected.',
  );
}

function makeMissingPersistentTraceErrorMessage(
  bugreportData: BugreportData,
  persistentTracingProperty: string,
): string {
  const baseMessage = 'No Winscope Perfetto trace found in bug report.';

  if (bugreportData.buildType === BuildType.USER) {
    return `${baseMessage} This is expected on 'user' builds. Persistent tracing usually requires a 'userdebug' or 'eng' build, or root access.`;
  }

  if (!bugreportData.isPersistentTracingEnabled) {
    return `${baseMessage} The persistent tracing property ('${persistentTracingProperty}') seems to be disabled. You can try enabling it via:\n'adb shell setprop ${persistentTracingProperty} 1 && adb reboot'\nThen, reproduce the issue and capture a new bug report.`;
  }

  // Unknown issue
  return `${baseMessage} Ensure the bugreport comes from a device where persistent tracing is enabled (e.g., dogfood devices or using 'adb shell setprop ${persistentTracingProperty} 1').`;
}

/**
 * A warning for a proxy trace timeout.
 */
export function makeWarningProxyTraceTimeout() {
  return new UserWarning(
    'proxy trace timeout',
    'Errors occurred during tracing: trace timed out',
  );
}

/**
 * A warning for when no valid files are found.
 */
export function makeWarningNoValidFiles(traces?: string[]) {
  const message =
    'No valid trace files found' + (traces ? ` for ${traces.join(', ')}` : '');
  return new UserWarning('no valid files', message);
}

/**
 * A warning for a trace with elapsed timestamps.
 */
export function makeWarningTraceHasElapsedTimestamps(descriptor: string) {
  return new UserWarning(
    'elapsed trace',
    `${descriptor}: trace contains only elapsed timestamps` +
      ' so many not be accurately synced with other real-time traces.',
  );
}

/**
 * A warning for a trace with old data.
 */
export function makeWarningTraceHasOldData(
  descriptors: string[],
  timeGap?: TimeRange,
) {
  const elapsedTime = timeGap
    ? new TimeDuration(timeGap.endNs - timeGap.startNs)
    : undefined;
  const message =
    `${descriptors.join(', ')}: discarded because data is old` +
    (timeGap ? `er than ${elapsedTime?.format()}` : '');
  return new UserWarning('old trace', message);
}

/**
 * A warning for a trace that has been overridden.
 */
export function makeWarningTraceOverridden(
  descriptor: string,
  overridingType?: TraceType,
) {
  return new UserWarning(
    'trace overridden',
    makeWarningTraceErrorMessage(descriptor, overridingType),
  );
}

function makeWarningTraceErrorMessage(
  descriptor: string,
  overridingType?: TraceType,
): string {
  if (overridingType !== undefined) {
    return `${descriptor}: overridden by another trace of type ${
      TraceType[overridingType]
    }`;
  }
  return `${descriptor}: overridden by another trace of same type`;
}

/**
 * A warning for an unsupported file format.
 */
export function makeWarningUnsupportedFileFormat(descriptor: string) {
  return new UserWarning(
    'unsupported format',
    `${descriptor}: unsupported format`,
  );
}

/**
 * A warning for when CSV export fails.
 */
export function makeWarningFailedToExportToCsv(errorMessage: string) {
  return new UserWarning('failed to export to CSV', errorMessage);
}

/**
 * A warning for when there are no results to export to CSV.
 */
export function makeWarningNoResultsToExport() {
  return new UserWarning('No results to export', 'No results to export');
}

/**
 * A warning for when the result set is too large to export to CSV.
 */
export function makeWarningExportTooLarge(maxRows: number) {
  return new UserWarning(
    'Export too large',
    `Result set is too large for CSV export (max ${maxRows} rows). Try narrowing your query.`,
  );
}

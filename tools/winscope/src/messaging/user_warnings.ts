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

import {BugreportData, BuildType} from 'app/trace_file_filter';
import {TimeRange} from 'common/time/time';
import {TimeDuration} from 'common/time/time_duration';
import {TRACE_INFO} from 'trace_api/trace_info';
import {TraceType} from 'trace_api/trace_type';
import {UserWarning} from './user_warning';

/**
 * A warning for a corrupted archive.
 */
export class CorruptedArchive extends UserWarning {
  constructor(private readonly file: File) {
    super();
  }

  getDescriptor(): string {
    return 'corrupted archive';
  }

  getMessage(): string {
    return `${this.file.name}: corrupted archive`;
  }
}

/**
 * A warning for when no valid files are found.
 */
export class NoValidFiles extends UserWarning {
  constructor(private traces?: string[]) {
    super();
  }
  getDescriptor(): string {
    return 'no valid files';
  }

  getMessage(): string {
    return (
      'No valid trace files found' +
      (this.traces ? ` for ${this.traces.join(', ')}` : '')
    );
  }
}

/**
 * A warning for a missing persistent trace.
 */
export class MissingPersistentTrace extends UserWarning {
  constructor(private bugreportData: BugreportData) {
    super();
  }

  override getDescriptor(): string {
    return 'missing persistent trace';
  }

  override getMessage(): string {
    const baseMessage = 'No Winscope Perfetto trace found in bug report.';

    if (this.bugreportData.buildType === BuildType.USER) {
      return `${baseMessage} This is expected on 'user' builds. Persistent tracing usually requires a 'userdebug' or 'eng' build, or root access.`;
    }

    if (!this.bugreportData.isPersistentTracingEnabled) {
      return `${baseMessage} The persistent tracing property ('persist.debug.perfetto.persistent') seems to be disabled. You can try enabling it via:\n'adb shell setprop persist.debug.perfetto.persistent 1 && adb reboot'\nThen, reproduce the issue and capture a new bug report.`;
    }

    // Unknown issue
    return `${baseMessage} Ensure the bugreport comes from a device where persistent tracing is enabled (e.g., dogfood devices or using 'adb shell setprop persist.debug.perfetto.persistent 1').`;
  }
}

/**
 * A warning for a trace with old data.
 */
export class TraceHasOldData extends UserWarning {
  constructor(
    private readonly descriptor: string,
    private readonly timeGap?: TimeRange,
  ) {
    super();
  }

  getDescriptor(): string {
    return 'old trace';
  }

  getMessage(): string {
    const elapsedTime = this.timeGap
      ? new TimeDuration(this.timeGap.endNs - this.timeGap.startNs)
      : undefined;
    return (
      `${this.descriptor}: discarded because data is old` +
      (this.timeGap ? `er than ${elapsedTime?.format()}` : '')
    );
  }
}

/**
 * A warning for a trace that has been overridden.
 */
export class TraceOverridden extends UserWarning {
  constructor(
    private readonly descriptor: string,
    private readonly overridingType?: TraceType,
  ) {
    super();
  }

  getDescriptor(): string {
    return 'trace overridden';
  }

  getMessage(): string {
    if (this.overridingType !== undefined) {
      return `${this.descriptor}: overridden by another trace of type ${
        TraceType[this.overridingType]
      }`;
    }
    return `${this.descriptor}: overridden by another trace of same type`;
  }
}

/**
 * A warning for an unsupported file format.
 */
export class UnsupportedFileFormat extends UserWarning {
  constructor(private readonly descriptor: string) {
    super();
  }

  getDescriptor(): string {
    return 'unsupported format';
  }

  getMessage(): string {
    return `${this.descriptor}: unsupported format`;
  }
}

/**
 * A warning for an invalid legacy trace.
 */
export class InvalidLegacyTrace extends UserWarning {
  constructor(
    private readonly descriptor: string,
    private readonly errorMessage: string,
  ) {
    super();
  }

  getDescriptor(): string {
    return 'invalid legacy trace';
  }

  getMessage(): string {
    return `${this.descriptor}: ${this.errorMessage}`;
  }
}

/**
 * A warning for an invalid Perfetto trace.
 */
export class InvalidPerfettoTrace extends UserWarning {
  constructor(
    private readonly descriptor: string,
    private readonly errorMessages: string[],
  ) {
    super();
  }

  getDescriptor(): string {
    return 'invalid perfetto trace';
  }

  getMessage(): string {
    return `${this.descriptor}: ${this.errorMessages.join(', ')}`;
  }
}

/**
 * A warning for when a traces parser fails to be created.
 */
export class FailedToCreateTracesParser extends UserWarning {
  constructor(
    private readonly traceType: TraceType,
    private readonly errorMessage: string,
  ) {
    super();
  }

  getDescriptor(): string {
    return 'failed to create traces parser';
  }

  getMessage(): string {
    return `Failed to create ${TRACE_INFO[this.traceType].name} parser: ${
      this.errorMessage
    }`;
  }
}

/**
 * A warning for when a trace entry cannot be visualized.
 */
export class CannotVisualizeTraceEntry extends UserWarning {
  constructor(private readonly errorMessage: string) {
    super();
  }

  getDescriptor(): string {
    return 'cannot visualize trace entry';
  }

  getMessage(): string {
    return this.errorMessage;
  }
}

/**
 * A warning for when timeline data fails to initialize.
 */
export class FailedToInitializeTimelineData extends UserWarning {
  getDescriptor(): string {
    return 'failed to initialize timeline data';
  }

  getMessage(): string {
    return 'Cannot visualize all traces: Failed to initialize timeline data.\nTry removing some traces.';
  }
}

/**
 * A warning for an incomplete frame mapping.
 */
export class IncompleteFrameMapping extends UserWarning {
  constructor(private readonly errorMessage: string) {
    super();
  }

  getDescriptor(): string {
    return 'incomplete frame mapping';
  }

  getMessage(): string {
    return `Error occurred in frame mapping: ${this.errorMessage}`;
  }
}

/**
 * A warning for when no trace targets are selected.
 */
export class NoTraceTargetsSelected extends UserWarning {
  getDescriptor(): string {
    return 'No trace targets selected';
  }

  getMessage(): string {
    return 'No trace targets selected.';
  }
}

/**
 * A warning for a missing vsync ID.
 */
export class MissingVsyncId extends UserWarning {
  constructor(private readonly tableName: string) {
    super();
  }

  getDescriptor(): string {
    return 'missing vsync id';
  }

  getMessage(): string {
    return `missing vsync_id value for one or more entries in ${this.tableName}`;
  }
}

/**
 * A warning for a proxy trace timeout.
 */
export class ProxyTraceTimeout extends UserWarning {
  getDescriptor(): string {
    return 'proxy trace timeout';
  }

  getMessage(): string {
    return 'Errors occurred during tracing: trace timed out';
  }
}

/**
 * A warning for proxy tracing warnings.
 */
export class ProxyTracingWarnings extends UserWarning {
  constructor(private readonly warnings: string[]) {
    super();
  }

  getDescriptor(): string {
    return 'proxy tracing warnings';
  }

  getMessage(): string {
    return `Trace collection warning: ${this.warnings.join(', ')}`;
  }
}

/**
 * A warning for proxy tracing errors.
 */
export class ProxyTracingErrors extends UserWarning {
  constructor(private readonly errorMessages: string[]) {
    super();
  }

  getDescriptor(): string {
    return 'proxy tracing errors';
  }

  getMessage(): string {
    return `Trace collection errors: ${this.errorMessages.join(', ')}`;
  }
}

/**
 * A warning for missing layer IDs.
 */
export class MissingLayerIds extends UserWarning {
  getDescriptor(): string {
    return 'missing layer ids';
  }

  getMessage(): string {
    return 'Cannot parse some layers due to null or undefined layer id';
  }
}

/**
 * A warning for duplicate layer IDs.
 */
export class DuplicateLayerIds extends UserWarning {
  constructor(private readonly layerIds: number[]) {
    super();
  }

  getDescriptor(): string {
    return 'duplicate layer id';
  }

  getMessage(): string {
    const optionalPlural = this.layerIds.length > 1 ? 's' : '';
    const layerIds = this.layerIds.join(', ');
    return `Duplicate SF layer id${optionalPlural} ${layerIds} found - adding as "Duplicate" to the hierarchy`;
  }
}

export class RecursiveLayerIds extends UserWarning {
  constructor(private readonly layerIds: number[]) {
    super();
  }

  getDescriptor(): string {
    return 'recursive layer id';
  }

  getMessage(): string {
    const optionalPlural = this.layerIds.length > 1 ? 's' : '';
    const layerIds = this.layerIds.join(', ');
    return (
      `Recursive SF layer${optionalPlural} ${layerIds} found - same value set for id and parent,` +
      ` so added to separate root in hierarchy.`
    );
  }
}

export class MonotonicScreenRecording extends UserWarning {
  getDescriptor(): string {
    return 'monotonic screen recording';
  }

  getMessage(): string {
    return `Screen recording may not be synchronized with the
      other traces. Metadata contains monotonic time instead of elapsed.`;
  }
}

export class CannotParseAllTransitions extends UserWarning {
  getDescriptor(): string {
    return 'cannot parse all transitions';
  }

  getMessage(): string {
    return 'Cannot parse all transitions. Some may be missing in Transitions viewer.';
  }
}

export class TraceSearchQueryFailed extends UserWarning {
  constructor(private readonly errorMessage: string) {
    super();
  }

  getDescriptor(): string {
    return 'trace search query failed';
  }

  getMessage(): string {
    return `Search query failed: ${this.errorMessage}`;
  }
}

export class FailedToConvertLegacyTraces extends UserWarning {
  constructor(private readonly errorMessage: string) {
    super();
  }

  getDescriptor(): string {
    return 'failed to convert legacy trace';
  }

  getMessage(): string {
    return `Legacy to perfetto conversion failed: ${this.errorMessage}\nDiscarding legacy traces.`;
  }
}

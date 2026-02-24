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

import {UserWarning} from '@messaging/user_warning';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';

/**
 * A warning for duplicate layer IDs.
 */
export function makeWarningDuplicateLayerIds(layerIds: number[]) {
  return new UserWarning(
    'duplicate layer id',
    makeErrorMessageDuplicateLayerIds(layerIds),
  );
}

function makeErrorMessageDuplicateLayerIds(layerIds: number[]) {
  const optionalPlural = layerIds.length > 1 ? 's' : '';
  return `Duplicate SF layer id${optionalPlural} ${layerIds.join(
    ', ',
  )} found - adding as "Duplicate" to the hierarchy`;
}

/**
 * A warning for when a traces parser fails to be created.
 */
export function makeWarningFailedToCreateTracesParser(
  traceType: TraceType,
  errorMessage: string,
) {
  return new UserWarning(
    'failed to create traces parser',
    `Failed to create ${TRACE_INFO[traceType].name} parser: ${errorMessage}`,
  );
}

/**
 * A warning for an invalid legacy trace.
 */
export function makeWarningInvalidLegacyTrace(
  descriptors: string[],
  errorMessage: string,
) {
  return new UserWarning(
    'invalid legacy trace',
    `${descriptors.join(', ')}: ${errorMessage}`,
  );
}

/**
 * A warning for an invalid non-perfetto trace.
 */
export function makeWarningInvalidNonPerfettoTrace(
  descriptors: string[],
  errorMessage: string,
) {
  return new UserWarning(
    'invalid non-perfetto trace',
    `${descriptors.join(', ')}: ${errorMessage}`,
  );
}

/**
 * A warning for an invalid Perfetto trace.
 */
export function makeWarningInvalidPerfettoTrace(
  descriptor: string,
  errorMessages: string[],
) {
  return new UserWarning(
    'invalid perfetto trace',
    `${descriptor}: ${errorMessages.join(', ')}`,
  );
}

/**
 * A warning for missing layer IDs.
 */
export function makeWarningMissingLayerIds() {
  return new UserWarning(
    'missing layer ids',
    'Cannot parse some layers due to null or undefined layer id',
  );
}

/**
 * A warning for a missing vsync ID.
 */
export function makeWarningMissingVsyncId(tableName: string) {
  return new UserWarning(
    'missing vsync id',
    `missing vsync_id value for one or more entries in ${tableName}`,
  );
}

/**
 * A warning for legacy monotonic screen recordings being loaded.
 */
export function makeWarningMonotonicScreenRecording() {
  return new UserWarning(
    'monotonic screen recording',
    `Screen recording may not be synchronized with the
      other traces. Metadata contains monotonic time instead of elapsed.`,
  );
}

/**
 * A warning for recursive layer IDs.
 */
export function makeWarningRecursiveLayerIds(layerIds: number[]) {
  return new UserWarning(
    'recursive layer id',
    makeErrorMessageRecursiveLayerIds(layerIds),
  );
}

function makeErrorMessageRecursiveLayerIds(layerIds: number[]) {
  const optionalPlural = layerIds.length > 1 ? 's' : '';
  return (
    `Recursive SF layer${optionalPlural} ${layerIds.join(
      ', ',
    )} found - same value set for id and parent,` +
    ` so added to separate root in hierarchy.`
  );
}

/**
 * A warning for when search queries fail.
 */
export function makeWarningTraceSearchQueryFailed(errorMessage: string) {
  return new UserWarning(
    'trace search query failed',
    `Search query failed: ${errorMessage}`,
  );
}

/**
 * A warning for when browser constraints cause WebCodecs stalls.
 */
export function makeWarningVideoFrameCacheStall() {
  return new UserWarning(
    'video frame cache stall',
    `Failed to fully load screen recording due to browser constraints.\nIf using Chrome, disable "Hardware-accelerated video decode" at chrome://flags and reload Winscope.`,
  );
}

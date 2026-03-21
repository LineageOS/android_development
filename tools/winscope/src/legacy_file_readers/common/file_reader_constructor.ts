/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {TraceFile} from '@trace_api/trace_file';

import {LegacyFileReader} from './legacy_file_reader';

/**
 * Function type for creating legacy file readers.
 * Used by {@link LegacyFileReaderFactory} to instantiate readers capable of
 * parsing a specific {@link TraceFile}.
 *
 * @param trace The trace file to be read/parsed.
 * @param timestampConverter Component used to normalize timestamps extracted from the trace.
 * @return A promise resolving to an array of reader instances for the trace (empty if not applicable).
 */
export type FileReaderConstructor = (
  trace: TraceFile,
  timestampConverter: ParserTimestampConverter,
) => Promise<LegacyFileReader[]>;

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

import {Timestamp} from '@common/time/time';
import {PerfettoTracePacket} from '@compat/protobuf';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

import {TestFileReader} from './test_file_reader';

/**
 * A test implementation of the LegacyFileReader interface.
 *
 * This class is used in tests to simulate the behavior of a real file reader
 * without needing to load and parse actual trace files. It allows tests to
 * inject predefined data such and timestamps and control certain behaviors,
 * such as simulating corrupted traces or traces without time offsets. This
 * makes unit testing components that depend on `LegacyFileReader` more predictable
 * and efficient.
 */
export class TestLegacyFileReader extends TestFileReader {
  private tracePackets: PerfettoTracePacket[];

  constructor(
    type: TraceType,
    timestamps: Timestamp[],
    descriptors: string[],
    noOffsets: boolean,
    traceFile: TraceFile,
    tracePackets: PerfettoTracePacket[],
  ) {
    super(type, timestamps, descriptors, noOffsets, traceFile);
    this.tracePackets = tracePackets;
  }

  convertToPerfettoPackets(): PerfettoTracePacket[] {
    return this.tracePackets;
  }
}

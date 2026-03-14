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
import {FileReader} from '@trace_api/file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

/**
 * A test implementation of the FileReader interface.
 *
 * This class is used in tests to simulate the behavior of a real file reader
 * without needing to load and parse actual trace files. It allows tests to
 * inject predefined data such and timestamps and control certain behaviors,
 * such as simulating corrupted traces or traces without time offsets. This
 * makes unit testing components that depend on `FileReader` more predictable
 * and efficient.
 */
export class TestFileReader implements FileReader {
  constructor(
    private readonly type: TraceType,
    private readonly timestamps: Timestamp[],
    private readonly descriptors: string[],
    private readonly noOffsets: boolean,
    private readonly traceFile: TraceFile,
  ) {}

  getTraceType(): TraceType {
    return this.type;
  }

  getLengthEntries(): number {
    return this.timestamps.length;
  }

  getFiles(): TraceFile[] {
    return [this.traceFile];
  }

  createTimestamps() {
    // do nothing
  }

  getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return this.noOffsets ? undefined : 0n;
  }

  getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.noOffsets ? undefined : 0n;
  }

  getTimestamps(): Timestamp[] {
    return this.timestamps;
  }

  getDescriptors(): string[] {
    return this.descriptors;
  }
}

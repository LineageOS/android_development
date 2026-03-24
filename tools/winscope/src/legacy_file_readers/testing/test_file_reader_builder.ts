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
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

import {TestFileReader} from './test_file_reader';

/**
 * Helper class to build `TestFileReader` instances for testing.
 *
 * This builder simplifies the creation of `TestFileReader` objects by
 * providing a fluent interface to set up different reader configurations,
 * such as trace type and timestamps.
 */

export class TestFileReaderBuilder {
  protected type = TraceType.SURFACE_FLINGER;
  protected timestamps?: Timestamp[];
  protected traceFile?: TraceFile;
  protected descriptors = ['file descriptor'];
  protected noOffsets = false;

  setType(type: TraceType): this {
    this.type = type;
    return this;
  }

  setTimestamps(timestamps: Timestamp[]): this {
    this.timestamps = timestamps;
    return this;
  }

  setNoOffsets(value: boolean): this {
    this.noOffsets = value;
    return this;
  }

  setTraceFile(value: TraceFile): this {
    this.traceFile = value;
    return this;
  }

  setDescriptors(descriptors: string[]): this {
    this.descriptors = descriptors;
    return this;
  }

  build(): TestFileReader {
    if (!this.timestamps) {
      throw new Error('timestamps not set');
    }

    return new TestFileReader(
      this.type,
      this.timestamps,
      this.descriptors,
      this.noOffsets,
      this.traceFile ?? new TraceFile(new File([], '')),
    );
  }
}

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

import {PerfettoTracePacket} from '@compat/protobuf';
import {TraceFile} from '@trace_api/trace_file';

import {TestFileReaderBuilder} from './test_file_reader_builder';
import {TestLegacyFileReader} from './test_legacy_file_reader';

/**
 * Helper class to build `TestLegacyFileReader` instances for testing.
 *
 * This builder simplifies the creation of `TestLegacyFileReader` objects by
 * providing a fluent interface to set up different reader configurations,
 * such as trace type and timestamps.
 */

export class TestLegacyFileReaderBuilder extends TestFileReaderBuilder {
  private tracePackets: PerfettoTracePacket[] = [];

  setTracePackets(value: PerfettoTracePacket[]): this {
    this.tracePackets = value;
    return this;
  }

  override build(): TestLegacyFileReader {
    if (!this.timestamps) {
      throw new Error('timestamps not set');
    }

    return new TestLegacyFileReader(
      this.type,
      this.timestamps,
      this.descriptors,
      this.noOffsets,
      this.traceFile ?? new TraceFile(new File([], this.descriptors[0])),
      this.tracePackets,
    );
  }
}

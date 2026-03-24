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

import {TraceFile} from '@trace_api/trace_file';

import {TestFileReaderAndParser} from './test_file_reader_and_parser';
import {TestFileReaderBuilder} from './test_file_reader_builder';

/**
 * Helper class to build `FileReaderAndParser` instances for testing.
 *
 * This builder simplifies the creation of `TestFileReader` objects by
 * providing a fluent interface to set up different reader configurations,
 * such as trace type and timestamps.
 */

export class TestFileReaderAndParserBuilder extends TestFileReaderBuilder {
  private isPerfetto = true;

  setIsPerfetto(value: boolean): this {
    this.isPerfetto = value;
    return this;
  }

  override build(): TestFileReaderAndParser {
    if (!this.timestamps) {
      throw new Error('timestamps not set');
    }

    return new TestFileReaderAndParser(
      this.type,
      this.timestamps,
      this.descriptors,
      this.traceFile ?? new TraceFile(new File([], this.descriptors[0])),
      this.isPerfetto,
    );
  }
}

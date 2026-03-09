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
import {throwIfMagicNumberDoesNotMatch} from '@common/magic_number_helpers';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {ExportedData, WindowData,} from '@protos/protos/viewcapture/udc/view_capture_pb';
import {TraceType} from '@trace_api/trace_type';
import {TraceFile} from '@trace/trace_file';

import {FileReaderViewCaptureWindow} from './file_reader_view_capture_window';

/**
 * A parser for legacy ViewCapture traces.
 */
export class FileReaderViewCapture {
  private readonly windowParsers: FileReaderViewCaptureWindow[] = [];

  constructor(
    private readonly traceFile: TraceFile,
    private readonly timestampConverter: ParserTimestampConverter,
  ) {}

  async read() {
    const traceBuffer = new Uint8Array(await this.traceFile.file.arrayBuffer());
    throwIfMagicNumberDoesNotMatch(
      traceBuffer,
      FileReaderViewCapture.MAGIC_NUMBER,
    );

    const exportedData = ExportedData.deserializeBinary(traceBuffer);

    const realToBootTimeOffsetNs = BigInt(
      assertDefined(exportedData.getRealToElapsedTimeOffsetNanos()),
    );

    exportedData.getWindowdataList().forEach((windowData: WindowData) => {
      this.windowParsers.push(
        new FileReaderViewCaptureWindow(
          this.traceFile,
          windowData.getFramedataList(),
          realToBootTimeOffsetNs,
          assertDefined(exportedData.getPackage()),
          assertDefined(windowData.getTitle()),
          exportedData.getClassnameList(),
          this.timestampConverter,
        ),
      );
    });
  }

  getTraceType(): TraceType {
    return TraceType.VIEW_CAPTURE;
  }

  getWindowParsers(): LegacyFileReader[] {
    return this.windowParsers;
  }

  private static readonly MAGIC_NUMBER = [
    0x9, 0x78, 0x65, 0x90, 0x65, 0x73, 0x82, 0x65, 0x68,
  ];
}

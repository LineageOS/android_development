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

import {NOT_IMPLEMENTED_ERROR} from '@common/errors';
import {throwIfMagicNumberDoesNotMatch} from '@common/magic_number_helpers';
import {Timestamp} from '@common/time/time';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {getLogger, Logger} from '@compat/logging';
import {PerfettoTracePacket} from '@compat/protobuf';
import {TraceFile} from '@trace_api/trace_file';
import {TraceMetadata} from '@trace_api/trace_metadata';
import {TraceType} from '@trace_api/trace_type';

import {LegacyFileReader} from './legacy_file_reader';

export abstract class AbstractFileReader<T> implements LegacyFileReader {
  private timestamps: Timestamp[] | undefined;
  protected traceFile: TraceFile;
  protected decodedEntries: readonly T[] = [];
  protected timestampConverter: ParserTimestampConverter;
  protected readonly metadata: TraceMetadata | undefined;

  constructor(
    trace: TraceFile,
    timestampConverter: ParserTimestampConverter,
    metadata?: TraceMetadata,
    protected logger: Logger = getLogger('AbstractParser'),
  ) {
    this.traceFile = trace;
    this.timestampConverter = timestampConverter;
    this.metadata = metadata;
  }

  async read(): Promise<LegacyFileReader[]> {
    const traceBuffer = new Uint8Array(await this.traceFile.file.arrayBuffer());
    throwIfMagicNumberDoesNotMatch(traceBuffer, this.getMagicNumber());
    this.decodedEntries = await this.decodeTrace(traceBuffer);
    return [this];
  }

  getFiles(): TraceFile[] {
    return [this.traceFile];
  }

  getDescriptors(): string[] {
    return [this.traceFile.getDescriptor()];
  }

  getLengthEntries(): number {
    return this.decodedEntries.length;
  }

  createTimestamps() {
    this.timestamps = this.decodeTimestamps();
  }

  getTimestamps(): Timestamp[] {
    if (!this.timestamps) {
      throw NOT_IMPLEMENTED_ERROR;
    }
    return this.timestamps;
  }

  convertToPerfettoPackets(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    sequenceId: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    trustedPid: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    trustedUid: number,
  ): PerfettoTracePacket[] {
    throw NOT_IMPLEMENTED_ERROR;
  }

  private decodeTimestamps(): Timestamp[] {
    return this.decodedEntries.map((entry) => this.getTimestamp(entry));
  }

  abstract getRealToBootTimeOffsetNs(): bigint | undefined;
  abstract getRealToMonotonicTimeOffsetNs(): bigint | undefined;
  abstract getTraceType(): TraceType;

  protected abstract getMagicNumber(): number[];
  protected abstract decodeTrace(
    trace: Uint8Array,
  ): readonly T[] | Promise<readonly T[]>;
  protected abstract getTimestamp(decodedEntry: T): Timestamp;
}

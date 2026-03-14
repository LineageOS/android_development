/*
 * Copyright (C) 2022 The Android Open Source Project
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
import {Timestamp} from '@common/time/time';
import {ParserTimestampConverter} from '@common/time/timestamp_converter';
import {PerfettoClockSnapshot, PerfettoTracePacket, PerfettoTransactionTraceEntry, PerfettoTransactionTraceFile,} from '@compat/protobuf';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';
import {LegacyFileReader} from '@legacy_file_readers/common/legacy_file_reader';
import {TraceFile} from '@trace_api/trace_file';
import {TraceType} from '@trace_api/trace_type';

export class FileReaderTransactions extends AbstractFileReader<PerfettoTransactionTraceEntry> {
  private static readonly MAGIC_NUMBER = [
    0x09, 0x54, 0x4e, 0x58, 0x54, 0x52, 0x41, 0x43, 0x45,
  ]; // .TNXTRACE

  private realToMonotonicTimeOffsetNs: bigint | undefined;

  static async createInstance(
    trace: TraceFile,
    timestampConverter: ParserTimestampConverter,
  ): Promise<LegacyFileReader[]> {
    return new FileReaderTransactions(trace, timestampConverter).read();
  }

  override getTraceType(): TraceType {
    return TraceType.TRANSACTIONS;
  }

  override getMagicNumber(): number[] {
    return FileReaderTransactions.MAGIC_NUMBER;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return this.realToMonotonicTimeOffsetNs;
  }

  override decodeTrace(
    buffer: Uint8Array,
  ): readonly PerfettoTransactionTraceEntry[] {
    const decodedProto = PerfettoTransactionTraceFile.deserializeBinary(buffer);

    const timeOffset = BigInt(
      decodedProto.getRealToElapsedTimeOffsetNanos() ?? '0',
    );
    this.realToMonotonicTimeOffsetNs =
      timeOffset !== 0n ? timeOffset : undefined;

    return decodedProto.getEntryList() || [];
  }

  override convertToPerfettoPackets(sequenceId: number): PerfettoTracePacket[] {
    const packets: PerfettoTracePacket[] = [];
    for (const entry of this.decodedEntries) {
      this.convertSignedValuesForUintFields(entry);
      const packet = new PerfettoTracePacket();
      packet.setTimestamp(assertDefined(entry.getElapsedRealtimeNanos()));
      packet.setTimestampClockId(
        PerfettoClockSnapshot.Clock.BuiltinClocks.MONOTONIC,
      );
      packet.setTrustedPacketSequenceId(sequenceId);
      packet.setSurfaceflingerTransactions(entry);
      packets.push(packet);
    }
    return packets;
  }

  protected override getTimestamp(
    entry: PerfettoTransactionTraceEntry,
  ): Timestamp {
    return this.timestampConverter.makeTimestampFromMonotonicNs(
      BigInt(assertDefined(entry.getElapsedRealtimeNanos())),
    );
  }

  private convertSignedValuesForUintFields(
    entry: PerfettoTransactionTraceEntry,
  ) {
    // Some legacy transactions traces erroneously contain signed values for fields
    // that should be unsigned. These must be manually converted to prevent errors
    // in serialization using google-protobuf.
    entry.getTransactionsList().forEach((transaction) => {
      transaction.getLayerChangesList().forEach((layer) => {
        if (layer.hasLayerId()) {
          const id = assertDefined(layer.getLayerId());
          if (id < 0) {
            layer.setLayerId(id >>> 0);
          }
        }
        if (layer.hasParentId()) {
          const parentId = assertDefined(layer.getParentId());
          if (parentId < 0) {
            layer.setParentId(parentId >>> 0);
          }
        }
        if (layer.hasWindowInfoHandle()) {
          const windowInfo = assertDefined(layer.getWindowInfoHandle());
          if (windowInfo.hasCropLayerId()) {
            const cropLayerId = assertDefined(windowInfo.getCropLayerId());
            if (cropLayerId < 0) {
              windowInfo.setCropLayerId(cropLayerId >>> 0);
            }
          }
        }
      });
    });

    entry.getAddedLayersList().forEach((layer) => {
      if (layer.hasLayerId()) {
        const layerId = assertDefined(layer.getLayerId());
        if (layerId < 0) {
          layer.setLayerId(layerId >>> 0);
        }
      }
      if (layer.hasParentId()) {
        const parentId = assertDefined(layer.getParentId());
        if (parentId < 0) {
          layer.setParentId(parentId >>> 0);
        }
      }
      if (layer.hasMirrorFromId()) {
        const mirrorFromId = assertDefined(layer.getMirrorFromId());
        if (mirrorFromId < 0) {
          layer.setMirrorFromId(mirrorFromId >>> 0);
        }
      }
    });
  }
}

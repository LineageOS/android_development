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
import {
  TransactionTraceEntry,
  TransactionTraceFile,
} from 'protos/protos/perfetto/trace/android/surfaceflinger_transactions_pb';
import {ClockSnapshot} from 'protos/protos/perfetto/trace/clock_snapshot_pb';
import {TracePacket} from 'protos/protos/perfetto/trace/trace_packet_pb';
import {TraceType} from '@trace_api/trace_type';
import {AbstractFileReader} from '@legacy_file_readers/common/abstract_file_reader';

export class FileReaderTransactions extends AbstractFileReader<TransactionTraceEntry> {
  private static readonly MAGIC_NUMBER = [
    0x09, 0x54, 0x4e, 0x58, 0x54, 0x52, 0x41, 0x43, 0x45,
  ]; // .TNXTRACE

  private realToMonotonicTimeOffsetNs: bigint | undefined;

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

  override decodeTrace(buffer: Uint8Array): TransactionTraceEntry[] {
    const decodedProto = TransactionTraceFile.deserializeBinary(buffer);

    const timeOffset = BigInt(
      decodedProto.getRealToElapsedTimeOffsetNanos() ?? '0',
    );
    this.realToMonotonicTimeOffsetNs =
      timeOffset !== 0n ? timeOffset : undefined;

    return decodedProto.getEntryList() || [];
  }

  override convertToPerfettoPackets(sequenceId: number): TracePacket[] {
    const packets: TracePacket[] = [];
    for (const entry of this.decodedEntries) {
      entry.getTransactionsList().forEach((transaction) => {
        transaction.getLayerChangesList().forEach((layer) => {
          if (layer.hasLayerId() && layer.getLayerId() === -1) {
            layer.clearLayerId();
          }
          if (layer.hasW() && layer.getW() === -1) {
            layer.clearW();
          }
          if (layer.hasH() && layer.getH() === -1) {
            layer.clearH();
          }
          if (layer.hasParentId() && layer.getParentId() === -1) {
            layer.clearParentId();
          }
          if (
            layer.hasRelativeParentId() &&
            layer.getRelativeParentId() === -1
          ) {
            layer.clearRelativeParentId();
          }
          if (layer.hasLayerStack() && layer.getLayerStack() === -1) {
            layer.clearLayerStack();
          }
          if (layer.hasFlags() && layer.getFlags() === -1) {
            layer.clearFlags();
          }
          if (layer.hasMask() && layer.getMask() === -1) {
            layer.clearMask();
          }
          if (layer.hasTransform() && layer.getTransform() === -1) {
            layer.clearTransform();
          }
          if (
            layer.hasBackgroundBlurRadius() &&
            layer.getBackgroundBlurRadius() === -1
          ) {
            layer.clearBackgroundBlurRadius();
          }
          if (layer.hasWindowInfoHandle()) {
            const windowInfo = layer.getWindowInfoHandle();
            if (windowInfo) {
              if (
                windowInfo.hasLayoutParamsFlags() &&
                windowInfo.getLayoutParamsFlags() === -1
              ) {
                windowInfo.clearLayoutParamsFlags();
              }
              if (
                windowInfo.hasCropLayerId() &&
                windowInfo.getCropLayerId() === -1
              ) {
                windowInfo.clearCropLayerId();
              }
              if (
                windowInfo.hasInputConfig() &&
                windowInfo.getInputConfig() === -1
              ) {
                windowInfo.clearInputConfig();
              }
            }
          }
        });
      });

      entry.getAddedLayersList().forEach((layer) => {
        if (layer.hasMirrorFromId() && layer.getMirrorFromId() === -1) {
          layer.clearMirrorFromId();
        }
        if (layer.hasParentId() && layer.getParentId() === -1) {
          layer.clearParentId();
        }
        if (
          layer.hasLayerStackToMirror() &&
          layer.getLayerStackToMirror() === -1
        ) {
          layer.clearLayerStackToMirror();
        }
      });
      const packet = new TracePacket();
      packet.setTimestamp(assertDefined(entry.getElapsedRealtimeNanos()));
      packet.setTimestampClockId(ClockSnapshot.Clock.BuiltinClocks.MONOTONIC);
      packet.setTrustedPacketSequenceId(sequenceId);
      packet.setSurfaceflingerTransactions(entry);
      packets.push(packet);
    }
    return packets;
  }

  protected override getTimestamp(entry: TransactionTraceEntry): Timestamp {
    return this.timestampConverter.makeTimestampFromMonotonicNs(
      BigInt(assertDefined(entry.getElapsedRealtimeNanos())),
    );
  }
}

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

import {Timestamp, TimestampType} from 'common/time';
import {LayerTraceEntry} from 'flickerlib/layers/LayerTraceEntry';
import {
  CustomQueryParserResultTypeMap,
  CustomQueryType,
  VisitableParserCustomQuery,
} from 'trace/custom_query';
import {EntriesRange} from 'trace/trace';
import {TraceFile} from 'trace/trace_file';
import {TraceType} from 'trace/trace_type';
import {AbstractParser} from './abstract_parser';
import {LayersTraceFileProto} from './proto_types';

class ParserSurfaceFlinger extends AbstractParser {
  constructor(trace: TraceFile) {
    super(trace);
    this.realToElapsedTimeOffsetNs = undefined;
  }

  override getTraceType(): TraceType {
    return TraceType.SURFACE_FLINGER;
  }

  override getMagicNumber(): number[] {
    return ParserSurfaceFlinger.MAGIC_NUMBER;
  }

  override decodeTrace(buffer: Uint8Array): any[] {
    const decoded = LayersTraceFileProto.decode(buffer) as any;
    if (Object.prototype.hasOwnProperty.call(decoded, 'realToElapsedTimeOffsetNanos')) {
      this.realToElapsedTimeOffsetNs = BigInt(decoded.realToElapsedTimeOffsetNanos);
    } else {
      console.warn('Missing realToElapsedTimeOffsetNanos property on SF trace proto');
      this.realToElapsedTimeOffsetNs = undefined;
    }
    return decoded.entry;
  }

  override getTimestamp(type: TimestampType, entryProto: any): undefined | Timestamp {
    const isDump = !Object.prototype.hasOwnProperty.call(entryProto, 'elapsedRealtimeNanos');
    if (type === TimestampType.ELAPSED) {
      return isDump
        ? new Timestamp(type, 0n)
        : new Timestamp(type, BigInt(entryProto.elapsedRealtimeNanos));
    } else if (type === TimestampType.REAL && this.realToElapsedTimeOffsetNs !== undefined) {
      return isDump
        ? new Timestamp(type, 0n)
        : new Timestamp(
            type,
            this.realToElapsedTimeOffsetNs + BigInt(entryProto.elapsedRealtimeNanos)
          );
    }
    return undefined;
  }

  override processDecodedEntry(
    index: number,
    timestampType: TimestampType,
    entryProto: any
  ): LayerTraceEntry {
    return LayerTraceEntry.fromProto(
      entryProto.layers.layers,
      entryProto.displays,
      BigInt(entryProto.elapsedRealtimeNanos.toString()),
      entryProto.vsyncId,
      entryProto.hwcBlob,
      entryProto.where,
      this.realToElapsedTimeOffsetNs,
      timestampType === TimestampType.ELAPSED /*useElapsedTime*/,
      entryProto.excludesCompositionState ?? false
    );
  }

  override customQuery<Q extends CustomQueryType>(
    type: Q,
    entriesRange: EntriesRange
  ): Promise<CustomQueryParserResultTypeMap[Q]> {
    return new VisitableParserCustomQuery(type)
      .visit(CustomQueryType.VSYNCID, () => {
        const result = this.decodedEntries
          .slice(entriesRange.start, entriesRange.end)
          .map((entry) => {
            return BigInt(entry.vsyncId.toString()); // convert Long to bigint
          });
        return Promise.resolve(result);
      })
      .visit(CustomQueryType.SF_LAYERS_ID_AND_NAME, () => {
        const result: Array<{id: number; name: string}> = [];
        this.decodedEntries
          .slice(entriesRange.start, entriesRange.end)
          .forEach((entry: LayerTraceEntry) => {
            entry.layers.layers.forEach((layer: any) => {
              result.push({id: layer.id, name: layer.name});
            });
          });
        return Promise.resolve(result);
      })
      .getResult();
  }

  private realToElapsedTimeOffsetNs: undefined | bigint;
  private static readonly MAGIC_NUMBER = [0x09, 0x4c, 0x59, 0x52, 0x54, 0x52, 0x41, 0x43, 0x45]; // .LYRTRACE
}

export {ParserSurfaceFlinger};

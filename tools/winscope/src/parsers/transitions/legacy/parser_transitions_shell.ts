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

import {Timestamp} from 'common/time/time';
import {AbstractParser} from 'parsers/legacy/abstract_parser';
import {perfetto} from 'protos/perfetto/trace/static';
import root from 'protos/transitions/udc/json';
import {com} from 'protos/transitions/udc/static';
import {TraceType} from 'trace_api/trace_type';
import {
  nullifyIfDefaultValue,
  PerfettoTransition,
} from './perfetto_conversion_helpers';

/**
 * Parser for Shell Transition trace files.
 */
export class ParserTransitionsShell extends AbstractParser<
  ShellTransition,
  PerfettoTransition
> {
  private static readonly WmShellTransitionsTraceProto = root.lookupType(
    'com.android.wm.shell.WmShellTransitionTraceProto',
  );

  private realToBootTimeOffsetNs: bigint | undefined;
  private handlerMapping: undefined | HandlerMapping[];

  override getTraceType(): TraceType {
    return TraceType.SHELL_TRANSITION;
  }

  override getRealToBootTimeOffsetNs(): bigint | undefined {
    return this.realToBootTimeOffsetNs;
  }

  override getRealToMonotonicTimeOffsetNs(): bigint | undefined {
    return undefined;
  }

  override decodeTrace(traceBuffer: Uint8Array): ShellTransition[] {
    const decodedProto =
      ParserTransitionsShell.WmShellTransitionsTraceProto.decode(
        traceBuffer,
      ) as unknown as com.android.wm.shell.IWmShellTransitionTraceProto;
    const timeOffset = BigInt(
      decodedProto.realToElapsedTimeOffsetNanos?.toString() ?? '0',
    );
    this.realToBootTimeOffsetNs = timeOffset !== 0n ? timeOffset : undefined;
    this.handlerMapping = decodedProto.handlerMappings ?? [];
    return decodedProto.transitions ?? [];
  }

  override processDecodedEntry(
    index: number,
    shellTransition: ShellTransition,
  ): PerfettoTransition {
    const perfettoTransition: PerfettoTransition = {
      id: shellTransition.id,
      dispatchTimeNs: nullifyIfDefaultValue(shellTransition.dispatchTimeNs),
      mergeTimeNs: nullifyIfDefaultValue(shellTransition.mergeTimeNs),
      mergeRequestTimeNs: nullifyIfDefaultValue(
        shellTransition.mergeRequestTimeNs,
      ),
      shellAbortTimeNs: nullifyIfDefaultValue(shellTransition.abortTimeNs),
      handler: nullifyIfDefaultValue(shellTransition.handler),
      mergeTarget: nullifyIfDefaultValue(shellTransition.mergeTarget),
    };
    return perfettoTransition;
  }

  createHandlerMappingPacket(sequenceId: number): perfetto.protos.TracePacket {
    const packet = perfetto.protos.TracePacket.create();
    packet.trustedPacketSequenceId = sequenceId;
    packet.shellHandlerMappings =
      perfetto.protos.ShellHandlerMappings.fromObject({
        mapping: this.handlerMapping,
      });
    return packet;
  }

  protected override getTimestamp(entry: ShellTransition): Timestamp {
    return entry.dispatchTimeNs
      ? this.timestampConverter.makeTimestampFromBootTimeNs(
          BigInt(entry.dispatchTimeNs.toString()),
        )
      : this.timestampConverter.makeZeroTimestamp();
  }

  protected getMagicNumber(): number[] | undefined {
    return [0x09, 0x57, 0x4d, 0x53, 0x54, 0x52, 0x41, 0x43, 0x45]; // .WMSTRACE
  }
}

type ShellTransition = com.android.wm.shell.ITransition;
type HandlerMapping = com.android.wm.shell.IHandlerMapping;

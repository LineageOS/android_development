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

import {Timestamp} from '@common/time/time';
import {FrameMap} from '@trace_api/frame_map';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';

import {TraceBuilder} from './trace_builder';

/**
 * A builder for Traces objects.
 *
 * This class simplifies the creation of Traces objects by providing methods
 * for setting entries, timestamps, and frame maps for each trace type.
 */
export class TracesBuilder {
  private readonly traceBuilders = new Map<TraceType, TraceBuilder<{}>>();

  setEntries(
    type: TraceType,
    entries: Array<{}>,
    descriptors?: string[],
  ): TracesBuilder {
    const builder = this.getOrCreateTraceBuilder(type);
    builder.setEntries(entries);
    if (descriptors) builder.setDescriptors(descriptors);
    return this;
  }

  setTimestamps(
    type: TraceType,
    timestamps: Timestamp[],
    descriptors?: string[],
  ): TracesBuilder {
    const builder = this.getOrCreateTraceBuilder(type);
    builder.setTimestamps(timestamps);
    if (descriptors) builder.setDescriptors(descriptors);
    return this;
  }

  setFrameMap(type: TraceType, frameMap: FrameMap | undefined): TracesBuilder {
    const builder = this.getOrCreateTraceBuilder(type);
    builder.setFrameMap(frameMap);
    return this;
  }

  build(): Traces {
    const traces = new Traces();
    this.traceBuilders.forEach((builder) => {
      traces.addTrace(builder.build());
    });
    return traces;
  }

  private getOrCreateTraceBuilder(type: TraceType): TraceBuilder<{}> {
    let builder = this.traceBuilders.get(type);
    if (!builder) {
      builder = new TraceBuilder<{}>();
      builder.setType(type);
      this.traceBuilders.set(type, builder);
    }
    return builder;
  }
}

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

import {perfetto} from 'protos/perfetto/trace/static';
/* eslint-disable no-restricted-imports */
import {
  SCM_REVISION as BaseSCM_REVISION,
  VERSION as BaseVERSION,
} from '../../deps_build/trace_processor/ui/tsc/gen/perfetto_version';
/* eslint-enable */

/**
 * The version string of the Perfetto build or compatible version.
 */
export const VERSION = BaseSCM_REVISION;

/**
 * The SCM revision (e.g., Git commit hash) of the Perfetto build.
 */
export const SCM_REVISION = BaseVERSION;

/**
 * The Trace type from the Perfetto build.
 *
 * It is a compatibility alias for Google3.
 */
import Trace = perfetto.protos.Trace;

/**
 * The ITracePacket type from the Perfetto build.
 *
 * It is a compatibility alias for Google3.
 */
import ITracePacket = perfetto.protos.ITracePacket;

/**
 * The TracePacket type from the Perfetto build.
 *
 * This type is used to represent the TracePacket type from the Perfetto build.
 * It is a compatibility alias for the PerfettoTracePacket type, which is the
 * actual type used in the Perfetto build.
 */
import TracePacket = perfetto.protos.TracePacket;

/**
 * The ClockSnapshot clock type from the Perfetto build.
 *
 * It is a compatibility alias for Google3.
 */
import ClockSnapshot = perfetto.protos.ClockSnapshot;

/**
 * The InternedString clock type from the Perfetto build.
 *
 * It is a compatibility alias for Google3.
 */
import InternedString = perfetto.protos.InternedString;

/**
 * The InternedData clock type from the Perfetto build.
 *
 * It is a compatibility alias for Google3.
 */
import InternedData = perfetto.protos.InternedData;

export {
  ClockSnapshot,
  InternedData,
  InternedString,
  ITracePacket,
  Trace,
  TracePacket,
};

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
import {FileReader} from '@trace_api/file_reader';

/**
 * Interface for a legacy file reader.
 *
 * This interface defines the methods required to identify and interact with a
 * legacy trace file that can be converted to the Perfetto format.
 */
export interface LegacyFileReader extends FileReader {
  convertToPerfettoPackets(
    sequenceId: number,
    trustedUid?: number,
    trustedPid?: number,
  ): PerfettoTracePacket[];
}

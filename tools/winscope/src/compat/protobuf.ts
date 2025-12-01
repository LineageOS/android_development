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
import * as protobuf from 'protobufjs';
import root from 'protos/perfetto/trace/json';

/**
 * A wrapper type for the protobufjs.Type class.
 */
import ProtobufType = protobuf.Type;

/**
 * A wrapper type for the protobufjs.Enum class.
 */
import ProtobufEnum = protobuf.Enum;

/**
 * A wrapper type for the protobufjs.Field class.
 */
import ProtobufField = protobuf.Field;

/**
 * The root object of the Perfetto build.
 *
 * This object is used to represent the root object of the Perfetto build.
 * It is a compatibility alias for the Perfetto build.
 */
const PERFETTO_TRACE_PACKET_ROOT: any = root;

export {ProtobufType, ProtobufEnum, ProtobufField, PERFETTO_TRACE_PACKET_ROOT};

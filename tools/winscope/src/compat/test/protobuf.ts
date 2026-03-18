/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {descriptors as fakeProtoDescriptorsBin} from '@protos/test/fake_proto/descriptors';
import {descriptors as intdefDescriptorsBin} from '@protos/test/intdef_translation/descriptors';
import {FileDescriptorSet} from 'google-protobuf/google/protobuf/descriptor_pb';

export function setupJspbTesting() {
  // no-op, only for compat
}

export async function getFakeProtoDescriptors(): Promise<FileDescriptorSet> {
  return FileDescriptorSet.deserializeBinary(fakeProtoDescriptorsBin);
}

export async function getIntdefDescriptors(): Promise<FileDescriptorSet> {
  return FileDescriptorSet.deserializeBinary(intdefDescriptorsBin);
}

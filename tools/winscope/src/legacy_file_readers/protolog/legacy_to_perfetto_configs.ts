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

import {PerfettoProtoLogLevel, PerfettoProtoLogViewerConfig,} from '@compat/protobuf';
import {ProtologJson32, ProtologJson64} from '@compat/protolog';

interface LegacyConfig {
  groups: {[key: string]: {tag: string}};
  messages: {
    [key: string]: {
      message: string;
      level: string;
      group: string;
      at: string;
    };
  };
}

function makeProtologViewerConfig(
  configJson: LegacyConfig,
): PerfettoProtoLogViewerConfig {
  const groupNameToId = new Map<string, number>();

  const groups: PerfettoProtoLogViewerConfig.Group[] = Object.entries(
    configJson.groups,
  ).map(([name, {tag}], index) => {
    const group = new PerfettoProtoLogViewerConfig.Group();
    group.setId(index + 1);
    group.setName(name);
    group.setTag(tag);
    groupNameToId.set(name, index + 1);
    return group;
  });

  const messages: PerfettoProtoLogViewerConfig.MessageData[] = Object.entries(
    configJson.messages,
  ).map(([id, {message, level, group, at}]) => {
    let protologLevel: number;
    switch (level) {
      case 'DEBUG':
        protologLevel = PerfettoProtoLogLevel.PROTOLOG_LEVEL_DEBUG;
        break;
      case 'VERBOSE':
        protologLevel = PerfettoProtoLogLevel.PROTOLOG_LEVEL_VERBOSE;
        break;
      case 'INFO':
        protologLevel = PerfettoProtoLogLevel.PROTOLOG_LEVEL_INFO;
        break;
      case 'WARN':
        protologLevel = PerfettoProtoLogLevel.PROTOLOG_LEVEL_WARN;
        break;
      case 'ERROR':
        protologLevel = PerfettoProtoLogLevel.PROTOLOG_LEVEL_ERROR;
        break;
      case 'WTF':
        protologLevel = PerfettoProtoLogLevel.PROTOLOG_LEVEL_WTF;
        break;
      default:
        protologLevel = PerfettoProtoLogLevel.PROTOLOG_LEVEL_UNDEFINED;
    }
    const msgData = new PerfettoProtoLogViewerConfig.MessageData();
    // ID is string in JSON, protobuf expects string (JS_STRING for fixed64).
    // The JSON contains signed 64-bit integers as strings, but fixed64 is unsigned.
    // We need to convert it to unsigned 64-bit integer string.
    const messageIdBigInt = BigInt(id);
    const messageIdUnsigned = messageIdBigInt & 0xffffffffffffffffn;
    msgData.setMessageId(messageIdUnsigned.toString());
    msgData.setMessage(message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    msgData.setLevel(protologLevel as any);
    msgData.setGroupId(groupNameToId.get(group) ?? 0);
    msgData.setLocation(at);
    return msgData;
  });

  const config = new PerfettoProtoLogViewerConfig();
  config.setMessagesList(messages);
  config.setGroupsList(groups);
  return config;
}

export const CONFIG_32 = makeProtologViewerConfig(ProtologJson32);
export const CONFIG_64 = makeProtologViewerConfig(ProtologJson64);

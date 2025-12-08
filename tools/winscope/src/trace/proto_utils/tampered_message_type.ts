/*
 * Copyright (C) 2024 The Android Open Source Project
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

import {assertDefined} from 'common/assert';
import {
  PERFETTO_TRACE_PACKET_ROOT,
  ProtobufEnum,
  ProtobufField,
  ProtobufType,
} from 'compat/protobuf';

export class TamperedMessageType extends ProtobufType {
  override fields: {[k: string]: TamperedProtoField} = {};

  static tamperTracePacket(): TamperedMessageType {
    const tracePacket = PERFETTO_TRACE_PACKET_ROOT.lookupType(
      'perfetto.protos.TracePacket',
    ) as ProtobufType;
    const allowList: string[] = [
      'surfaceflingerLayersSnapshot',
      'surfaceflingerTransactions',
      'shellTransition',
      'protologMessage',
      'winscopeExtensions',
    ];
    TamperedMessageType.tamperTypeDfs(tracePacket, allowList);
    return tracePacket as TamperedMessageType;
  }

  static tamper(protoType: ProtobufType): TamperedMessageType {
    TamperedMessageType.tamperTypeDfs(protoType);
    return protoType as TamperedMessageType;
  }

  private static tamperTypeDfs(protoType: ProtobufType, allowList?: string[]) {
    for (const fieldName of Object.keys(protoType.fields)) {
      if (!allowList || allowList.includes(fieldName)) {
        const field = protoType.fields[fieldName];
        TamperedMessageType.tamperFieldDfs(field);
      }
    }
  }

  private static tamperFieldDfs(field: ProtobufField) {
    // lookupType/lookupEnum are expensive operations. To avoid calling them
    // many times during TreeNode Operation loops (e.g. SetFormatters,
    // TranslateIntDef, AddDefaults), we tamper ProtobufField and ProtobufType
    // to provide a path linking a Field with its corresponding Type, greatly
    // improving latency in building a properties tree.
    if ((field as TamperedProtoField).tamperedMessageType) {
      return;
    }

    try {
      (field as TamperedProtoField).tamperedMessageType =
        field.parent?.lookupType(field.type) as TamperedMessageType;
    } catch (e) {
      // swallow
    }

    try {
      (field as TamperedProtoField).tamperedEnumType = field.parent?.lookupEnum(
        field.type,
      );
    } catch (e) {
      // swallow
    }

    if ((field as TamperedProtoField).tamperedMessageType === undefined) {
      return;
    }

    TamperedMessageType.tamperTypeDfs(
      assertDefined((field as TamperedProtoField).tamperedMessageType),
    );
  }
}

export class TamperedProtoField extends ProtobufField {
  tamperedMessageType: TamperedMessageType | undefined;
  tamperedEnumType: ProtobufEnum | undefined;
}

export const TAMPERED_TRACE_PACKET = TamperedMessageType.tamperTracePacket();

export const TAMPERED_WINSCOPE_EXTENSIONS = assertDefined(
  TAMPERED_TRACE_PACKET.fields['winscopeExtensions'].tamperedMessageType,
);

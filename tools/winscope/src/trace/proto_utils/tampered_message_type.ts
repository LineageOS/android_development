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

/* eslint-disable @typescript-eslint/no-explicit-any */
import {assertDefined} from '@common/assert';
import {getPerfettoTraceDescriptors} from '@compat/protobuf';
import {DescriptorProto, EnumDescriptorProto, FieldDescriptorProto, FileDescriptorSet,} from '@compat/protobuf';

// Avoid ExtensionFieldInfo as its constructor is private in some platforms and fails to build

const typedefExtension = {
  ma: 60001,
  Ba: {typedef: 0},
  la: null,
  Na: null,
  na: 0,
  F() {
    return false;
  },
} as any;

export class TamperedProtoField {
  constructor(
    public name: string,
    public id: number,
    public type: string,
    public repeated: boolean,
    public parent: TamperedMessageType,
    public defaultValue: any = undefined,
    public intDefType: string | undefined = undefined,
  ) {}

  resolve(): TamperedMessageType | undefined {
    // In strict protobufjs, generic resolve might look up the type.
    // Here we can rely on parent to look it up if needed, but we don't eager resolve.
    return this.parent.lookupType(this.type);
  }
}

export class TamperedMessageType {
  fields: {[key: string]: TamperedProtoField} = {};
  oneofs: {[key: string]: string[]} = {}; // oneof name -> field names

  constructor(
    public name: string,
    public fullName: string,
  ) {}

  lookupType(name: string): TamperedMessageType | undefined {
    return Registry.getInstance().getType(name);
  }

  lookupEnum(name: string): ProtobufEnum | undefined {
    return Registry.getInstance().getEnum(name);
  }
}

export class ProtobufEnum {
  values: {[key: string]: number} = {};
  valuesById: {[key: number]: string} = {};

  constructor(
    public name: string,
    public fullName: string,
  ) {}
}

export class Registry {
  private static instance: Registry | undefined;
  types = new Map<string, TamperedMessageType>();
  enums = new Map<string, ProtobufEnum>();

  private defaultDescriptorsLoaded = false;

  async loadDefaultDescriptors() {
    if (this.defaultDescriptorsLoaded) return;
    const descriptors = await getPerfettoTraceDescriptors();
    this.parseDescriptors(descriptors);
    this.defaultDescriptorsLoaded = true;
  }

  static getInstance(): Registry {
    const instance = Registry.instance ?? new Registry();
    if (!Registry.instance) {
      Registry.instance = instance;
    }
    return instance;
  }

  parseDescriptors(fileDescriptorSet: FileDescriptorSet) {
    for (const file of fileDescriptorSet.getFileList()) {
      const packageName = file.getPackage() || '';
      for (const msg of file.getMessageTypeList()) {
        this.parseMessageTypes(msg, packageName);
      }
      for (const enm of file.getEnumTypeList()) {
        this.parseEnum(enm, packageName);
      }
    }

    for (const file of fileDescriptorSet.getFileList()) {
      const packageName = file.getPackage() || '';
      this.parseExtensions(file.getExtensionList(), packageName);
      for (const msg of file.getMessageTypeList()) {
        this.parseMessageExtensions(msg, packageName);
      }
    }
  }

  private parseMessageTypes(msg: DescriptorProto, parentName: string) {
    const name = msg.getName()!;
    const fullName = parentName ? `${parentName}.${name}` : name;

    // Store type
    let type = this.types.get(fullName);
    if (!type) {
      type = new TamperedMessageType(name, fullName);
      this.types.set(fullName, type);
      this.types.set('.' + fullName, type);
    }

    for (const nestedMsg of msg.getNestedTypeList()) {
      this.parseMessageTypes(nestedMsg, fullName);
    }
    for (const nestedEnum of msg.getEnumTypeList()) {
      this.parseEnum(nestedEnum, fullName);
    }

    // Note: Extensions are parsed in Pass 2 via parseMessageExtensions

    for (const field of msg.getFieldList()) {
      let fieldName = field.getName()!;
      if (fieldName.includes('_')) {
        fieldName = fieldName.replace(/_([a-z])/g, (g: string) =>
          g[1].toUpperCase(),
        );
      }
      const fieldId = field.getNumber()!;
      let fieldType = 'string'; // Default to string if unknown/primitive mapping needed?

      // Mapping FieldDescriptorProto.Type to protobufjs string types
      switch (field.getType()) {
        case FieldDescriptorProto.Type.TYPE_DOUBLE:
          fieldType = 'double';
          break;
        case FieldDescriptorProto.Type.TYPE_FLOAT:
          fieldType = 'float';
          break;
        case FieldDescriptorProto.Type.TYPE_INT64:
          fieldType = 'int64';
          break;
        case FieldDescriptorProto.Type.TYPE_UINT64:
          fieldType = 'uint64';
          break;
        case FieldDescriptorProto.Type.TYPE_INT32:
          fieldType = 'int32';
          break;
        case FieldDescriptorProto.Type.TYPE_FIXED64:
          fieldType = 'fixed64';
          break;
        case FieldDescriptorProto.Type.TYPE_FIXED32:
          fieldType = 'fixed32';
          break;
        case FieldDescriptorProto.Type.TYPE_BOOL:
          fieldType = 'bool';
          break;
        case FieldDescriptorProto.Type.TYPE_STRING:
          fieldType = 'string';
          break;
        case FieldDescriptorProto.Type.TYPE_GROUP:
          fieldType = 'group';
          break; // deprecated
        case FieldDescriptorProto.Type.TYPE_MESSAGE:
          fieldType = field.getTypeName()!;
          break;
        case FieldDescriptorProto.Type.TYPE_BYTES:
          fieldType = 'bytes';
          break;
        case FieldDescriptorProto.Type.TYPE_UINT32:
          fieldType = 'uint32';
          break;
        case FieldDescriptorProto.Type.TYPE_ENUM:
          fieldType = field.getTypeName()!;
          break;
        case FieldDescriptorProto.Type.TYPE_SFIXED32:
          fieldType = 'sfixed32';
          break;
        case FieldDescriptorProto.Type.TYPE_SFIXED64:
          fieldType = 'sfixed64';
          break;
        case FieldDescriptorProto.Type.TYPE_SINT32:
          fieldType = 'sint32';
          break;
        case FieldDescriptorProto.Type.TYPE_SINT64:
          fieldType = 'sint64';
          break;
        default:
          throw new Error(`Unknown field type: ${field.getType()}`);
      }

      const repeated =
        field.getLabel() === FieldDescriptorProto.Label.LABEL_REPEATED;

      let intDefType: string | undefined;
      if (field.hasOptions()) {
        const fieldOptions = assertDefined(field.getOptions());
        try {
          const val = fieldOptions.getExtension(typedefExtension);
          if (val) {
            intDefType = val as string;
          }
        } catch {
          // ignore
        }
      }

      let defaultValue: any;
      if (field.hasDefaultValue()) {
        const raw = field.getDefaultValue()!;
        if (fieldType === 'bool') defaultValue = raw === 'true';
        else if (
          [
            'int32',
            'uint32',
            'sint32',
            'fixed32',
            'sfixed32',
            'double',
            'float',
          ].includes(fieldType)
        ) {
          defaultValue = Number(raw);
        } else if (
          ['int64', 'uint64', 'sint64', 'fixed64', 'sfixed64'].includes(
            fieldType,
          )
        ) {
          try {
            defaultValue = BigInt(raw);
          } catch {
            defaultValue = Number(raw);
          }
        } else defaultValue = raw;
      }

      const pbField = new TamperedProtoField(
        fieldName,
        fieldId,
        fieldType,
        repeated,
        type,
        defaultValue,
        intDefType,
      );
      type.fields[fieldName] = pbField;
    }
  }

  private parseMessageExtensions(msg: DescriptorProto, parentName: string) {
    const name = msg.getName()!;
    const fullName = parentName ? `${parentName}.${name}` : name;

    this.parseExtensions(msg.getExtensionList(), fullName);

    for (const nestedMsg of msg.getNestedTypeList()) {
      this.parseMessageExtensions(nestedMsg, fullName);
    }
  }

  private parseEnum(enm: EnumDescriptorProto, parentName: string) {
    const name = enm.getName()!;
    const fullName = parentName ? `${parentName}.${name}` : name;

    const pbEnum = new ProtobufEnum(name, fullName);
    this.enums.set(fullName, pbEnum);
    this.enums.set('.' + fullName, pbEnum);

    for (const val of enm.getValueList()) {
      pbEnum.values[val.getName()!] = val.getNumber()!;
      pbEnum.valuesById[val.getNumber()!] = val.getName()!;
    }
  }

  private parseExtensions(
    extensions: readonly FieldDescriptorProto[],
    parentName: string,
  ) {
    for (const ext of extensions) {
      const extendee = ext.getExtendee()!;
      const extendedType = this.getType(extendee);
      if (extendedType) {
        const name = ext.getName()!;
        const fieldId = ext.getNumber()!;
        let fieldType = 'string';

        switch (ext.getType()) {
          case FieldDescriptorProto.Type.TYPE_DOUBLE:
            fieldType = 'double';
            break;
          case FieldDescriptorProto.Type.TYPE_FLOAT:
            fieldType = 'float';
            break;
          case FieldDescriptorProto.Type.TYPE_INT64:
            fieldType = 'int64';
            break;
          case FieldDescriptorProto.Type.TYPE_UINT64:
            fieldType = 'uint64';
            break;
          case FieldDescriptorProto.Type.TYPE_INT32:
            fieldType = 'int32';
            break;
          case FieldDescriptorProto.Type.TYPE_FIXED64:
            fieldType = 'fixed64';
            break;
          case FieldDescriptorProto.Type.TYPE_FIXED32:
            fieldType = 'fixed32';
            break;
          case FieldDescriptorProto.Type.TYPE_BOOL:
            fieldType = 'bool';
            break;
          case FieldDescriptorProto.Type.TYPE_STRING:
            fieldType = 'string';
            break;
          case FieldDescriptorProto.Type.TYPE_GROUP:
            fieldType = 'group';
            break;
          case FieldDescriptorProto.Type.TYPE_MESSAGE:
            fieldType = ext.getTypeName()!;
            break;
          case FieldDescriptorProto.Type.TYPE_BYTES:
            fieldType = 'bytes';
            break;
          case FieldDescriptorProto.Type.TYPE_UINT32:
            fieldType = 'uint32';
            break;
          case FieldDescriptorProto.Type.TYPE_ENUM:
            fieldType = ext.getTypeName()!;
            break;
          case FieldDescriptorProto.Type.TYPE_SFIXED32:
            fieldType = 'sfixed32';
            break;
          case FieldDescriptorProto.Type.TYPE_SFIXED64:
            fieldType = 'sfixed64';
            break;
          case FieldDescriptorProto.Type.TYPE_SINT32:
            fieldType = 'sint32';
            break;
          case FieldDescriptorProto.Type.TYPE_SINT64:
            fieldType = 'sint64';
            break;
          default:
            throw new Error(`Unknown field type: ${ext.getType()}`);
        }

        const repeated =
          ext.getLabel() === FieldDescriptorProto.Label.LABEL_REPEATED;
        const pbField = new TamperedProtoField(
          name,
          fieldId,
          fieldType,
          repeated,
          extendedType,
          undefined,
          undefined,
        );

        let camelName = name;
        if (camelName.includes('_')) {
          camelName = camelName.replace(/_([a-z])/g, (g: string) =>
            g[1].toUpperCase(),
          );
        }

        const fullCamelName = parentName
          ? `.${parentName}.${camelName}`
          : `.${camelName}`;
        extendedType.fields[fullCamelName] = pbField;

        // Also register simple camelName if valid?
        extendedType.fields[camelName] = pbField;
      }
    }
  }

  getType(name: string): TamperedMessageType | undefined {
    // If name starts with '.', it's absolute.
    if (name.startsWith('.')) return this.types.get(name);
    if (this.types.has(name)) return this.types.get(name);
    if (this.types.has('.' + name)) return this.types.get('.' + name);

    return undefined;
  }

  getTracePacketType(): TamperedMessageType {
    return assertDefined(this.getType('perfetto.protos.TracePacket'));
  }

  getWinscopeExtensionsType(): TamperedMessageType {
    const tracePacket = this.getTracePacketType();
    return assertDefined(tracePacket.fields['winscopeExtensions']?.resolve());
  }

  getEnum(name: string): ProtobufEnum | undefined {
    if (name.startsWith('.')) return this.enums.get(name);
    if (this.enums.has(name)) return this.enums.get(name);
    if (this.enums.has('.' + name)) return this.enums.get('.' + name);
    return undefined;
  }
}

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

import {assertBigIntOrUndefined, assertDefined, assertNumberOrUndefined, assertString, assertStringOrUndefined,} from '@common/assert';
import {convertSnakeToCamelCase} from '@common/string_helpers';
import {RowIterator} from '@trace_processor/query_result';
import {getDefaultValue, LeafValue, stripEnumPrefix,} from '@trace/proto_utils/field_value_helpers';
import {TamperedMessageType, TamperedProtoField,} from '@trace/proto_utils/tampered_message_type';
import {PropertySource, PropertyTreeNode, PropertyValue,} from '@tree_node/property_tree_node';
import {PropertyTreeNodeFactory} from '@tree_node/property_tree_node_factory';

import {AbstractPropertyTreeBuilder} from './abstract_property_tree_builder';

/**
 * A builder for creating a property tree from an args table query result.
 */
export class PropertyTreeBuilderFromArgs extends AbstractPropertyTreeBuilder<RowIterator> {
  private readonly factory = new PropertyTreeNodeFactory();
  private rootMessageType: TamperedMessageType | undefined;
  private denylistProperties: string[] = [];
  private rowValidityCheck: ((row: RowIterator) => boolean) | undefined;
  private useRootIdWithoutChange = false;

  setRootMessageType(value: TamperedMessageType): this {
    this.rootMessageType = value;
    return this;
  }

  setDenyList(value: string[]): this {
    this.denylistProperties = value;
    return this;
  }

  setRowValidityCheck(value: (row: RowIterator) => boolean): this {
    this.rowValidityCheck = value;
    return this;
  }

  setUseRootIdWithoutChange(value: boolean): this {
    this.useRootIdWithoutChange = value;
    return this;
  }

  protected override buildPropertiesTree(rootNodeId: string): PropertyTreeNode {
    if (!this.data) {
      throw new Error('data not set');
    }
    if (!this.rootMessageType) {
      throw new Error('rootMessageType not set');
    }

    const rootNode = this.factory.makePropertyRoot(
      this.useRootIdWithoutChange
        ? assertDefined(this.rootId).toString()
        : rootNodeId,
      assertDefined(this.rootName),
      PropertySource.PROTO,
      undefined,
    );

    for (
      const it = this.data;
      it.valid() && (!this.rowValidityCheck || this.rowValidityCheck(it));
      it.next()
    ) {
      const keyParts = this.extractKeyParts(assertString(it.get('key')));
      if (keyParts.some((part) => this.denylistProperties.includes(part))) {
        continue;
      }

      const directParent = this.findOrMakeDirectParent(rootNode, keyParts);
      const propertyName = keyParts[keyParts.length - 1];

      const value = this.makeValue(
        assertString(it.get('value_type')),
        assertBigIntOrUndefined(it.get('int_value')),
        assertNumberOrUndefined(it.get('real_value')),
        assertStringOrUndefined(it.get('string_value')),
      );

      const field = this.getProtoField(keyParts);
      const transformedValue = field
        ? this.transformValueFromField(value, field)
        : value;

      const node =
        field !== undefined && transformedValue === getDefaultValue(field)
          ? this.factory.makeDefaultProperty(
              directParent.id,
              propertyName,
              transformedValue,
            )
          : this.factory.makeProtoProperty(
              directParent.id,
              propertyName,
              transformedValue,
            );
      directParent.addOrReplaceChild(node);
    }

    return rootNode;
  }

  private findOrMakeDirectParent(
    rootNode: PropertyTreeNode,
    keyParts: string[],
  ) {
    let directParent = rootNode;
    for (const part of keyParts.slice(0, keyParts.length - 1)) {
      const existingNode = directParent.getChildByName(part);
      if (existingNode) {
        directParent = existingNode;
      } else {
        const node = this.factory.makeProtoProperty(
          directParent.id,
          part,
          undefined,
        );
        directParent.addOrReplaceChild(node);
        directParent = node;
      }
    }
    return directParent;
  }

  private extractKeyParts(key: string): string[] {
    return key
      .replace(/\[/g, '.')
      .replace(/\]/g, '')
      .split('.')
      .map((token: string) => {
        return convertSnakeToCamelCase(token);
      });
  }

  private getProtoField(keyParts: string[]): TamperedProtoField | undefined {
    let messageType = assertDefined(this.rootMessageType);
    let field: TamperedProtoField | undefined;
    for (const part of keyParts) {
      if (Number.isInteger(Number(part))) {
        continue;
      }
      field = messageType.fields[part];
      if (!field) {
        return undefined;
      }
      const resolvedType = field.resolve();
      if (!resolvedType) {
        break;
      }
      messageType = resolvedType;
    }
    return field;
  }

  private transformValueFromField(
    value: LeafValue | undefined,
    field: TamperedProtoField,
  ): PropertyValue | undefined {
    if (!field.repeated && !Array.isArray(value)) {
      switch (field.type) {
        case 'double':
        case 'float':
        case 'int32':
        case 'uint32':
        case 'sint32':
        case 'fixed32':
        case 'sfixed32':
          return Number(value ?? 0);
        case 'int64':
        case 'uint64':
        case 'sint64':
        case 'fixed64':
        case 'sfixed64':
          return BigInt(value ?? 0);
        case 'bool':
          return Boolean(value);
        case 'string':
        case 'bytes':
          return value;
        default:
          if (this.rootMessageType) {
            const enumType = this.rootMessageType.lookupEnum(field.type);
            if (enumType) {
              if (typeof value === 'string') {
                return value;
              }
              const intVal = Number(value ?? 0);
              const rawLabel = enumType.valuesById[intVal];
              return rawLabel ? stripEnumPrefix(enumType, rawLabel) : intVal;
            }
          }
      }
    }
    if (field.repeated && value === undefined) {
      return [];
    }

    if (value === undefined || value === null) {
      return [];
    }
    return value;
  }

  private makeValue(
    valueType: string,
    intValue: bigint | undefined,
    realValue: number | undefined,
    stringValue: string | undefined,
  ): LeafValue | undefined {
    switch (valueType) {
      case 'bool':
        return Boolean(intValue);
      case 'int':
      case 'uint':
        return intValue ?? undefined;
      case 'null':
        return undefined;
      case 'real':
        return realValue ?? undefined;
      case 'string':
        return stringValue ?? undefined;
      default:
        throw new Error(`Unsupported type ${valueType}`);
    }
  }
}

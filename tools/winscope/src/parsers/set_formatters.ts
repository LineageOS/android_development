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

import {Timestamp} from 'common/time/time';
import {
  TamperedMessageType,
  TamperedProtoField,
} from 'trace/proto_utils/tampered_message_type';
// TODO(b/311642700) Not compatible with google3 migration
import * as protobuf from 'protobufjs';
import {
  BUFFER_FORMATTER,
  COLOR_FORMATTER,
  DEFAULT_PROPERTY_FORMATTER,
  EnumFormatter,
  MATRIX_FORMATTER,
  POSITION_FORMATTER,
  RECT_FORMATTER,
  REGION_FORMATTER,
  SIZE_FORMATTER,
  TIMESTAMP_NODE_FORMATTER,
  TRANSFORM_FORMATTER,
} from 'trace/formatters';
import {Operation} from 'tree_node/operation';
import {
  PropertyFormatter,
  PropertyTreeNode,
} from 'tree_node/property_tree_node';

export class SetFormatters implements Operation<PropertyTreeNode> {
  private static readonly TransformRegExp = new RegExp('transform', 'i');

  constructor(
    private readonly rootField?: TamperedProtoField,
    private readonly customFormatters?: Map<string, PropertyFormatter>,
  ) {}

  apply(value: PropertyTreeNode, parentField = this.rootField): void {
    let field: TamperedProtoField | undefined;
    let enumType: protobuf.Enum | undefined;

    if (parentField) {
      const protoType: TamperedMessageType | undefined =
        parentField.tamperedMessageType;

      field = parentField;
      if (protoType && field.name !== value.name) {
        field = protoType.fields[value.name] ?? parentField;
      }

      enumType = field.tamperedEnumType;
    }

    const formatter = this.getFormatter(value, enumType?.valuesById);

    if (formatter) value.setFormatter(formatter);

    value.getAllChildren().forEach((value) => {
      this.apply(value, field);
    });
  }

  private getFormatter(
    node: PropertyTreeNode,
    valuesById: {[key: number]: string} | undefined,
  ): PropertyFormatter | undefined {
    if (this.customFormatters?.get(node.name)) {
      return this.customFormatters.get(node.name);
    }

    if (valuesById) return new EnumFormatter(valuesById);

    if (node.getValue() instanceof Timestamp) return TIMESTAMP_NODE_FORMATTER;

    if (node.isColor()) return COLOR_FORMATTER;
    if (node.isRect()) return RECT_FORMATTER;
    if (node.isBuffer()) return BUFFER_FORMATTER;
    if (node.isSize()) return SIZE_FORMATTER;
    if (node.isRegion()) return REGION_FORMATTER;
    if (node.isPosition()) return POSITION_FORMATTER;
    if (
      SetFormatters.TransformRegExp.test(node.name) &&
      node.getChildByName('type')
    ) {
      return TRANSFORM_FORMATTER;
    }
    if (node.isMatrix()) return MATRIX_FORMATTER;

    if (node.getAllChildren().length > 0) return undefined;

    return DEFAULT_PROPERTY_FORMATTER;
  }
}

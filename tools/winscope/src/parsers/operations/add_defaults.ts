import {assertDefined} from '@common/assert';
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

import {getDefaultValue} from '@trace/proto_utils/field_value_helpers';
import {TamperedMessageType, TamperedProtoField,} from '@trace/proto_utils/tampered_message_type';
import {AddOperation} from '@tree_node/add_operation';
import {PropertySource, PropertyTreeNode} from '@tree_node/property_tree_node';
import {DEFAULT_PROPERTY_TREE_NODE_FACTORY} from '@tree_node/property_tree_node_factory';

export class AddDefaults extends AddOperation<PropertyTreeNode> {
  private readonly protoType: TamperedMessageType;
  constructor(
    protoField: TamperedProtoField,
    private readonly propertyAllowlist?: string[],
    private readonly propertyDenylist?: string[],
  ) {
    super();
    this.protoType = assertDefined(protoField.resolve());
  }

  override makeProperties(value: PropertyTreeNode): PropertyTreeNode[] {
    const defaultPropertyNodes: PropertyTreeNode[] = [];
    for (const fieldName in this.protoType.fields) {
      if (
        this.propertyAllowlist &&
        !this.propertyAllowlist.includes(fieldName)
      ) {
        continue;
      }

      if (this.propertyDenylist && this.propertyDenylist.includes(fieldName)) {
        continue;
      }

      if (
        !Object.prototype.hasOwnProperty.call(this.protoType.fields, fieldName)
      ) {
        continue;
      }

      let existingNode = value.getChildByName(fieldName);
      const existingValue = existingNode?.getValue();
      const field = this.protoType.fields[fieldName];
      const defaultValue = getDefaultValue(field);

      if (
        !existingNode ||
        (existingValue !== undefined && existingValue === defaultValue) ||
        (existingValue === undefined &&
          existingNode.getAllChildren().length === 0)
      ) {
        if (existingNode?.source === PropertySource.DEFAULT) {
          continue;
        }
        existingNode = DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeDefaultProperty(
          value.id,
          fieldName,
          defaultValue ?? undefined,
        );
        defaultPropertyNodes.push(existingNode);
        continue;
      }

      if (field.resolve()) {
        const operation = new AddDefaults(field);
        if (field.repeated) {
          existingNode
            .getAllChildren()
            .forEach((child) => operation.apply(child));
        } else {
          operation.apply(existingNode);
        }
      }
    }

    return defaultPropertyNodes;
  }
}

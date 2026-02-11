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

import {Operation} from '@tree_node/operation';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {DEFAULT_PROPERTY_TREE_NODE_FACTORY} from '@tree_node/property_tree_node_factory';

export class RenameProperty implements Operation<PropertyTreeNode> {
  constructor(
    private readonly oldName: string,
    private readonly newName: string,
  ) {}

  apply(value: PropertyTreeNode): void {
    const oldProperty = value.getChildByName(this.oldName);

    if (oldProperty) {
      const oldPropertyValue = oldProperty.getValue();

      if (oldPropertyValue !== undefined && oldPropertyValue !== null) {
        const newProperty =
          DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeProtoProperty(
            value.id,
            this.newName,
            oldPropertyValue,
          );
        value.addOrReplaceChild(newProperty);
      }
      value.removeChild(oldProperty.id);
    }

    const children = [...value.getAllChildren()];
    children.forEach((child) => {
      this.apply(child);
    });
  }
}

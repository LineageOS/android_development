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

import {Operation} from 'tree_node/operation';
import {PropertyTreeNode} from 'tree_node/property_tree_node';
import {DEFAULT_PROPERTY_TREE_NODE_FACTORY} from 'tree_node/property_tree_node_factory';

export class UpdateCornerRadii implements Operation<PropertyTreeNode> {
  apply(value: PropertyTreeNode): void {
    ['cornerRadii', 'requestedCornerRadii', 'clientDrawnCornerRadii'].forEach(
      (nodeName) => {
        this.stripIfDefault(value, nodeName);
      },
    );
  }

  private stripIfDefault(rootNode: PropertyTreeNode, radiiNodeName: string) {
    const radiiNode = rootNode?.getChildByName(radiiNodeName);
    const radiiValues = radiiNode?.getAllChildren() ?? [];
    if (
      radiiValues.length > 0 &&
      radiiValues.every((r) => r.getValue() === 0)
    ) {
      const strippedRadiiNode =
        DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeDefaultProperty(
          rootNode.id,
          radiiNodeName,
          null,
        );
      rootNode.addOrReplaceChild(strippedRadiiNode);
    }
  }
}

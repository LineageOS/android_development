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

import {FixedStringFormatter, formatAsHex} from '@trace/formatters';
import {Operation} from '@tree_node/operation';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {TreeNode} from '@tree_node/tree_node';

export abstract class AbstractUpdateLayersAndWindows<
  T extends TreeNode,
> implements Operation<T> {
  constructor(
    private readonly layerIdToName: Map<number, string>,
    private readonly windowTokenToTitle: Map<number, string>,
  ) {}

  abstract apply(node: T): void;

  protected updateLayerId(layerId: PropertyTreeNode) {
    const layerIdValue = layerId.getValue() ?? undefined;
    if (layerIdValue === undefined) {
      return;
    }
    const layerName = this.layerIdToName.get(Number(layerIdValue));
    if (layerName === undefined) {
      return;
    }
    layerId.setFormatter(
      new FixedStringFormatter(`${layerIdValue} (${layerName})`),
    );
  }

  protected updateWindowId(windowId: PropertyTreeNode) {
    const value = windowId.getValue<bigint | number>() ?? undefined;
    if (value === undefined) {
      return;
    }
    const windowIdValue = Number(value);
    const windowIdString = formatAsHex(windowIdValue);
    const windowTitle = this.windowTokenToTitle.get(windowIdValue);
    windowId.setFormatter(
      new FixedStringFormatter(
        windowTitle
          ? `${windowIdString} (${windowTitle})`
          : `${windowIdString}`,
      ),
    );
  }
}

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

import {
  FixedStringFormatter,
  FLAG_SEPARATOR,
  formatAsHex,
} from 'trace/formatters';
import {LayerFlag} from 'trace/surface_flinger/layer_flag';
import {Operation} from 'tree_node/operation';
import {PropertyTreeNode} from 'tree_node/property_tree_node';

export class TranslateFlags implements Operation<PropertyTreeNode> {
  apply(value: PropertyTreeNode): void {
    const flagsNode = value.getChildByName('flags');
    if (flagsNode === undefined) {
      return;
    }
    const flags = flagsNode.getValue<number>() ?? 0;

    const tokens: string[] = [];
    Object.keys(LayerFlag)
      .filter((flag) => !isNaN(Number(flag)))
      .forEach((intFlag) => {
        const intFlagNum = Number(intFlag);
        if ((intFlagNum & flags) !== 0) {
          tokens.push(LayerFlag[intFlagNum]);
        }
      });

    if (tokens.length > 0) {
      const verboseFlagsStr = `${tokens.join(FLAG_SEPARATOR)} (${formatAsHex(
        flags,
      )})`;
      flagsNode.setFormatter(new FixedStringFormatter(verboseFlagsStr));
    }
  }
}

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

import {assertDefined, assertTrue} from '@common/assert';
import {UINT32_MAX} from '@common/math';
import {Operation} from '@tree_node/operation';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {DEFAULT_PROPERTY_TREE_NODE_FACTORY} from '@tree_node/property_tree_node_factory';

export class AddDisplayProperties implements Operation<PropertyTreeNode> {
  apply(value: PropertyTreeNode): void {
    const displays = value.getChildByName('displays');

    if (!displays) return;

    for (const display of displays.getAllChildren()) {
      this.addIsLargeScreenProperty(display);
      this.addIsOnProperty(display);
    }
  }

  private addIsOnProperty(display: PropertyTreeNode) {
    const layerStack = Number(
      assertDefined(display.getChildByName('layerStack')?.getValue() ?? 0),
    );

    assertTrue(
      layerStack !== -1,
      () =>
        'layerStack = -1; false assumption that layerStack is always unsigned',
    );

    display.addOrReplaceChild(
      DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeCalculatedProperty(
        display.id,
        'isOn',
        layerStack !== UINT32_MAX,
      ),
    );
  }

  private addIsLargeScreenProperty(display: PropertyTreeNode) {
    const dpiX = Number(display.getChildByName('dpiX')?.getValue() ?? 0);

    const size = display.getChildByName('size');
    const width = assertDefined(
      size?.getChildByName('w')?.getValue<number>() ?? 0,
    );
    const height = assertDefined(
      size?.getChildByName('h')?.getValue<number>() ?? 0,
    );
    const smallestWidth = this.dpiFromPx(Math.min(width, height), dpiX);
    const isLargeScreen = smallestWidth >= AddDisplayProperties.TABLET_MIN_DPS;

    display.addOrReplaceChild(
      DEFAULT_PROPERTY_TREE_NODE_FACTORY.makeCalculatedProperty(
        display.id,
        'isLargeScreen',
        isLargeScreen,
      ),
    );
  }

  private dpiFromPx(size: number, densityDpi: number): number {
    const densityRatio = densityDpi / AddDisplayProperties.DENSITY_DEFAULT;
    return size / densityRatio;
  }

  private static readonly TABLET_MIN_DPS = 600;
  private static readonly DENSITY_DEFAULT = 160;
}

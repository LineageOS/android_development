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

import {FixedStringFormatter} from '@trace/formatters';
import {DispatchedPointerAxis} from '@trace/input/dispatched_pointer_axis';
import {Operation} from '@tree_node/operation';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';

export class FormatDispatchEntry implements Operation<UiPropertyTreeNode> {
  constructor(private readonly layerIdToName: Map<number, string>) {}

  apply(node: UiPropertyTreeNode): void {
    node.setDisplayName('TargetWindows');
    node.getAllChildren().forEach((dispatchEntry: UiPropertyTreeNode) => {
      const windowName = this.getWindowName(dispatchEntry);
      dispatchEntry.setDisplayName(`${windowName}`);
      this.formatDispatchedPointers(dispatchEntry);
    });
  }

  private getWindowName(dispatchEntry: UiPropertyTreeNode): string {
    const windowIdNode = dispatchEntry.getChildByName('windowId');
    const value = windowIdNode?.getValue<number>();
    if (value === undefined) {
      return '<Unknown Window ID>';
    }
    return (
      this.layerIdToName.get(value) ?? `WindowId: ${value} - <Unknown Name>`
    );
  }

  private formatDispatchedPointers(dispatchEntry: UiPropertyTreeNode) {
    const dispatchedPointersNode =
      dispatchEntry.getChildByName('dispatchedPointer');
    if (dispatchedPointersNode === undefined) {
      return;
    }
    dispatchedPointersNode.setDisplayName('DispatchedPointers');

    const pointers = dispatchedPointersNode.getAllChildren();
    if (!pointers || pointers.length === 0) {
      dispatchedPointersNode.setFormatter(new FixedStringFormatter('<none>'));
      return;
    }
    pointers.forEach((pointer, index) => {
      pointer.setDisplayName(`${index} - Pointer`);

      const id = pointer.getChildByName('pointerId')?.getValue<string>() ?? '?';

      const axisValues = pointer.getChildByName('axisValueInWindow');
      let x = '?';
      let y = '?';
      axisValues?.getAllChildren()?.forEach((axisValue) => {
        const axis = Number(
          axisValue.getChildByName('axis')?.getValue<string>(),
        );
        if (axis === DispatchedPointerAxis.X) {
          x =
            axisValue.getChildByName('value')?.getValue<number>()?.toFixed(2) ??
            '?';
          return;
        }
        if (axis === DispatchedPointerAxis.Y) {
          y =
            axisValue.getChildByName('value')?.getValue<number>()?.toFixed(2) ??
            '?';
          return;
        }
      });

      const rawX =
        pointer.getChildByName('xInDisplay')?.getValue<number>()?.toFixed(2) ??
        '?';
      const rawY =
        pointer.getChildByName('yInDisplay')?.getValue<number>()?.toFixed(2) ??
        '?';

      pointer.setFormatter(
        new FixedStringFormatter(
          `ID: ${id}, XY: (${x}, ${y}), RawXY: (${rawX}, ${rawY})`,
        ),
      );
    });
  }
}

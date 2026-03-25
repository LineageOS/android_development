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

import {assertDefined} from '@common/assert';
import {Point} from '@common/geometry/point';
import {DispatchedPointerAxis} from '@trace/input/dispatched_pointer_axis';
import {HierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {TraceRect} from '@tree_node/trace_rect';
import {UiRect} from '@ui/shared/rects/ui_rect';
import {UiRectBuilder} from '@ui/shared/rects/ui_rect_builder';

export function makeUiRects(
  hierarchyRoot: HierarchyTreeNode,
  viewCapturePackageNames: string[] = [],
): UiRect[] {
  const traceRects = extractRects(hierarchyRoot);
  return traceRects.map((traceRect) => {
    let name = traceRect.name;
    if (name.startsWith('VRI-')) {
      name = name.substring(4);
    }
    const hasContent = viewCapturePackageNames.includes(
      name.substring(0, name.indexOf('/')),
    );
    return new UiRectBuilder()
      .setX(traceRect.x)
      .setY(traceRect.y)
      .setWidth(traceRect.w)
      .setHeight(traceRect.h)
      .setLabel(traceRect.name)
      .setTransform(traceRect.transform)
      .setIsVisible(traceRect.isVisible)
      .setIsDisplay(traceRect.isDisplay)
      .setIsActiveDisplay(traceRect.isActiveDisplay)
      .setId(traceRect.id)
      .setGroupId(traceRect.groupId)
      .setIsClickable(!traceRect.isDisplay)
      .setCornerRadii(traceRect.cornerRadii)
      .setHasContent(hasContent)
      .setDepth(traceRect.depth)
      .setOpacity(traceRect.opacity)
      .build();
  });
}

export function makeVcUiRects(
  hierarchyRoot: HierarchyTreeNode,
  groupId: number,
): UiRect[] {
  const traceRects = extractRects(hierarchyRoot);
  return traceRects.map((traceRect) => {
    return new UiRectBuilder()
      .setX(traceRect.x)
      .setY(traceRect.y)
      .setWidth(traceRect.w)
      .setHeight(traceRect.h)
      .setLabel('')
      .setTransform(traceRect.transform)
      .setIsVisible(traceRect.isVisible)
      .setIsDisplay(traceRect.isDisplay)
      .setIsActiveDisplay(traceRect.isActiveDisplay)
      .setId(traceRect.id)
      .setGroupId(groupId)
      .setIsClickable(true)
      .setHasContent(traceRect.isVisible)
      .setDepth(assertDefined(traceRect.depth))
      .setOpacity(traceRect.opacity)
      .build();
  });
}

export function makeInputRects(
  hierarchyRoot: HierarchyTreeNode,
  hasContent: (id: string) => boolean,
  dispatchProperties?: PropertyTreeNode,
): UiRect[] {
  const traceRects = extractRects(hierarchyRoot, (node) =>
    // The root node contains the display rects, so use the primary rects for the displays.
    // For nodes, the input windows are the secondary rects.
    node.isRoot() ? node.getRects() : node.getSecondaryRects(),
  );
  return traceRects.map((traceRect) => {
    const {pointers, rays} = extractPointersAndRays(
      traceRect,
      dispatchProperties,
    );

    const opacity = traceRect.isDisplay ? 1 : traceRect.isSpy ? 0.25 : 0.9;

    return new UiRectBuilder()
      .setX(traceRect.x)
      .setY(traceRect.y)
      .setWidth(traceRect.w)
      .setHeight(traceRect.h)
      .setLabel(traceRect.name)
      .setTransform(traceRect.transform)
      .setIsVisible(traceRect.isVisible)
      .setIsDisplay(traceRect.isDisplay)
      .setIsActiveDisplay(traceRect.isActiveDisplay)
      .setId(traceRect.id)
      .setGroupId(traceRect.groupId)
      .setIsClickable(true)
      .setHasContent(hasContent(traceRect.id))
      .setDepth(traceRect.depth)
      .setOpacity(opacity)
      .setFillRegion(traceRect.fillRegion)
      .setPointerLocationsInRect(pointers)
      .setRayLocationsInDisplay(rays)
      .build();
  });
}

function extractRects(
  hierarchyRoot: HierarchyTreeNode,
  extractNodeRects = (node: HierarchyTreeNode) => node.getRects(),
): TraceRect[] {
  const rects: TraceRect[] = [];

  hierarchyRoot.forEachNodeDfs((node) => {
    const nodeRects = extractNodeRects(node);
    if (nodeRects && nodeRects.length > 0) {
      rects.push(...nodeRects);
    }
  });

  return rects.filter((traceRect) => !traceRect.isEmpty());
}

function extractPointersAndRays(
  traceRect: TraceRect,
  dispatchProperties: PropertyTreeNode | undefined,
): {pointers: Point[]; rays: Point[]} {
  const pointers: Point[] = [];
  const rays: Point[] = [];
  if (!traceRect.isDisplay && dispatchProperties) {
    const targetWindow = dispatchProperties?.getAllChildren().find((c) => {
      const id = c.getChildByName('windowId');
      return (
        id !== undefined &&
        traceRect.id.split(' ')[0] === id.getValue<number>()?.toString()
      );
    });

    targetWindow
      ?.getChildByName('dispatchedPointer')
      ?.getAllChildren()
      .forEach((pointer) => {
        const rawX = pointer.getChildByName('xInDisplay')?.getValue<number>();
        const rawY = pointer.getChildByName('yInDisplay')?.getValue<number>();
        if (rawX !== undefined && rawY !== undefined) {
          rays.push({x: rawX, y: rawY});
        }

        const axes = pointer
          .getChildByName('axisValueInWindow')
          ?.getAllChildren();
        let pointerX: number | undefined;
        let pointerY: number | undefined;
        axes?.forEach((axisValue) => {
          const axis = axisValue.getChildByName('axis')?.getValue<number>();
          if (axis === DispatchedPointerAxis.X) {
            pointerX = axisValue.getChildByName('value')?.getValue<number>();
          } else if (axis === DispatchedPointerAxis.Y) {
            pointerY = axisValue.getChildByName('value')?.getValue<number>();
          }
        });
        if (pointerX !== undefined && pointerY !== undefined) {
          pointers.push({x: pointerX, y: pointerY});
        }
      });
  }
  return {pointers, rays};
}

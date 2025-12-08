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

import {assertDefined} from 'common/assert';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {TraceRect} from 'tree_node/trace_rect';
import {TraceRectBuilder} from 'tree_node/trace_rect_builder';

class RectVcFactory {
  private static DEPTH_MAGNIFICATION = 4;

  makeNodeRect(
    node: HierarchyTreeNode,
    leftShift: number,
    topShift: number,
    scaleX: number,
    scaleY: number,
    newScaleX: number,
    newScaleY: number,
    depth: number,
  ): TraceRect {
    const nodeLeft = assertDefined(
      node.getEagerPropertyByName('left')?.getValue<number>(),
    );
    const nodeTranslationX = assertDefined(
      node.getEagerPropertyByName('translationX')?.getValue<number>(),
    );
    const nodeWidth = assertDefined(
      node.getEagerPropertyByName('width')?.getValue<number>(),
    );

    const nodeTop = assertDefined(
      node.getEagerPropertyByName('top')?.getValue<number>(),
    );
    const nodeTranslationY = assertDefined(
      node.getEagerPropertyByName('translationY')?.getValue<number>(),
    );
    const nodeHeight = assertDefined(
      node.getEagerPropertyByName('height')?.getValue<number>(),
    );

    const nodeAlpha =
      node.getEagerPropertyByName('alpha')?.getValue<number>() ?? 0;

    const rectLeft =
      leftShift +
      (nodeLeft + nodeTranslationX) * scaleX +
      (nodeWidth * (scaleX - newScaleX)) / 2;
    const rectTop =
      topShift +
      (nodeTop + nodeTranslationY) * scaleY +
      (nodeHeight * (scaleY - newScaleY)) / 2;

    const rect = new TraceRectBuilder()
      .setX(rectLeft)
      .setY(rectTop)
      .setWidth(nodeWidth * newScaleX)
      .setHeight(nodeHeight * newScaleY)
      .setId(node.id)
      .setName(node.name)
      .setGroupId(0)
      .setIsVisible(
        node.getEagerPropertyByName('isComputedVisible')?.getValue<boolean>() ??
          false,
      )
      .setIsDisplay(false)
      .setIsActiveDisplay(false)
      .setDepth(depth * RectVcFactory.DEPTH_MAGNIFICATION)
      .setOpacity(nodeAlpha)
      .setIsSpy(false)
      .build();

    return rect;
  }
}
/**
 * A factory for creating rects from a view capture hierarchy tree.
 */
export const rectsFactory = new RectVcFactory();

/**
 * A computation that adds rects to a view capture hierarchy tree.
 */
export class RectsComputation {
  private readonly rectsFactory = new RectVcFactory();
  private root: HierarchyTreeNode | undefined;

  setRoot(value: HierarchyTreeNode): this {
    this.root = value;
    return this;
  }

  executeInPlace(): void {
    if (!this.root) {
      throw new Error('root not set in VC rects computation');
    }

    this.addRects(this.root, 0, 0, 1, 1, 0);
  }

  private addRects(
    node: HierarchyTreeNode,
    leftShift: number,
    topShift: number,
    scaleX: number,
    scaleY: number,
    depth: number,
  ) {
    const newScaleX =
      scaleX *
      assertDefined(node.getEagerPropertyByName('scaleX')?.getValue<number>());
    const newScaleY =
      scaleY *
      assertDefined(node.getEagerPropertyByName('scaleY')?.getValue<number>());

    const rect = this.rectsFactory.makeNodeRect(
      node,
      leftShift,
      topShift,
      scaleX,
      scaleY,
      newScaleX,
      newScaleY,
      depth,
    );
    node.setRects([rect]);

    node.getAllChildren().forEach((child) => {
      this.addRects(
        child,
        rect.x -
          assertDefined(
            node.getEagerPropertyByName('scrollX')?.getValue<number>(),
          ),
        rect.y -
          assertDefined(
            node.getEagerPropertyByName('scrollY')?.getValue<number>(),
          ),
        newScaleX,
        newScaleY,
        depth + 1,
      );
    });
  }
}

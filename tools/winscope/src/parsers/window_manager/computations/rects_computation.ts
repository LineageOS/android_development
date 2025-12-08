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
import {Computation} from 'tree_node/computation';
import {HierarchyTreeNode} from 'tree_node/hierarchy_tree_node';
import {TraceRect} from 'tree_node/trace_rect';
import {TraceRectBuilder} from 'tree_node/trace_rect_builder';

class RectWmFactory {
  makeDisplayRect(
    display: HierarchyTreeNode,
    absoluteZ: number,
    focusedApp: string,
  ): TraceRect {
    const displayInfo = display.getEagerPropertyByName('displayInfo');
    const displayRectWidth =
      displayInfo?.getChildByName('logicalWidth')?.getValue<number>() ?? 0;
    const displayRectHeight =
      displayInfo?.getChildByName('logicalHeight')?.getValue<number>() ?? 0;

    const displayFocusedApp = display
      .getEagerPropertyByName('focusedApp')
      ?.getValue<string>();

    return new TraceRectBuilder()
      .setX(0)
      .setY(0)
      .setWidth(displayRectWidth)
      .setHeight(displayRectHeight)
      .setId(display.id)
      .setName(`Display - ${display.name}`)
      .setGroupId(
        assertDefined(display.getEagerPropertyByName('id')?.getValue<number>()),
      )
      .setIsVisible(false)
      .setIsDisplay(true)
      .setIsActiveDisplay(focusedApp === displayFocusedApp)
      .setDepth(absoluteZ)
      .setIsSpy(false)
      .build();
  }

  makeWindowStateRect(
    container: HierarchyTreeNode,
    absoluteZ: number,
  ): TraceRect | undefined {
    const displayId = container
      .getEagerPropertyByName('displayId')
      ?.getValue<number>();
    if (displayId === undefined) {
      return undefined;
    }

    const isVisible =
      container
        .getEagerPropertyByName('isComputedVisible')
        ?.getValue<boolean>() ?? false;

    const alpha =
      container
        .getEagerPropertyByName('attributes')
        ?.getChildByName('alpha')
        ?.getValue<number>() ?? 1;

    const frame = container
      .getEagerPropertyByName('windowFrames')
      ?.getChildByName('frame');
    if (frame === undefined || frame.getAllChildren().length === 0) {
      return undefined;
    }

    const rectLeft = assertDefined(
      frame.getChildByName('left')?.getValue<number>(),
    );
    const rectTop = assertDefined(
      frame.getChildByName('top')?.getValue<number>(),
    );
    const rectRight = assertDefined(
      frame.getChildByName('right')?.getValue<number>(),
    );
    const rectBottom = assertDefined(
      frame.getChildByName('bottom')?.getValue<number>(),
    );

    return new TraceRectBuilder()
      .setX(rectLeft)
      .setY(rectTop)
      .setWidth(rectRight - rectLeft)
      .setHeight(rectBottom - rectTop)
      .setId(container.id)
      .setName(container.name)
      .setGroupId(displayId)
      .setIsVisible(isVisible)
      .setIsDisplay(false)
      .setDepth(absoluteZ)
      .setOpacity(alpha)
      .setIsSpy(false)
      .build();
  }
}

/**
 * A computation that adds rects to a window manager hierarchy tree.
 */
export class RectsComputation implements Computation {
  private root: HierarchyTreeNode | undefined;
  private readonly rectsFactory = new RectWmFactory();

  setRoot(value: HierarchyTreeNode): this {
    this.root = value;
    return this;
  }

  executeInPlace(): void {
    if (!this.root) {
      throw new Error('root not set in WM rects computation');
    }

    const focusedApp = assertDefined(
      this.root.getEagerPropertyByName('focusedApp')?.getValue<string>(),
    );

    this.root.getAllChildren().forEach((displayContent) => {
      const displayRect = this.rectsFactory.makeDisplayRect(
        displayContent,
        0,
        focusedApp,
      );
      displayContent.setRects([displayRect]);

      let absoluteZ = 1;
      displayContent.getAllChildren().forEach((child) => {
        child.forEachNodeDfs((container) => {
          if (!container.id.startsWith('WindowState ')) return;

          const rect = this.rectsFactory.makeWindowStateRect(
            container,
            absoluteZ,
          );
          if (!rect) {
            return;
          }
          container.setRects([rect]);
          absoluteZ++;
        });
      });
    });
  }
}

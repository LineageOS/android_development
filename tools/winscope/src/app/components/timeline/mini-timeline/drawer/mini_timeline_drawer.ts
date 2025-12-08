/*
 * Copyright (C) 2023 The Android Open Source Project
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

import {Point} from 'common/geometry/point';
import {Padding} from 'common/padding';
import {Trace} from 'trace_api/trace';
import {CanvasMouseHandler} from './canvas_mouse_handler';

/**
 * An interface for drawing the mini timeline.
 */
export interface MiniTimelineDrawer {
  /**
   * Draws the mini timeline on the canvas.
   */
  draw(): Promise<void>;

  /**
   * Updates the hover effect on the mini timeline.
   *
   * @param mousePoint The current mouse position.
   */
  updateHover(mousePoint: Point | undefined): Promise<void>;

  /**
   * Gets the trace that was clicked on.
   *
   * @param mousePoint The position of the mouse click.
   */
  getTraceClicked(mousePoint: Point): Promise<Trace<object> | undefined>;

  /**
   * Gets the horizontal scale of the canvas.
   */
  getXScale(): number;

  /**
   * Gets the vertical scale of the canvas.
   */
  getYScale(): number;

  /**
   * Gets the height of the canvas.
   */
  getHeight(): number;

  /**
   * Gets the width of the canvas.
   */
  getWidth(): number;

  /**
   * Gets the padding of the canvas.
   */
  getPadding(): Padding;

  /**
   * Gets the usable range of the canvas.
   */
  getUsableRange(): {from: number; to: number};

  /**
   * Gets the click range for a given position.
   *
   * @param clickPos The position of the click.
   */
  getClickRange(clickPos: Point): {from: number; to: number};

  /**
   * The canvas element.
   */
  canvas: HTMLCanvasElement;

  /**
   * The mouse handler for the canvas.
   */
  handler: CanvasMouseHandler;
}

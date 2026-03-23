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

import {DraggableCanvasObject} from './draggable_canvas_object';

/**
 * A listener for drag events on a draggable canvas object.
 */
export type DragListener = (x: number, y: number) => void;

/**
 * A listener for drop events on a draggable canvas object.
 */
export type DropListener = DragListener;

/**
 * An interface for handling mouse events on a canvas.
 */
export interface CanvasMouseHandler {
  /**
   * Registers a draggable object with the mouse handler.
   *
   * @param draggableObject The object to register.
   * @param onDrag The listener for drag events.
   * @param onDrop The listener for drop events.
   */
  registerDraggableObject(
    draggableObject: DraggableCanvasObject,
    onDrag: DragListener,
    onDrop: DropListener,
  ): void;

  /**
   * Notifies the mouse handler that a draggable object has been drawn on top of other objects.
   *
   * @param draggableObject The object that has been drawn on top.
   */
  notifyDrawnOnTop(draggableObject: DraggableCanvasObject): void;
}

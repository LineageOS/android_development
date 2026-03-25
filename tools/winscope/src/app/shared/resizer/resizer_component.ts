/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {CommonModule} from '@angular/common';
import {Component, computed, effect, ElementRef, HostListener, Inject, input,} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MouseEventButton} from '@common/mouse_event_button';
import {Store} from '@common/store/store';

@Component({
  selector: 'resizer',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './resizer_component.ng.html',
  styleUrls: ['./resizer_component.scss'],
})
export class ResizerComponent {
  private draggingReverse = false;
  private initialSize = 0;
  private initialOffset = 0;
  private unsubscribeMouseMove?: () => void;
  private unsubscribeMouseUp?: () => void;

  dragAxis = input.required<'horizontal' | 'vertical'>();
  dependentView = input.required<HTMLElement>();
  minSize = input<number>(36);
  store = input<Store>();
  storeKey = input<string>();

  readonly isDraggingVertical = computed(() => {
    return this.dragAxis() === 'vertical';
  });

  constructor(
    @Inject(ElementRef) private readonly elementRef: ElementRef<HTMLElement>,
  ) {
    const storedSizeEffect = effect(() => {
      const store = this.store();
      const storeKey = this.storeKey();
      if (!store || !storeKey) {
        return;
      }

      const storedSize = store.get(storeKey);
      if (storedSize) {
        this.setDependentViewSize(Number(storedSize));
      }
      storedSizeEffect.destroy();
    });
  }

  ngOnDestroy() {
    this.unsubscribeFromMouseListeners();
    this.dependentView().style.flex = '';
  }

  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent) {
    if (event.button !== MouseEventButton.MAIN) {
      return;
    }
    const dependentView = this.dependentView();
    const position =
      this.elementRef.nativeElement.compareDocumentPosition(dependentView);
    const resizerBeforeDependentView = !!(
      position & Node.DOCUMENT_POSITION_PRECEDING
    );

    if (this.isDraggingVertical()) {
      this.draggingReverse = this.isDraggingReverse(
        this.elementRef.nativeElement.offsetTop,
        dependentView.offsetTop,
        resizerBeforeDependentView,
      );
    } else {
      this.draggingReverse = this.isDraggingReverse(
        this.elementRef.nativeElement.offsetLeft,
        dependentView.offsetLeft,
        resizerBeforeDependentView,
      );
    }

    this.initialSize = this.getDependentViewSize();
    this.initialOffset = this.getOffset(event);

    this.unsubscribeFromMouseListeners();
    const mouseMoveListener = (event: MouseEvent) => {
      this.onMouseMove(event);
    };
    document.addEventListener('mousemove', mouseMoveListener);
    this.unsubscribeMouseMove = () => {
      document.removeEventListener('mousemove', mouseMoveListener);
    };
    const mouseUpListener = (event: MouseEvent) => {
      this.onMouseUp(event);
    };
    document.addEventListener('mouseup', mouseUpListener);
    this.unsubscribeMouseUp = () => {
      document.removeEventListener('mouseup', mouseUpListener);
    };

    event.preventDefault();
  }

  private isDraggingReverse(
    resizerPos: number,
    dependentPos: number,
    resizerBeforeDependentView: boolean,
  ): boolean {
    return resizerPos === dependentPos
      ? resizerBeforeDependentView
      : resizerPos < dependentPos;
  }

  private onMouseMove(event: MouseEvent) {
    let diff = this.getOffset(event) - this.initialOffset;
    if (this.draggingReverse) {
      diff *= -1;
    }
    this.setDependentViewSize(this.initialSize + diff);
    event.preventDefault();
  }

  private onMouseUp(event: MouseEvent) {
    if (event.button === MouseEventButton.MAIN) {
      this.unsubscribeFromMouseListeners();
      this.onDependentViewResized();
    }
  }

  private onDependentViewResized() {
    const dependentViewSize = this.getDependentViewSize();
    if (dependentViewSize === this.initialSize) {
      return;
    }
    const store = this.store();
    const storeKey = this.storeKey();
    if (store && storeKey) {
      store.add(storeKey, dependentViewSize.toString());
    }
  }

  private getDependentViewSize(): number {
    const element = this.dependentView();
    return this.isDraggingVertical()
      ? element.offsetHeight
      : element.offsetWidth;
  }

  private setDependentViewSize(size: number) {
    const finalSize = Math.max(size, this.minSize());
    const style = this.dependentView().style;
    style.flex = '0 1 auto';
    if (this.isDraggingVertical()) {
      style.height = `${finalSize}px`;
    } else {
      style.width = `${finalSize}px`;
    }
  }

  private getOffset(event: MouseEvent): number {
    return this.isDraggingVertical() ? event.clientY : event.clientX;
  }

  private unsubscribeFromMouseListeners() {
    this.unsubscribeMouseMove?.();
    this.unsubscribeMouseUp?.();
  }
}

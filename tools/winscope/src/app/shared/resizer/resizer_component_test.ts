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

import {Component, effect, ElementRef, input, viewChild} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {MatIconModule} from '@angular/material/icon';
import {MouseEventButton} from '@common/mouse_event_button';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {Store} from '@common/store/store';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';

import {ResizerComponent} from './resizer_component';

describe('ResizerComponent', () => {
  const horizontal = 'horizontal';
  const vertical = 'vertical';

  let component: TestHostComponent;
  let dom: DOMTestHelper<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatIconModule, ResizerComponent, TestHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.detectChanges();
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('renders drag icon for horizontal drag axis', () => {
    dom.setComponentInput('dragAxis', horizontal);
    dom.detectChanges();
    expect(dom.find('.resizer:not(.drag-vertical)')).toBeDefined();
  });

  it('render rotated drag icon for vertical drag axis', () => {
    dom.setComponentInput('dragAxis', vertical);
    dom.detectChanges();
    expect(dom.find('.resizer.drag-vertical')).toBeDefined();
  });

  it('changes width of before view when dragging along horizontal drag axis', () => {
    checkResizeFromDrag(horizontal, true);
  });

  it('changes height of before view when dragging along vertical drag axis', () => {
    checkResizeFromDrag(vertical, true);
  });

  it('changes width of after view when dragging along horizontal drag axis', () => {
    checkResizeFromDrag(horizontal, false);
  });

  it('changes height of after view when dragging along vertical drag axis', () => {
    checkResizeFromDrag(vertical, false);
  });

  it('check resize capped at minimum size', () => {
    const view = component.getDependentView();
    const initialWidth = view.clientWidth;
    component.minSize = initialWidth - 5;
    dom.detectChanges();

    dom.get('resizer').dragElement(-10, 0);
    dom.detectChanges();
    checkDependentViewStyles(horizontal, initialWidth - 5);
  });

  it('does not resize if resizer is dragged with secondary mouse button', () => {
    dom.get('resizer').dragElement(10, 0, MouseEventButton.SECONDARY);
    dom.detectChanges();
    checkNoStylesApplied();
  });

  it('does not resize if resizer is clicked', () => {
    dom.get('resizer').click();
    dom.detectChanges();
    checkNoStylesApplied();
  });

  it('applies resize based on store and store key - horizontal drag axis', () => {
    checkResizeFromStore(horizontal);
  });

  it('applies resize based on store and store key - vertical drag axis', () => {
    checkResizeFromStore(vertical);
  });

  it('resets flex of dependent view on destroy', () => {
    const dependentView = component.getDependentView();
    dom.get('resizer').dragElement(-10, 0);
    dom.detectChanges();
    expect(dependentView.style.flex).toBe('0 1 auto');
    dom.destroy();
    expect(dependentView.style.flex).toBe('');
  });

  function checkResizeFromDrag(
    dragAxis: 'horizontal' | 'vertical',
    dependentViewBefore: boolean,
  ) {
    if (!dependentViewBefore) {
      spyOn(component, 'getDependentView').and.returnValue(
        component.afterView().nativeElement,
      );
    }

    const isHoriz = dragAxis === horizontal;
    changeDragAxis(dragAxis);

    const view = component.getDependentView();
    const initial = isHoriz ? view.clientWidth : view.clientHeight;
    const resizer = dom.get('resizer');

    const delta = 10;
    const sizeDiff = dependentViewBefore ? delta : -1 * delta;
    resizer.dragElement(isHoriz ? delta : 0, isHoriz ? 0 : delta);
    dom.detectChanges();
    checkDependentViewStyles(dragAxis, initial + sizeDiff);

    resizer.dragElement(isHoriz ? -delta : 0, isHoriz ? 0 : -delta);
    dom.detectChanges();
    checkDependentViewStyles(dragAxis, initial);
  }

  function checkResizeFromStore(dragAxis: 'horizontal' | 'vertical') {
    changeDragAxis(dragAxis);
    checkNoStylesApplied();

    const store = new InMemoryStorage();
    component.store = store;
    dom.detectChanges();
    checkNoStylesApplied();

    component.store = undefined;
    component.storeKey = 'test';
    dom.detectChanges();
    checkNoStylesApplied();

    store.add('test', '123');
    component.store = store;
    dom.detectChanges();
    checkDependentViewStyles(dragAxis, 123);
  }

  function changeDragAxis(dragAxis: 'horizontal' | 'vertical') {
    dom.setComponentInput('dragAxis', dragAxis);
    dom.detectChanges();
  }

  function checkNoStylesApplied() {
    const dependentView = component.getDependentView();
    expect(dependentView.style.flex).toBe('');
    expect(dependentView.style.width).toBe('');
    expect(dependentView.style.height).toBe('');
  }

  function checkDependentViewStyles(
    dragAxis: 'horizontal' | 'vertical',
    size: number,
  ) {
    const dependentView = component.getDependentView();
    expect(dependentView.style.flex).toBe('0 1 auto');
    expect(dependentView.style.width).toBe(
      dragAxis === horizontal ? size + 'px' : '',
    );
    expect(dependentView.style.height).toBe(
      dragAxis === vertical ? size + 'px' : '',
    );
  }

  @Component({
    selector: 'host-component',
    standalone: true,
    template: `
      <div [style.display]="'flex'" #container>
        <div #before>before</div>
        <resizer
          [dragAxis]="dragAxis()"
          [dependentView]="getDependentView()"
          [minSize]="minSize"
          [store]="store"
          [storeKey]="storeKey">
        </resizer>
        <div #after>after</div>
      </div>
    `,
    imports: [ResizerComponent],
  })
  class TestHostComponent {
    dragAxis = input<'horizontal' | 'vertical'>(horizontal);

    container = viewChild.required<ElementRef<HTMLElement>>('container');
    beforeView = viewChild.required<ElementRef<HTMLElement>>('before');
    afterView = viewChild.required<ElementRef<HTMLElement>>('after');

    minSize = 0;
    store: Store | undefined;
    storeKey: string | undefined;

    getDependentView(): HTMLElement {
      return this.beforeView().nativeElement;
    }

    constructor() {
      effect(() => {
        const dragAxis = this.dragAxis();
        const container = this.container().nativeElement;
        if (dragAxis === horizontal) {
          container.style.flexDirection = 'row';
        } else {
          container.style.flexDirection = 'column';
        }
      });
    }
  }
});

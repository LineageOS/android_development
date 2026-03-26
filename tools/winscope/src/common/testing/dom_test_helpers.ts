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

import {Type} from '@angular/core';
import {ComponentFixture} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {assertDefined} from '@common/assert';
import {KeyboardEventCode, KeyboardEventKey, KeyboardEventKeyCode,} from '@common/dom';
import {MouseEventButton} from '@common/mouse_event_button';

export class DOMTestHelper<T> {
  constructor(
    private fixture: ComponentFixture<T>,
    private root: HTMLElement,
  ) {}

  detectChanges() {
    this.fixture.detectChanges();
  }

  async whenStable() {
    await this.fixture.whenStable();
  }

  async whenRenderingDone() {
    await this.fixture.whenRenderingDone();
  }

  async detectChangesAndWaitStable() {
    this.detectChanges();
    await this.whenStable();
  }

  async detectChangesAndRenderingDone() {
    this.detectChanges();
    await this.whenRenderingDone();
  }

  find(selector: string): DOMTestHelper<T> | undefined {
    const element = this.root.querySelector<HTMLElement>(selector);
    return element ? new DOMTestHelper(this.fixture, element) : undefined;
  }

  findAll(selector: string): Array<DOMTestHelper<T>> {
    const helpers: Array<DOMTestHelper<T>> = [];
    this.root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      helpers.push(new DOMTestHelper(this.fixture, el));
    });
    return helpers;
  }

  findByDirective<T>(component: Type<T>): T | undefined {
    return (
      this.fixture.debugElement.query(By.directive(component))
        ?.componentInstance ?? undefined
    );
  }

  findAllByDirective<T>(component: Type<T>): T[] {
    return this.fixture.debugElement
      .queryAll(By.directive(component))
      .map((el) => {
        return el.componentInstance;
      });
  }

  findInDocument(selector: string): DOMTestHelper<T> | undefined {
    const element = document.querySelector<HTMLElement>(selector);
    return element ? new DOMTestHelper(this.fixture, element) : undefined;
  }

  get(selector: string): DOMTestHelper<T> {
    return assertDefined(this.find(selector));
  }

  getInDocument(selector: string): DOMTestHelper<T> {
    return assertDefined(this.findInDocument(selector));
  }

  click() {
    this.root.click();
    this.detectChanges();
  }

  openContextMenu() {
    this.root.dispatchEvent(new MouseEvent('contextmenu'));
    this.detectChanges();
  }

  shiftAndClick() {
    const shiftAndClick = new MouseEvent('click', {shiftKey: true});
    this.dispatchEvent(shiftAndClick);
  }

  doubleClick() {
    this.root.dispatchEvent(new MouseEvent('dblclick'));
    this.detectChanges();
  }

  findAndClick(selector: string): DOMTestHelper<T> {
    const element = this.get(selector);
    element.click();
    return element;
  }

  findAndClickByIndex(selector: string, index: number): DOMTestHelper<T> {
    const element = this.findAll(selector)[index];
    element.click();
    return element;
  }

  findAndClickInDocument(selector: string): DOMTestHelper<T> {
    const element = this.getInDocument(selector);
    element.click();
    return element;
  }

  async clickAndWaitStable(selector: string) {
    const element = this.get(selector);
    element.click();
    await this.whenStable();
  }

  async clickByIndexAndWaitStable(selector: string, index: number) {
    const element = this.findAll(selector)[index];
    element.click();
    await this.whenStable();
  }

  async clickLastAndWaitStable(selector: string) {
    const elements = this.findAll(selector);
    const element = elements[elements.length - 1];
    element.click();
    await this.whenStable();
  }

  clickBackdrop() {
    this.findAndClickInDocument('.cdk-overlay-backdrop');
  }

  findAndDispatchInput(field: string, value: string): DOMTestHelper<T> {
    const input = this.get(field + ' input');
    input.dispatchInput(value);
    return input;
  }

  dispatchInput(value: string) {
    if (
      !(
        this.root instanceof HTMLInputElement ||
        this.root instanceof HTMLTextAreaElement
      )
    ) {
      throw new Error('cannot dispatch input on node ' + this.root.nodeName);
    }
    this.root.value = value;
    this.root.dispatchEvent(new Event('input'));
    this.detectChanges();
  }

  isMatSelectOpen(): boolean {
    return (
      this.findInDocument('.mat-mdc-select-panel') !== undefined ||
      this.findInDocument('.mat-select-panel') !== undefined
    );
  }

  async openMatSelect() {
    const trigger =
      this.find('.mat-select-trigger') ?? this.get('.mat-mdc-select-trigger');
    trigger.click();
    await trigger.whenStable();
  }

  clickMatOption() {
    const panel = this.getMatSelectPanel();
    panel.findAndClick('mat-option');
  }

  getMatSelectPanel(): DOMTestHelper<T> {
    return (
      this.findInDocument('.mat-select-panel') ??
      this.getInDocument('.mat-mdc-select-panel')
    );
  }

  findMatTooltipPanel(): DOMTestHelper<T> | undefined {
    return (
      this.findInDocument('.mat-tooltip-panel') ??
      this.findInDocument('.mat-mdc-tooltip-panel')
    );
  }

  getSnackBar(): DOMTestHelper<T> {
    return this.getInDocument('snack-bar');
  }

  addEventListener(event: string, listener: (event: Event) => void) {
    this.root.addEventListener(event, listener);
  }

  keydownEnter(init?: KeyboardEventInit) {
    const params = {key: KeyboardEventKey.ENTER};
    Object.assign(params, init);
    const event = new KeyboardEvent('keydown', params);
    this.dispatchEvent(event);
  }

  keydownEsc() {
    this.keydownByKey(KeyboardEventKey.ESCAPE);
  }

  keydownSpace() {
    const event = new KeyboardEvent('keydown', {
      keyCode: KeyboardEventKeyCode.SPACE,
      bubbles: true,
    });
    this.dispatchEvent(event);
  }

  keydownMediaTrackNext(toDocument = false) {
    this.keydownByKey(KeyboardEventKey.MEDIA_TRACK_NEXT, toDocument);
  }

  keydownMediaTrackPrevious(toDocument = false) {
    this.keydownByKey(KeyboardEventKey.MEDIA_TRACK_PREVIOUS, toDocument);
  }

  keydownArrowLeft(toDocument = false, target?: HTMLElement) {
    this.keydownByKey(KeyboardEventKey.ARROW_LEFT, toDocument, target);
  }

  keydownArrowRight(toDocument = false, target?: HTMLElement) {
    this.keydownByKey(KeyboardEventKey.ARROW_RIGHT, toDocument, target);
  }

  keydownArrowUp(toDocument = false, target?: HTMLElement) {
    this.keydownByKey(KeyboardEventKey.ARROW_UP, toDocument, target);
  }

  keydownArrowDown(toDocument = false) {
    this.keydownByKey(KeyboardEventKey.ARROW_DOWN, toDocument);
  }

  keydownCtrlAToSelectPanel() {
    const keydownCtrlA = new KeyboardEvent('keydown', {
      code: KeyboardEventCode.A,
      ctrlKey: true,
    });
    const panel = this.getMatSelectPanel();
    panel.dispatchEvent(keydownCtrlA);
  }

  focusOut() {
    this.dispatchEvent(new FocusEvent('focusout'));
  }

  dragElement(x: number, y: number, button = MouseEventButton.MAIN) {
    const {left, top} = this.root.getBoundingClientRect();
    this.dispatchMouseEvent(this.root, 'mousedown', left, top, 0, 0, button);
    this.dispatchMouseEvent(document, 'mousemove', left + 1, top, 1, y, button);
    this.dispatchMouseEvent(
      document,
      'mousemove',
      left + x,
      top + y,
      x,
      y,
      button,
    );
    this.dispatchMouseEvent(
      document,
      'mouseup',
      left + x,
      top + y,
      x,
      y,
      button,
    );
  }

  dispatchEvent(event: Event) {
    this.root.dispatchEvent(event);
    this.detectChanges();
  }

  dispatchEventInDocument(event: Event) {
    document.dispatchEvent(event);
    this.detectChanges();
  }

  getHTMLElement<T extends HTMLElement>() {
    return this.root as T;
  }

  getText(): string | undefined {
    return this.root.textContent?.trim() ?? undefined;
  }

  checkText(value: string) {
    expect(this.getText() ?? '').toContain(value);
  }

  checkTextExact(value: string) {
    expect(this.getText()).toEqual(value);
  }

  checkInnerHTML(value: string, isPresent = true) {
    if (isPresent) {
      expect(this.root.innerHTML).toContain(value);
    } else {
      expect(this.root.innerHTML).not.toContain(value);
    }
  }

  checkClassName(value: string, isPresent = true) {
    if (isPresent) {
      expect(this.root.className).toContain(value);
    } else {
      expect(this.root.className).not.toContain(value);
    }
  }

  checkClassNameExact(value: string, isPresent = true) {
    if (isPresent) {
      expect(this.root.className).toEqual(value);
    } else {
      expect(this.root.className).not.toEqual(value);
    }
  }

  checkInputChecked(value: boolean) {
    expect(this.root).toBeInstanceOf(HTMLInputElement);
    expect((this.root as HTMLInputElement).checked).toEqual(value);
  }

  checkDisabled(value: boolean) {
    if (!value && !('disabled' in this.root)) {
      return;
    }
    expect('disabled' in this.root).toBeTrue();
    expect((this.root as HTMLInputElement).disabled).toEqual(value);
  }

  checkValue(value: string) {
    const hasValue = 'value' in this.root;
    if (hasValue) {
      expect((this.root as HTMLInputElement).value).toEqual(value);
    } else {
      expect(value.length).toBe(0);
    }
  }

  updateValue(value: string) {
    (this.root as HTMLInputElement).value = value;
  }

  checkSectionCollapseAndExpand(selector: string, sectionTitle: string) {
    const section = this.get(selector);
    section
      .get('collapsible-section-title .section-title')
      .checkTextExact(sectionTitle);
    section.findAndClick('collapsible-section-title button');
    section.checkClassName('collapsed');
    const collapsedSection = this.get('collapsed-sections .collapsed-section');
    collapsedSection.checkTextExact(sectionTitle + '  arrow_right');
    collapsedSection.click();
    this.checkNoCollapsedSectionButtons();
  }

  checkNoCollapsedSectionButtons() {
    const collapsedSections = this.get('collapsed-sections');
    expect(collapsedSections.find('.collapsed-section')).toBeUndefined();
  }

  async hover(): Promise<void> {
    this.dispatchEvent(
      new MouseEvent('mouseenter', {bubbles: true, cancelable: true}),
    );
    this.dispatchEvent(
      new MouseEvent('mouseover', {bubbles: true, cancelable: true}),
    );
    await this.detectChangesAndRenderingDone();
  }

  async unhover(): Promise<void> {
    this.dispatchEvent(
      new MouseEvent('mouseleave', {bubbles: true, cancelable: true}),
    );
    this.dispatchEvent(
      new MouseEvent('mouseout', {bubbles: true, cancelable: true}),
    );
    await this.detectChangesAndRenderingDone();
  }

  async checkTooltip(text: string | undefined) {
    this.dispatchEvent(new Event('mouseenter'));
    await this.detectChangesAndWaitStable();
    await this.whenRenderingDone();

    const panel = this.findMatTooltipPanel();
    if (text !== undefined) {
      assertDefined(panel).checkText(text);
    } else {
      expect(panel).toBeUndefined();
    }
    this.dispatchEvent(new Event('mouseleave'));
    await this.detectChangesAndWaitStable();
    await this.whenRenderingDone();

    if (panel) {
      // tooltip hide animation must be manually ended for the tooltip to be
      // removed from the DOM
      const animationEnd = new AnimationEvent('animationend', {
        animationName: 'mat-mdc-tooltip-hide',
      });
      panel.get('.mat-mdc-tooltip-hide').dispatchEvent(animationEnd);
      await this.detectChangesAndWaitStable();
      await this.whenRenderingDone();
      expect(this.findMatTooltipPanel()).toBeUndefined();
    }
  }

  setComponentInput(name: string, value: unknown) {
    this.fixture.componentRef.setInput(name, value);
  }

  destroy() {
    this.fixture.destroy();
  }

  private dispatchMouseEvent(
    source: Node,
    type: string,
    screenX: number,
    screenY: number,
    clientX: number,
    clientY: number,
    button = MouseEventButton.MAIN,
  ) {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: false,
      composed: true,
      view: window,
      detail: 1,
      screenX,
      screenY,
      clientX,
      clientY,
      buttons: 1,
      button,
    });
    source.dispatchEvent(event);
    this.detectChanges();
  }

  private keydownByKey(key: string, toDocument = false, target?: HTMLElement) {
    const event = new KeyboardEvent('keydown', {key});
    if (target) {
      spyOnProperty(event, 'target').and.returnValue(target);
    }
    if (toDocument) {
      this.dispatchEventInDocument(event);
    } else {
      this.dispatchEvent(event);
    }
  }
}

export async function checkTooltips<T>(
  elements: Array<DOMTestHelper<T>>,
  expTooltips: Array<string | undefined>,
) {
  for (const [index, el] of elements.entries()) {
    await el.checkTooltip(expTooltips[index]);
  }
}

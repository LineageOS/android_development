/*
 * Copyright (C) 2022 The Android Open Source Project
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

import {Component, ComponentRef, ElementRef, Inject, Type} from '@angular/core';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent} from '@messaging/winscope_event_emitter';
import {Trace} from '@trace_api/trace';
import {ViewType} from '@ui/shared/viewers/viewer';

import {AngularViewer, ViewerComponent} from './angular_viewer';

@Component({
  selector: 'viewer-stub',
  template: `<div>{{text}}</div>`,
})
class ViewerStubComponent implements ViewerComponent {
  text = '';
  constructor(
    @Inject(ElementRef) readonly elementRef: ElementRef<HTMLElement>,
  ) {}
}

export class ViewerStub implements AngularViewer {
  private readonly traces: Array<Trace<unknown>> = [];
  private title: string;
  private viewContent?: string;
  private viewType: ViewType;
  private emitAppEvent: EmitEvent = () => Promise.resolve();

  constructor(
    title: string,
    viewContent?: string,
    trace?: Trace<unknown>,
    viewType?: ViewType,
  ) {
    this.title = title;
    this.viewContent = viewContent;
    if (trace) this.traces = [trace];

    this.viewType = viewType ?? ViewType.TRACE_TAB;
  }

  onWinscopeEvent(_: WinscopeEvent): Promise<void> {
    return Promise.resolve();
  }

  setEmitEvent(callback: EmitEvent) {
    this.emitAppEvent = callback;
  }

  setComponentRef(componentRef: ComponentRef<ViewerStubComponent>): void {
    componentRef.instance.text = this.viewContent ?? '';
    componentRef.changeDetectorRef.detectChanges();
  }

  onShow(): void {
    // do nothing
  }

  onHide(): void {
    // do nothing
  }

  async emitAppEventForTesting(event: WinscopeEvent) {
    await this.emitAppEvent(event);
  }

  getTitle(): string {
    return this.title;
  }

  getComponentType(): Type<ViewerComponent> {
    return ViewerStubComponent;
  }

  getViewType(): ViewType {
    return this.viewType ?? ViewType.TRACE_TAB;
  }

  getTraces(): Array<Trace<unknown>> {
    return this.traces;
  }

  onDestroy() {
    // do nothing
  }
}

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

import {ComponentRef, Type} from '@angular/core';
import {assertDefined} from '@common/assert';
import {Store} from '@common/store/store';
import {TimestampConverter} from '@common/time/timestamp_converter';
import {WinscopeEvent} from '@messaging/winscope_event';
import {EmitEvent} from '@messaging/winscope_event_emitter';
import {Trace} from '@trace_api/trace';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {Traces} from '@trace_api/traces';
import {ViewType} from '@ui/shared/viewers/viewer';

import {AngularViewer, ViewerComponent} from './angular_viewer';

export interface Presenter {
  onAppEvent(event: WinscopeEvent): Promise<void>;
  setEmitEvent(callback: EmitEvent): void;
  notifyViewChanged(): void;
  onDestroy(): void;
}

export abstract class AbstractViewer<
  TraceEntryType,
  UiDataType,
  PresenterType extends Presenter = Presenter,
> implements AngularViewer {
  protected readonly trace: Trace<TraceEntryType> | undefined;
  protected readonly presenter: PresenterType;
  private readonly title: string;
  private readonly componentType: Type<ViewerComponent>;
  protected componentRef: ComponentRef<ViewerComponent> | undefined;

  constructor(
    trace: Trace<TraceEntryType> | undefined,
    traces: Traces,
    componentType: Type<ViewerComponent>,
    store: Store,
    timestampConverter?: TimestampConverter,
  ) {
    this.trace = trace;
    this.title = TRACE_INFO[this.getTraceTypeForViewTitle()].name;
    this.componentType = componentType;
    const notifyViewCallback = (uiData: UiDataType) => {
      const component = this.componentRef;
      if (!component) {
        return;
      }
      component.setInput('inputData', uiData);
      component.setInput('store', store);
    };
    this.presenter = this.createPresenter(
      trace,
      traces,
      store,
      notifyViewCallback,
      timestampConverter,
    );
  }

  setComponentRef(componentRef: ComponentRef<ViewerComponent>) {
    this.componentRef = componentRef;
    this.addOutputListeners(componentRef.instance, () =>
      componentRef.changeDetectorRef.detectChanges(),
    );
    this.presenter.notifyViewChanged();
  }

  onShow() {
    if (!this.componentRef) {
      return;
    }
    this.componentRef.instance.elementRef.nativeElement.style.display = '';
    this.componentRef.changeDetectorRef.detectChanges();
  }

  onHide() {
    if (!this.componentRef) {
      return;
    }
    this.componentRef.instance.elementRef.nativeElement.style.display = 'none';
    this.componentRef.changeDetectorRef.detectChanges();
  }

  setEmitEvent(callback: EmitEvent) {
    this.presenter.setEmitEvent(callback);
  }

  async onWinscopeEvent(event: WinscopeEvent) {
    await this.presenter.onAppEvent(event);
  }

  getTitle(): string {
    return this.title;
  }

  getComponentType(): Type<ViewerComponent> {
    return this.componentType;
  }

  getTraces(): Array<Trace<unknown>> {
    return [assertDefined(this.trace)];
  }

  getViewType(): ViewType {
    return ViewType.TRACE_TAB;
  }

  onDestroy() {
    this.presenter.onDestroy();
    this.onViewerDestroy();
  }

  protected getTraceTypeForViewTitle(): TraceType {
    return assertDefined(this.trace).type;
  }

  protected onViewerDestroy() {
    // do nothing
  }

  protected abstract createPresenter(
    trace: Trace<TraceEntryType> | undefined,
    traces: Traces,
    store: Store,
    notifyViewCallback: (uiData: UiDataType) => void,
    timestampConverter?: TimestampConverter,
  ): PresenterType;

  protected abstract addOutputListeners(
    _: ViewerComponent,
    _changeDetectorCallback: () => void,
  ): void;
}

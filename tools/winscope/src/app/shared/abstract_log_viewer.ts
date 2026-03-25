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

import {LogViewerComponent} from '@app/shared/log_view/log_viewer_component';
import {isElementVisible, isInputTextField, KeyboardEventKey,} from '@common/dom';
import {AbstractLogViewerPresenter} from '@ui/shared/log/abstract_log_viewer_presenter';
import {UiDataLog} from '@ui/shared/log/ui_data_log';

import {AbstractViewer} from './abstract_viewer';

export abstract class AbstractLogViewer<
  TraceEntryType,
  UiDataType extends UiDataLog,
  PresenterType extends AbstractLogViewerPresenter<UiDataType, TraceEntryType>,
> extends AbstractViewer<TraceEntryType, UiDataType, PresenterType> {
  protected readonly hasProperties: boolean = true;
  private handleKeyDown: undefined | ((event: KeyboardEvent) => Promise<void>);

  protected override addOutputListeners(
    component: LogViewerComponent<UiDataType>,
    changeDetectorCallback: () => void,
  ) {
    component.onLogFilterChange.subscribe(async (detail) => {
      await this.presenter.onSelectFilterChange(detail.header, detail.value);
    });
    component.onLogTextFilterChange.subscribe(async (detail) => {
      await this.presenter.onTextFilterChange(detail.header, detail.filter);
    });
    component.onLogEntryClick.subscribe(async (index) => {
      await this.presenter.onLogEntryClick(index);
    });
    component.onTimestampClick.subscribe(async (detail) => {
      await this.presenter.onTimestampClick(detail);
    });
    component.onArrowDownPress.subscribe(async () => {
      await this.presenter.onArrowDownPress();
    });
    component.onArrowUpPress.subscribe(async () => {
      await this.presenter.onArrowUpPress();
    });

    const htmlElement = component.elementRef.nativeElement;
    this.handleKeyDown = async (event: KeyboardEvent) => {
      const isViewerVisible = isElementVisible(htmlElement);
      const keydownOnInputField =
        event.target instanceof HTMLElement && isInputTextField(event.target);
      const isPositionChange =
        event.key === KeyboardEventKey.ARROW_RIGHT ||
        event.key === KeyboardEventKey.ARROW_LEFT;
      if (!isViewerVisible || keydownOnInputField || !isPositionChange) {
        return;
      }
      event.preventDefault();
      await this.presenter.onPositionChangeByKeyPress(event);
      changeDetectorCallback();
    };
    document.addEventListener('keydown', this.handleKeyDown);

    if (this.hasProperties) {
      component.onPropertiesFilterChange.subscribe(async (detail) => {
        await this.presenter.onPropertiesFilterChange(detail);
      });
      component.onPropertiesUserOptionsChange.subscribe(async (detail) => {
        await this.presenter.onPropertiesUserOptionsChange(detail);
      });
    }

    this.addViewerSpecificListeners(component);
  }

  protected addViewerSpecificListeners(_: LogViewerComponent<UiDataType>) {
    // Do nothing
  }

  protected override onViewerDestroy() {
    if (this.handleKeyDown) {
      document.removeEventListener('keydown', this.handleKeyDown);
    }
  }
}

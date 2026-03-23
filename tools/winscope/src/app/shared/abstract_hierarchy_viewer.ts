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

import {HierarchyViewerComponent} from '@app/shared/hierarchy/hierarchy_viewer_component';
import {AbstractHierarchyViewerPresenter} from '@ui/shared/hierarchy/abstract_hierarchy_viewer_presenter';
import {UiDataHierarchy} from '@ui/shared/hierarchy/ui_data_hierarchy';

import {AbstractViewer} from './abstract_viewer';

export abstract class AbstractHierarchyViewer<
  TraceEntryType,
  UiDataType extends UiDataHierarchy,
  PresenterType extends AbstractHierarchyViewerPresenter<UiDataType>,
> extends AbstractViewer<TraceEntryType, UiDataType, PresenterType> {
  protected readonly hasRects: boolean = true;

  protected override addOutputListeners(
    component: HierarchyViewerComponent<UiDataType>,
  ) {
    component.onHierarchyPinnedChange.subscribe((detail) => {
      this.presenter.onPinnedItemChange(detail);
    });
    component.onHighlightedIdChange.subscribe(async (detail) => {
      await this.presenter.onHighlightedIdChange(detail);
    });
    component.onHighlightedPropertyChange.subscribe((detail) => {
      this.presenter.onHighlightedPropertyChange(detail);
    });
    component.onHierarchyUserOptionsChange.subscribe(async (detail) => {
      await this.presenter.onHierarchyUserOptionsChange(detail);
    });
    component.onHierarchyFilterChange.subscribe(async (detail) => {
      await this.presenter.onHierarchyFilterChange(detail);
    });
    component.onPropertiesUserOptionsChange.subscribe(async (detail) => {
      await this.presenter.onPropertiesUserOptionsChange(detail);
    });
    component.onPropertiesFilterChange.subscribe(async (detail) => {
      await this.presenter.onPropertiesFilterChange(detail);
    });
    component.onHighlightedNodeChange.subscribe(async (detail) => {
      await this.presenter.onHighlightedNodeChange(detail);
    });

    if (this.hasRects) {
      component.onRectsUserOptionsChange.subscribe((detail) => {
        this.presenter.onRectsUserOptionsChange(detail);
      });
      component.onRectShowStateChange.subscribe(async (detail) => {
        await this.presenter.onRectShowStateChange(detail.rectId, detail.state);
      });
    }

    this.addViewerSpecificListeners(component);
  }

  protected addViewerSpecificListeners(
    _: HierarchyViewerComponent<UiDataType>,
  ) {
    // Do nothing
  }
}

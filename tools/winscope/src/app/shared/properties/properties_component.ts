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
import {CommonModule} from '@angular/common';
import {Component, computed, ElementRef, Inject, input, output, TemplateRef, viewChild,} from '@angular/core';
import {MatDividerModule} from '@angular/material/divider';
import {CollapsibleSectionTitleComponent} from '@app/shared/collapsible_sections/collapsible_section_title_component';
import {SearchBoxComponent} from '@app/shared/search_box/search_box_component';
import {TreeComponent} from '@app/shared/tree/tree_component';
import {UserOptionsComponent} from '@app/shared/user_options/user_options_component';
import {PersistentStore} from '@common/store/persistent_store';
import {Analytics} from '@logging/analytics';
import {TraceType} from '@trace_api/trace_type';
import {CollapsibleSectionType} from '@ui/shared/collapsible_sections/collapsible_section_type';
import {CuratedProperties} from '@ui/shared/properties/curated_properties';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';
import {TimestampClickDetail} from '@ui/shared/viewers/viewer_event_details';

import {PropertyTreeNodeDataViewComponent} from './property_tree_node_data_view_component';
import {PropertyNodeHeightPredictor} from './property_tree_node_height_predictor';

@Component({
  selector: 'properties-view',
  standalone: true,
  imports: [
    CommonModule,
    MatDividerModule,
    CollapsibleSectionTitleComponent,
    SearchBoxComponent,
    UserOptionsComponent,
    TreeComponent,
    PropertyTreeNodeDataViewComponent,
  ],
  templateUrl: './properties_component.ng.html',
  styleUrls: ['properties_component.scss'],
})
export class PropertiesComponent {
  Analytics = Analytics;
  CollapsibleSectionType = CollapsibleSectionType;

  nodeRows = input.required<Array<FlattenedTreeRow<UiPropertyTreeNode>>>();
  title = input('PROPERTIES');
  userOptions = input<UserOptions>({});
  placeholderText = input('');
  highlightedProperty = input('');
  curatedProperties = input<CuratedProperties>();
  isProtoDump = input(false);
  traceType = input<TraceType>();
  store = input<PersistentStore>();
  textFilter = input<TextFilter>();
  curatedPropertiesView = input<TemplateRef<unknown>>();

  collapseButtonClicked = output();
  readonly filterChange = output<TextFilter>();
  readonly optionsChange = output<UserOptions>();
  readonly highlightedPropertyChange = output<string>();
  readonly timestampClick = output<TimestampClickDetail>();
  readonly propagatePropertyClick = output<UiPropertyTreeNode>();

  readonly hasUserOptions = computed(() => {
    return Object.keys(this.userOptions()).length > 0;
  });

  readonly showPlaceholderText = computed(() => {
    return (
      this.nodeRows().length === 0 &&
      !this.curatedProperties() &&
      !!this.placeholderText()
    );
  });

  readonly heightPredictor = new PropertyNodeHeightPredictor(
    this.elementRef,
    (index: number) => {
      return this.tree()?.filteredRows.at(index);
    },
  );

  private readonly tree = viewChild(TreeComponent<UiPropertyTreeNode>);

  constructor(
    @Inject(ElementRef) private readonly elementRef: ElementRef<HTMLElement>,
  ) {}

  onFilterChange(detail: TextFilter) {
    this.filterChange.emit(detail);
  }

  onHighlightedPropertyChange(newNode: UiPropertyTreeNode) {
    this.highlightedPropertyChange.emit(newNode.id);
  }

  onTimestampClick(event: TimestampClickDetail) {
    this.timestampClick.emit(event);
  }

  onPropagatePropertyClick(node: UiPropertyTreeNode) {
    this.propagatePropertyClick.emit(node);
  }

  showCuratedView(): boolean {
    return (
      this.curatedPropertiesView() !== undefined &&
      this.curatedProperties() !== undefined &&
      this.textFilter()?.filterString === '' &&
      !this.userOptions()['showDiff']?.enabled
    );
  }

  showPropertiesTree(): boolean {
    return this.nodeRows().length > 0 && !this.showCuratedView();
  }
}

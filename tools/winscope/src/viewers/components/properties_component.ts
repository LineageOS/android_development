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
import {Component, computed, ElementRef, Inject, input, output,} from '@angular/core';
import {MatDividerModule} from '@angular/material/divider';
import {PersistentStore} from '@common/store/persistent_store';
import {Analytics} from '@logging/analytics';
import {TraceType} from '@trace_api/trace_type';
import {CollapsibleSectionType} from '@viewers/common/collapsible_section_type';
import {CuratedProperties} from '@viewers/common/curated_properties';
import {FlattenedTreeRow} from '@viewers/common/flattened_tree_row';
import {TextFilter} from '@viewers/common/text_filter';
import {UiPropertyTreeNode} from '@viewers/common/ui_property_tree_node';
import {UserOptions} from '@viewers/common/user_options';
import {TimestampClickDetail} from '@viewers/common/viewer_event_details';

import {CollapsibleSectionTitleComponent} from './collapsible_section_title_component';
import {SearchBoxComponent} from './search_box_component';
import {TreeComponent} from './tree_component';
import {UserOptionsComponent} from './user_options_component';
import {ViewCapturePropertyGroupsComponent} from './view_capture_property_groups_component';

@Component({
  selector: 'properties-view',
  standalone: true,
  imports: [
    CommonModule,
    MatDividerModule,
    CollapsibleSectionTitleComponent,
    SearchBoxComponent,
    UserOptionsComponent,
    ViewCapturePropertyGroupsComponent,
    TreeComponent,
  ],
  templateUrl: './properties_component.ng.html',
  styleUrls: ['properties_component.css'],
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

  constructor(@Inject(ElementRef) private elementRef: ElementRef) {}

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

  showViewCaptureFormat(): boolean {
    return (
      this.traceType() === TraceType.VIEW_CAPTURE &&
      this.textFilter()?.filterString === '' &&
      // Todo: Highlight Inline in formatted ViewCapture Properties Component.
      !this.userOptions()['showDiff']?.enabled &&
      this.curatedProperties() !== undefined
    );
  }

  showPropertiesTree(): boolean {
    return this.nodeRows().length > 0 && !this.showViewCaptureFormat();
  }
}

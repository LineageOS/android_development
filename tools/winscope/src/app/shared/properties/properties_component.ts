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
import {CollapsibleSectionTitleComponent} from '@app/shared/collapsible_sections/collapsible_section_title_component';
import {TreeComponent} from '@app/shared/hierarchy/tree_component';
import {SearchBoxComponent} from '@app/shared/search_box/search_box_component';
import {UserOptionsComponent} from '@app/shared/user_options/user_options_component';
import {ViewCapturePropertyGroupsComponent} from '@app/view_capture/view_capture_property_groups_component';
import {PersistentStore} from '@common/store/persistent_store';
import {Analytics} from '@logging/analytics';
import {TraceType} from '@trace_api/trace_type';
import {CollapsibleSectionType} from '@ui/shared/collapsible_sections/collapsible_section_type';
import {FlattenedTreeRow} from '@ui/shared/hierarchy/flattened_tree_row';
import {CuratedProperties} from '@ui/shared/properties/curated_properties';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {TextFilter} from '@ui/shared/text_filter';
import {UserOptions} from '@ui/shared/user_options';
import {TimestampClickDetail} from '@ui/shared/viewer_event_details';

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

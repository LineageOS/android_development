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
import {
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import {MatDividerModule} from '@angular/material/divider';
import {PersistentStore} from '@common/store/persistent_store';
import {Analytics} from '@logging/analytics';
import {TraceType} from '@trace_api/trace_type';
import {CollapsibleSectionType} from '@viewers/common/collapsible_section_type';
import {CuratedProperties} from '@viewers/common/curated_properties';
import {TextFilter} from '@viewers/common/text_filter';
import {UiPropertyTreeNode} from '@viewers/common/ui_property_tree_node';
import {UiTreeNodeRow} from '@viewers/common/ui_tree_node_row';
import {UserOptions} from '@viewers/common/user_options';
import {ViewerEvents} from '@viewers/common/viewer_events';
import {CollapsibleSectionTitleComponent} from '@viewers/components/collapsible_section_title_component';
import {UserOptionsComponent} from '@viewers/components/user_options_component';
import {ViewCapturePropertyGroupsComponent} from '@viewers/components/view_capture_property_groups_component';
import {SearchBoxComponent} from './search_box_component';
import {TreeComponent} from './tree_component';

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
  ViewerEvents = ViewerEvents;

  @Input() title = 'PROPERTIES';
  @Input() userOptions: UserOptions = {};
  @Input() placeholderText = '';
  @Input() nodeRows: Array<UiTreeNodeRow<UiPropertyTreeNode>> | undefined;
  @Input() highlightedProperty = '';
  @Input() curatedProperties: CuratedProperties | undefined;
  @Input() isProtoDump = false;
  @Input() traceType: TraceType | undefined;
  @Input() store: PersistentStore | undefined;
  @Input() textFilter: TextFilter | undefined;
  @Input() filterEventName = ViewerEvents.PropertiesFilterChange;

  @Output() collapseButtonClicked = new EventEmitter();

  @ViewChild(SearchBoxComponent) searchBox: SearchBoxComponent | undefined;

  constructor(@Inject(ElementRef) private elementRef: ElementRef) {}

  onFilterChange(detail: TextFilter) {
    const event = new CustomEvent(this.filterEventName, {
      bubbles: true,
      detail,
    });
    this.elementRef.nativeElement.dispatchEvent(event);
  }

  onHighlightedPropertyChange(newNode: UiPropertyTreeNode) {
    const event = new CustomEvent(ViewerEvents.HighlightedPropertyChange, {
      bubbles: true,
      detail: {id: newNode.id},
    });
    this.elementRef.nativeElement.dispatchEvent(event);
  }

  hasUserOptions() {
    return Object.keys(this.userOptions).length > 0;
  }

  showViewCaptureFormat(): boolean {
    return (
      this.traceType === TraceType.VIEW_CAPTURE &&
      this.textFilter?.filterString === '' &&
      // Todo: Highlight Inline in formatted ViewCapture Properties Component.
      !this.userOptions['showDiff']?.enabled &&
      this.curatedProperties !== undefined
    );
  }

  showPropertiesTree(): boolean {
    return (this.nodeRows?.length ?? 0) > 0 && !this.showViewCaptureFormat();
  }

  showPlaceholderText(): boolean {
    return (
      (this.nodeRows?.length ?? 0) === 0 &&
      !this.curatedProperties &&
      !!this.placeholderText
    );
  }
}

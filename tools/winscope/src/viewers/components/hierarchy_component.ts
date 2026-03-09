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
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {isElementOverflowing} from '@common/dom';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {PersistentStore} from '@common/store/persistent_store';
import {Analytics} from '@logging/analytics';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {FlattenedTreeRow} from '@viewers/common/flattened_tree_row';
import {RectShowState} from '@viewers/common/rect_show_state';
import {TableProperties} from '@viewers/common/table_properties';
import {TextFilter} from '@viewers/common/text_filter';
import {UiHierarchyTreeNode} from '@viewers/common/ui_hierarchy_tree_node';
import {UiTreeNode} from '@viewers/common/ui_tree_node';
import {isHighlighted} from '@viewers/common/ui_tree_node_helpers';
import {UserOptions} from '@viewers/common/user_options';
import {ViewerEvents} from '@viewers/common/viewer_events';
import {CollapsibleSectionTitleComponent} from '@viewers/components/collapsible_section_title_component';
import {PropertiesTableComponent} from '@viewers/components/properties_table_component';
import {SearchBoxComponent} from '@viewers/components/search_box_component';
import {TreeNodeComponent} from '@viewers/components/tree_node_component';
import {UserOptionsComponent} from '@viewers/components/user_options_component';

import {TreeComponent} from './tree_component';

@Component({
  selector: 'hierarchy-view',
  standalone: true,
  imports: [
    CommonModule,
    MatDividerModule,
    MatIconModule,
    MatTooltipModule,
    CollapsibleSectionTitleComponent,
    SearchBoxComponent,
    UserOptionsComponent,
    PropertiesTableComponent,
    TreeComponent,
    TreeNodeComponent,
    TreeComponent,
  ],
  templateUrl: './hierarchy_component.ng.html',
  styleUrls: ['hierarchy_component.css'],
})
export class HierarchyComponent {
  isHighlighted = isHighlighted;
  ViewerEvents = ViewerEvents;
  Analytics = Analytics;
  readonly treeStorage = new InMemoryStorage();

  nodeRows = input.required<Array<FlattenedTreeRow<UiHierarchyTreeNode>>>();
  tableProperties = input<TableProperties>();
  dependencies = input<TraceType[]>([]);
  highlightedItem = input('');
  pinnedItems = input<UiHierarchyTreeNode[]>([]);
  store = input<PersistentStore>();
  userOptions = input<UserOptions>({});
  rectIdToShowState = input<Map<string, RectShowState>>();
  placeholderText = input('No entry found.');
  textFilter = input<TextFilter>();

  collapseButtonClicked = output();

  readonly showPlaceholderText = computed(() => {
    return this.nodeRows().length === 0 && !!this.placeholderText();
  });

  readonly getPlaceholderText = computed(() => {
    return (
      this.placeholderText() +
      ` There may be no ${
        this.dependencies().length > 0
          ? TRACE_INFO[this.dependencies()[0]].name + ' state'
          : 'state for this trace'
      } associated with the current state in the active trace.` +
      ' Try changing timeline position.'
    );
  });

  readonly warnings = computed(() => {
    return this.nodeRows().flatMap((row) => {
      return row.node.getWarnings();
    });
  });

  constructor(
    @Inject(ElementRef) private elementRef: ElementRef<HTMLElement>,
  ) {}

  trackById(index: number, child: UiHierarchyTreeNode): string {
    return child.id;
  }

  isFlattened(): boolean {
    return this.userOptions()['flat']?.enabled;
  }

  disableTooltip(el: HTMLElement): boolean {
    return !isElementOverflowing(el);
  }

  onPinnedNodeClick(event: MouseEvent, pinnedItem: UiTreeNode) {
    event.preventDefault();
    if (window.getSelection()?.type === 'range') {
      return;
    }
    this.onHighlightedItemChange(pinnedItem);
  }

  onFilterChange(detail: TextFilter) {
    const event = new CustomEvent(ViewerEvents.HierarchyFilterChange, {
      bubbles: true,
      detail,
    });
    this.elementRef.nativeElement.dispatchEvent(event);
  }

  onHighlightedItemChange(node: UiTreeNode) {
    const event = new CustomEvent(ViewerEvents.HighlightedNodeChange, {
      bubbles: true,
      detail: {node: node as UiHierarchyTreeNode},
    });
    this.elementRef.nativeElement.dispatchEvent(event);
  }

  onPinnedItemChange(item: UiHierarchyTreeNode) {
    const event = new CustomEvent(ViewerEvents.HierarchyPinnedChange, {
      bubbles: true,
      detail: {pinnedItem: item as UiHierarchyTreeNode},
    });
    this.elementRef.nativeElement.dispatchEvent(event);
  }
}

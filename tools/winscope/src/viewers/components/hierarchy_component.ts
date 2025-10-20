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
  HostListener,
  Inject,
  Input,
  Output,
} from '@angular/core';
import {MatDividerModule} from '@angular/material/divider';
import {MatIconModule} from '@angular/material/icon';
import {MatTooltipModule} from '@angular/material/tooltip';
import {Color} from 'app/colors';
import {isElementOverflowing, KeyboardEventKey} from 'common/dom';
import {InMemoryStorage} from 'common/store/in_memory_storage';
import {PersistentStore} from 'common/store/persistent_store';
import {Warning} from 'common/warning';
import {Analytics} from 'logging/analytics';
import {TRACE_INFO} from 'trace_api/trace_info';
import {TraceType} from 'trace_api/trace_type';
import {RectShowState} from 'viewers/common/rect_show_state';
import {TableProperties} from 'viewers/common/table_properties';
import {TextFilter} from 'viewers/common/text_filter';
import {UiHierarchyTreeNode} from 'viewers/common/ui_hierarchy_tree_node';
import {isHighlighted} from 'viewers/common/ui_tree_utils';
import {UserOptions} from 'viewers/common/user_options';
import {ViewerEvents} from 'viewers/common/viewer_events';
import {CollapsibleSectionTitleComponent} from 'viewers/components/collapsible_section_title_component';
import {PropertiesTableComponent} from 'viewers/components/properties_table_component';
import {SearchBoxComponent} from 'viewers/components/search_box_component';
import {nodeStyles} from 'viewers/components/styles/node.styles';
import {TreeComponent} from 'viewers/components/tree_component';
import {TreeNodeComponent} from 'viewers/components/tree_node_component';
import {UserOptionsComponent} from 'viewers/components/user_options_component';
import {viewerCardInnerStyle} from './styles/viewer_card.styles';

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
  ],
  template: `
    <div class="view-header">
      <div class="title-section">
        <collapsible-section-title
          class="hierarchy-title"
          title="HIERARCHY"
          (collapseButtonClicked)="collapseButtonClicked.emit()"></collapsible-section-title>
        <search-box
          formFieldClass="applied-field mat-form-field-appearance-none"
          subscriptSizing="dynamic"
          [textFilter]="textFilter"
          (filterChange)="onFilterChange($event)"></search-box>
      </div>
      <user-options
        class="view-controls"
        [userOptions]="userOptions"
        [eventType]="ViewerEvents.HierarchyUserOptionsChange"
        [traceType]="dependencies[0]"
        [logCallback]="Analytics.Navigation.logHierarchySettingsChanged">
      </user-options>
      @if (getWarnings().length > 0) {
        <div>
          @for (warning of getWarnings(); track $index) {
            <span
              class="mat-body-1 warning"
              [matTooltip]="warning.getMessage()"
              [matTooltipDisabled]="disableTooltip(warningEl)">
              <mat-icon class="warning-icon icon-small"> warning </mat-icon>
              <span class="warning-message text-no-overflow" #warningEl>{{warning.getMessage()}}</span>
            </span>
          }
        </div>
      }
      @if (tableProperties) {
        <properties-table
          class="properties-table"
          [properties]="tableProperties"></properties-table>
      }
      @if (pinnedItems.length > 0) {
        <div class="pinned-items">
          @for (pinnedItem of pinnedItems; track pinnedItem.id) {
            <tree-node
              class="node full-opacity"
              [class]="pinnedItem.getDiff()"
              [class.selected]="isHighlighted(pinnedItem, highlightedItem)"
              [class.clickable]="true"
              [node]="pinnedItem"
              [isPinned]="true"
              [isInPinnedSection]="true"
              [isSelected]="isHighlighted(pinnedItem, highlightedItem)"
              (pinNodeChange)="onPinnedItemChange($event)"
              (click)="onPinnedNodeClick($event, pinnedItem)"></tree-node>
          }
        </div>
      }
    </div>
    <mat-divider></mat-divider>
    @if (showPlaceholderText()) {
      <span
        class="mat-body-1 placeholder-text"
        >{{ getPlaceholderText() }}</span>
    }
    <div class="hierarchy-content tree-wrapper">
      <div class="trees">
        @for (tree of trees; track tree.id) {
          <tree-view
            class="tree"
            [node]="tree"
            [isFlattened]="isFlattened()"
            [useStoredExpandedState]="true"
            [highlightedItem]="highlightedItem"
            [pinnedItems]="pinnedItems"
            [itemsClickable]="true"
            [rectIdToShowState]="rectIdToShowState"
            [store]="treeStorage"
            (highlightedChange)="onHighlightedItemChange($event)"
            (pinnedItemChange)="onPinnedItemChange($event)"
            (selectedTreeChange)="onSelectedTreeChange($event)"></tree-view>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .view-header {
        display: flex;
        flex-direction: column;
      }

      .properties-table {
        padding-top: 5px;
      }

      .hierarchy-content {
        height: 100%;
        overflow: auto;
        padding: 0px 12px;
      }

      .pinned-items {
        width: 100%;
        box-sizing: border-box;
        border: 2px solid ${Color.PINNED_ITEM_BORDER};
      }

      tree-view {
        overflow: auto;
      }

      search-box {
        margin-top: 8px;
      }
    `,
    nodeStyles,
    viewerCardInnerStyle,
  ],
})
export class HierarchyComponent {
  isHighlighted = isHighlighted;
  ViewerEvents = ViewerEvents;
  Analytics = Analytics;
  treeStorage = new InMemoryStorage();

  @Input() trees: UiHierarchyTreeNode[] = [];
  @Input() tableProperties: TableProperties | undefined;
  @Input() dependencies: TraceType[] = [];
  @Input() highlightedItem = '';
  @Input() pinnedItems: UiHierarchyTreeNode[] = [];
  @Input() store: PersistentStore | undefined;
  @Input() userOptions: UserOptions = {};
  @Input() rectIdToShowState?: Map<string, RectShowState>;
  @Input() placeholderText = 'No entry found.';
  @Input() textFilter: TextFilter | undefined;

  @Output() collapseButtonClicked = new EventEmitter();

  constructor(
    @Inject(ElementRef) private elementRef: ElementRef<HTMLElement>,
  ) {}

  trackById(index: number, child: UiHierarchyTreeNode): string {
    return child.id;
  }

  isFlattened(): boolean {
    return this.userOptions['flat']?.enabled;
  }

  showPlaceholderText(): boolean {
    return this.trees.length === 0 && !!this.placeholderText;
  }

  getWarnings(): Warning[] {
    return this.trees.flatMap((tree) => tree.getWarnings());
  }

  onPinnedNodeClick(event: MouseEvent, pinnedItem: UiHierarchyTreeNode) {
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

  onHighlightedItemChange(node: UiHierarchyTreeNode) {
    const event = new CustomEvent(ViewerEvents.HighlightedNodeChange, {
      bubbles: true,
      detail: {node},
    });
    this.elementRef.nativeElement.dispatchEvent(event);
  }

  onPinnedItemChange(item: UiHierarchyTreeNode) {
    const event = new CustomEvent(ViewerEvents.HierarchyPinnedChange, {
      bubbles: true,
      detail: {pinnedItem: item},
    });
    this.elementRef.nativeElement.dispatchEvent(event);
  }

  disableTooltip(el: HTMLElement): boolean {
    return !isElementOverflowing(el);
  }

  getPlaceholderText(): string {
    return (
      this.placeholderText +
      ` There may be no ${
        this.dependencies.length > 0
          ? TRACE_INFO[this.dependencies[0]].name + ' state'
          : 'state for this trace'
      } associated with the current state in the active trace.` +
      ' Try changing timeline position.'
    );
  }

  @HostListener('document:keydown', ['$event'])
  async handleKeyboardEvent(event: KeyboardEvent) {
    const domRect = this.elementRef.nativeElement.getBoundingClientRect();
    const componentVisible = domRect.height > 0 && domRect.width > 0;
    if (
      componentVisible &&
      (event.key === KeyboardEventKey.ARROW_DOWN ||
        event.key === KeyboardEventKey.ARROW_UP)
    ) {
      event.preventDefault();
      const details = {bubbles: true, detail: this.treeStorage};
      if (event.key === KeyboardEventKey.ARROW_DOWN) {
        const arrowEvent = new CustomEvent(
          ViewerEvents.ArrowDownPress,
          details,
        );
        this.elementRef.nativeElement.dispatchEvent(arrowEvent);
      } else {
        const arrowEvent = new CustomEvent(ViewerEvents.ArrowUpPress, details);
        this.elementRef.nativeElement.dispatchEvent(arrowEvent);
      }
    }
  }
}

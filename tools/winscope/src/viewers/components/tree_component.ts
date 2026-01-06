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
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Inject,
  Input,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {assertDefined} from '@common/assert';
import {KeyboardEventKey} from '@common/dom';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {FlattenedTreeRow} from '@viewers/common/flattened_tree_row';
import {RectShowState} from '@viewers/common/rect_show_state';
import {UiHierarchyTreeNode} from '@viewers/common/ui_hierarchy_tree_node';
import {UiTreeNode} from '@viewers/common/ui_tree_node';
import {isHighlighted} from '@viewers/common/ui_tree_node_helpers';
import {ViewerEvents} from '@viewers/common/viewer_events';
import {TreeNodeComponent} from './tree_node_component';
import {
  VirtualRow,
  VirtualScrollViewportComponent,
} from './virtual_scroll_viewport_component';

@Component({
  selector: 'tree-view',
  standalone: true,
  imports: [
    CommonModule,
    VirtualScrollViewportComponent,
    VirtualRow,
    TreeNodeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tree_component.ng.html',
  styleUrls: ['tree_component.css'],
})
export class TreeComponent<T extends UiTreeNode> {
  readonly isHighlighted = isHighlighted;
  readonly isRowVisible = (index: number) => {
    return this.virtualScrollViewport?.isIndexVisible(index) ?? false;
  };
  filteredRows: Array<FlattenedTreeRow<T>> = [];
  handlingArrowPress = false;

  @Input() nodeRows: Array<FlattenedTreeRow<T>> = [];
  @Input() store: InMemoryStorage | undefined;
  @Input() isFlattened? = false;
  @Input() highlightedItem = '';
  @Input() pinnedItems?: UiTreeNode[] = [];
  @Input() itemsClickable?: boolean;
  @Input() rectIdToShowState?: Map<string, RectShowState>;
  @Input() handleArrowPress = false;

  // Conditionally use stored states. Some traces (e.g. transactions) do not provide
  // items with the "stable id" field needed to search values in the storage.
  @Input() useStoredExpandedState = false;

  @Output() readonly highlightedChange = new EventEmitter<UiTreeNode>();
  @Output() readonly pinnedItemChange = new EventEmitter<UiTreeNode>();

  @ViewChild('treeContainer', {static: true})
  readonly virtualScrollViewport: VirtualScrollViewportComponent | undefined;

  readonly levelOffset = 24;
  readonly heightPredictor = new NodeHeightPredictor(
    (index: number) => {
      return this.filteredRows.at(index);
    },
    () => {
      return this.virtualScrollViewport?.elementRef.nativeElement.clientWidth;
    },
  );

  constructor(
    @Inject(ElementRef) public elementRef: ElementRef<HTMLElement>,
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (!this.store) {
      this.store = new InMemoryStorage();
    }
    const rowsChanged = changes['nodeRows'] !== undefined;
    if (rowsChanged) {
      let i = 0;
      while (i < this.nodeRows.length) {
        const row = this.nodeRows[i];
        const isExpanded = this.store
          ? !this.isCollapsedInStore(row.storeKey)
          : true;
        if (!isExpanded) {
          i = this.setExpandedValue(row, isExpanded, false);
        } else {
          i++;
        }
      }
    }

    const highlightedChanged = changes['highlightedItem'];
    if (highlightedChanged) {
      this.handlingArrowPress = false;
    }

    const highlightedRow = this.nodeRows.find(
      (r) => r.node.id === this.highlightedItem,
    );

    if (rowsChanged || highlightedChanged) {
      if (highlightedRow) {
        this.expandParentIfCollapsed(highlightedRow, false);
      }

      this.updateRenderedNodes();

      const index = this.filteredRows.findIndex(
        (n) => n.node.id === this.highlightedItem,
      );
      if (index === -1) {
        return;
      }
      if (!this.isRowVisible(index)) {
        this.scrollToIndex(index - 1);
      }
    }
  }

  onNodeClick(event: MouseEvent, row: FlattenedTreeRow<T>) {
    event.preventDefault();
    if (window.getSelection()?.type === 'range') {
      return;
    }

    const isDoubleClick = event.detail === 2;
    if (!this.isFlattened && !row.node.isLeaf() && isDoubleClick) {
      event.preventDefault();
      this.toggleTree(row);
    } else {
      this.highlightedChange.emit(row.node);
    }
  }

  isPinned(node: T): boolean {
    if (this.pinnedItems && node.canBePinned()) {
      return this.pinnedItems.map((item) => item.id).includes(node.id);
    }
    return false;
  }

  propagateNewPinnedItem(newPinnedItem: T) {
    this.pinnedItemChange.emit(newPinnedItem);
  }

  isClickable(node: T): boolean {
    return !node.isLeaf() || !!this.itemsClickable;
  }

  toggleTree(row: FlattenedTreeRow<T>) {
    this.setExpandedValue(row, !this.isExpanded(row));
  }

  expandTree(row: FlattenedTreeRow<T>) {
    const j = this.setExpandedValue(row, true, false);
    let i = row.originalIndex;
    while (i < j) {
      const innerRow = this.nodeRows[i];
      if (!innerRow.localExpandedState) {
        this.setExpandedValue(innerRow, true, false);
      }
      i++;
    }
    this.updateRenderedNodes();
  }

  expandParentIfCollapsed(
    row: FlattenedTreeRow<T>,
    updateRenderedNodes = true,
  ) {
    let prevDepth = row.depth;
    for (let i = row.originalIndex - 1; i >= 0; i--) {
      const prevRow = this.nodeRows[i];
      if (prevRow.depth < prevDepth) {
        prevDepth = prevRow.depth;
        if (!prevRow.localExpandedState) {
          this.setExpandedValue(prevRow, true, false);
        }
      }
    }
    if (updateRenderedNodes) {
      this.updateRenderedNodes();
    }
  }

  isExpanded(row: FlattenedTreeRow<T>): boolean {
    return row.node.isLeaf() || row.localExpandedState;
  }

  hasSelectedChild(node: T): boolean {
    if (node.isLeaf()) {
      return false;
    }
    return node
      .getAllChildren()
      .some((child) => this.highlightedItem === child.id);
  }

  getShowStateIcon(node: T): string | undefined {
    if (!node.hasShowState()) {
      return undefined;
    }
    const showState = this.rectIdToShowState?.get(node.id);
    if (showState === undefined) {
      return undefined;
    }
    return showState === RectShowState.SHOW ? 'visibility' : 'visibility_off';
  }

  showFullOpacity(node: T): boolean {
    if (!node.hasShowState()) return true;
    if (this.rectIdToShowState === undefined) return true;
    const showState = this.rectIdToShowState.get(node.id);
    return showState === RectShowState.SHOW;
  }

  toggleRectShowState(node: T) {
    const currentShowState = assertDefined(
      this.rectIdToShowState?.get(node.id),
    );
    const newShowState =
      currentShowState === RectShowState.HIDE
        ? RectShowState.SHOW
        : RectShowState.HIDE;
    const event = new CustomEvent(ViewerEvents.RectShowStateChange, {
      bubbles: true,
      detail: {rectId: node.id, state: newShowState},
    });
    this.elementRef.nativeElement.dispatchEvent(event);
  }

  scrollToIndex(index: number) {
    if (index >= this.filteredRows.length) {
      return;
    }
    this.virtualScrollViewport?.scrollToIndex(index);
    this.changeDetectorRef.markForCheck();
  }

  onVisibleRangeChanged() {
    this.updateRenderedNodes();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.handleArrowPress || this.handlingArrowPress) {
      return;
    }
    this.handlingArrowPress = true;
    const domRect = this.elementRef.nativeElement.getBoundingClientRect();
    const componentVisible = domRect.height > 0 && domRect.width > 0;
    if (
      componentVisible &&
      (event.key === KeyboardEventKey.ARROW_DOWN ||
        event.key === KeyboardEventKey.ARROW_UP)
    ) {
      event.preventDefault();
      this.onArrowPress(event.key === KeyboardEventKey.ARROW_UP);
    }
  }

  private onArrowPress(getPrevious: boolean) {
    if (this.nodeRows.length === 0) {
      this.handlingArrowPress = false;
      return;
    }
    const currentHighlightedIndex =
      this.highlightedItem.length > 0
        ? this.nodeRows.findIndex((n) => n.node.id === this.highlightedItem)
        : -1;
    let newIndex: number | undefined;
    if (currentHighlightedIndex === -1) {
      newIndex = getPrevious ? this.nodeRows.length - 1 : 0;
    } else {
      if (getPrevious) {
        for (let i = currentHighlightedIndex - 1; i >= 0; i--) {
          if (!this.nodeRows[i].isHiddenByCollapsedParent) {
            newIndex = i;
            break;
          }
        }
      } else {
        for (
          let i = currentHighlightedIndex + 1;
          i < this.nodeRows.length;
          i++
        ) {
          if (!this.nodeRows[i].isHiddenByCollapsedParent) {
            newIndex = i;
            break;
          }
        }
      }
    }
    if (newIndex === undefined) {
      this.handlingArrowPress = false;
      return;
    }
    const newRow = this.nodeRows[newIndex];
    if (!newRow) {
      this.handlingArrowPress = false;
      return;
    }
    this.highlightedChange.emit(newRow.node);
  }

  private setExpandedValue(
    row: FlattenedTreeRow<T>,
    isExpanded: boolean,
    updateRenderedNodes = true,
  ): number {
    if (this.store && this.useStoredExpandedState) {
      if (isExpanded) {
        this.store.clear(row.storeKey);
      } else {
        this.store.add(row.storeKey, 'true');
      }
    }
    row.localExpandedState = isExpanded;
    let j = row.originalIndex + 1;
    let lastCollapsedDepth: number | undefined;
    while (j < this.nodeRows.length) {
      const nextRow = this.nodeRows[j];
      if (nextRow.depth <= row.depth) {
        break;
      }
      if (!nextRow.localExpandedState) {
        lastCollapsedDepth = Math.min(
          nextRow.depth,
          lastCollapsedDepth ?? nextRow.depth,
        );
      } else if (
        nextRow.depth === lastCollapsedDepth &&
        nextRow.localExpandedState
      ) {
        lastCollapsedDepth = undefined;
      }
      if (
        lastCollapsedDepth === undefined ||
        nextRow.depth <= lastCollapsedDepth
      ) {
        nextRow.isHiddenByCollapsedParent = !isExpanded;
      }
      j++;
    }
    if (updateRenderedNodes) {
      this.updateRenderedNodes();
    }
    return j;
  }

  private updateRenderedNodes() {
    this.filteredRows = this.nodeRows.filter(
      (n) => !n.isHiddenByCollapsedParent,
    );
    this.changeDetectorRef.markForCheck();
  }

  private isCollapsedInStore(storeKey: string): boolean {
    return assertDefined(this.store).get(storeKey) !== undefined;
  }
}

class NodeHeightPredictor {
  private readonly defaultRowHeight = 24;
  private readonly charWidth = 9;
  private readonly nodeIconWidth = 24;
  private readonly chipPaddingWidth = 30;
  private readonly additionalRowHeight = 16;
  private readonly defaultRowWidth = 480;
  private readonly rowPaddingWidth = 12;

  constructor(
    private readonly getRow: (
      index: number,
    ) => FlattenedTreeRow<UiTreeNode> | undefined,
    private readonly getViewportWidth: () => number | undefined,
  ) {}

  predict(index: number): number {
    const row = this.getRow(index);
    if (!row) {
      return this.defaultRowHeight;
    }
    const displayName = row.node.getDisplayName();
    let textWidth = displayName.length * this.charWidth;

    const fullWidth = this.getRowWidth() - this.rowPaddingWidth;
    // leaf/chevron icon and depth indicators
    let rowLength =
      fullWidth - this.nodeIconWidth - row.depth * this.nodeIconWidth;

    if (row.node instanceof UiHierarchyTreeNode) {
      if (!row.node.isRoot()) {
        rowLength -= this.nodeIconWidth; // pin icon
      }

      const heading = row.node.heading();

      // "<heading> - " precedes display name
      textWidth += heading !== undefined ? heading.length + 3 : 0;
      row.node.getChips().forEach((chip) => {
        textWidth += chip.short.length * this.charWidth + this.chipPaddingWidth;
      });
    }

    const rows = Math.ceil(textWidth / rowLength);
    return this.defaultRowHeight + (rows - 1) * this.additionalRowHeight;
  }

  private getRowWidth(): number {
    const viewportWidth = this.getViewportWidth();
    return viewportWidth ?? this.defaultRowWidth;
  }
}

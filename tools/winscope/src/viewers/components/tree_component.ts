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
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {assertDefined} from '@common/assert';
import {KeyboardEventKey} from '@common/dom';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {RectShowState} from '@viewers/common/rect_show_state';
import {UiHierarchyTreeNode} from '@viewers/common/ui_hierarchy_tree_node';
import {UiPropertyTreeNode} from '@viewers/common/ui_property_tree_node';
import {UiTreeNode} from '@viewers/common/ui_tree_node';
import {isHighlighted} from '@viewers/common/ui_tree_node_helpers';
import {UiTreeNodeRow} from '@viewers/common/ui_tree_node_row';
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
export class TreeComponent {
  readonly isHighlighted = isHighlighted;
  readonly isRowVisible = (index: number) => {
    return this.virtualScrollViewport?.isIndexVisible(index) ?? false;
  };
  filteredRows: Array<UiTreeNodeRow<UiTreeNode>> = [];
  handlingArrowPress = false;

  @Input() nodeRows: Array<UiTreeNodeRow<UiTreeNode>> = [];
  @Input() store: InMemoryStorage | undefined;
  @Input() isFlattened? = false;
  @Input() initialDepth = 0;
  @Input() highlightedItem = '';
  @Input() pinnedItems?: UiHierarchyTreeNode[] = [];
  @Input() itemsClickable?: boolean;
  @Input() rectIdToShowState?: Map<string, RectShowState>;
  @Input() handleArrowPress = false;

  // Conditionally use stored states. Some traces (e.g. transactions) do not provide
  // items with the "stable id" field needed to search values in the storage.
  @Input() useStoredExpandedState = false;

  @Output() readonly highlightedChange = new EventEmitter<UiTreeNode>();
  @Output() readonly pinnedItemChange = new EventEmitter<UiHierarchyTreeNode>();
  @Output() readonly hoverStart = new EventEmitter<void>();
  @Output() readonly hoverEnd = new EventEmitter<void>();

  @ViewChild('treeContainer', {static: true})
  readonly virtualScrollViewport: VirtualScrollViewportComponent | undefined;

  @ViewChildren(TreeNodeComponent)
  treeNodes: QueryList<TreeNodeComponent> | undefined;

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

  onNodeClick(event: MouseEvent, row: UiTreeNodeRow<UiTreeNode>) {
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

  isPinned(node: UiTreeNode): boolean {
    if (this.pinnedItems && node instanceof UiHierarchyTreeNode) {
      return this.pinnedItems.map((item) => item.id).includes(node.id);
    }
    return false;
  }

  propagateNewPinnedItem(newPinnedItem: UiHierarchyTreeNode) {
    this.pinnedItemChange.emit(newPinnedItem);
  }

  isClickable(node: UiTreeNode): boolean {
    return !node.isLeaf() || !!this.itemsClickable;
  }

  toggleTree(row: UiTreeNodeRow<UiTreeNode>) {
    this.setExpandedValue(row, !this.isExpanded(row));
  }

  expandTree(row: UiTreeNodeRow<UiTreeNode>) {
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
    row: UiTreeNodeRow<UiTreeNode>,
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

  isExpanded(row: UiTreeNodeRow<UiTreeNode>): boolean {
    return row.node.isLeaf() || row.localExpandedState;
  }

  hasSelectedChild(node: UiTreeNode): boolean {
    if (node.isLeaf()) {
      return false;
    }
    return node
      .getAllChildren()
      .some((child) => this.highlightedItem === child.id);
  }

  getShowStateIcon(node: UiTreeNode): string | undefined {
    const showState = this.rectIdToShowState?.get(node.id);
    if (showState === undefined || node instanceof UiPropertyTreeNode) {
      return undefined;
    }
    return showState === RectShowState.SHOW ? 'visibility' : 'visibility_off';
  }

  showFullOpacity(node: UiTreeNode): boolean {
    if (node instanceof UiPropertyTreeNode) return true;
    if (this.rectIdToShowState === undefined) return true;
    const showState = this.rectIdToShowState.get(node.id);
    return showState === RectShowState.SHOW;
  }

  toggleRectShowState(node: UiTreeNode) {
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

  addGutter(): boolean {
    return (this.rectIdToShowState?.size ?? 0) > 0;
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
    row: UiTreeNodeRow<UiTreeNode>,
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
  private readonly defaultRowSize = 24;
  private readonly pxPerChar = 9;
  private readonly nodeElementWidth = 24;
  private readonly chipPaddingPx = 30;
  private readonly additionalRowHeight = 16;
  private readonly defaultRowWidth = 480;
  private readonly rowPaddingPx = 12;

  constructor(
    private readonly getRow: (
      index: number,
    ) => UiTreeNodeRow<UiTreeNode> | undefined,
    private readonly getViewportWidth: () => number | undefined,
  ) {}

  predict(index: number) {
    const row = this.getRow(index);
    if (!row) {
      return this.defaultRowSize;
    }
    const displayName = row.node.getDisplayName();

    let textWidth = displayName.length * this.pxPerChar;

    const fullWidth = this.getRowWidth() - this.rowPaddingPx;
    // leaf/chevron icon and depth indicators
    let rowLength =
      fullWidth - this.nodeElementWidth - row.depth * this.nodeElementWidth;

    if (row.node instanceof UiHierarchyTreeNode) {
      if (!row.node.isRoot()) {
        rowLength -= this.nodeElementWidth; // pin icon
      }

      const heading = row.node.heading();

      // "<heading> - " precedes display name
      textWidth += heading !== undefined ? heading.length + 3 : 0;
      row.node.getChips().forEach((chip) => {
        textWidth += chip.short.length * this.pxPerChar + this.chipPaddingPx;
      });
    }

    const rows = Math.ceil(textWidth / rowLength);
    return this.defaultRowSize + (rows - 1) * this.additionalRowHeight;
  }

  private getRowWidth(): number {
    const viewportWidth = this.getViewportWidth();
    return viewportWidth ?? this.defaultRowWidth;
  }
}

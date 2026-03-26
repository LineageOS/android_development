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
import {ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, ElementRef, HostListener, Inject, input, output, TemplateRef, viewChild,} from '@angular/core';
import {VirtualRow, VirtualScrollViewportComponent,} from '@app/shared/scroll/virtual_scroll_viewport_component';
import {assertDefined} from '@common/assert';
import {KeyboardEventKey} from '@common/dom';
import {InMemoryStorage} from '@common/store/in_memory_storage';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';
import {UiTreeNode} from '@ui/shared/tree/ui_tree_node';
import {isHighlighted} from '@ui/shared/tree/ui_tree_node_helpers';
import {RectShowStateChangeDetail} from '@ui/shared/viewers/viewer_event_details';

import {TreeNodeComponent} from './tree_node_component';
import {TreeNodeHeightPredictor} from './tree_node_height_predictor';

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
  styleUrls: ['tree_component.scss'],
})
export class TreeComponent<T extends UiTreeNode> {
  readonly isHighlighted = isHighlighted;
  readonly isRowVisible = (index: number) => {
    return this.virtualScrollViewport().isIndexVisible(index) ?? false;
  };
  filteredRows: Array<FlattenedTreeRow<T>> = [];
  handlingArrowPress = false;
  viewInitialized = false;

  nodeRows = input.required<Array<FlattenedTreeRow<T>>>();
  heightPredictor = input.required<TreeNodeHeightPredictor<T>>();
  store = input<InMemoryStorage>(new InMemoryStorage());
  isFlattened = input<boolean>(false);
  highlightedItem = input<string>('');
  pinnedItems = input<UiTreeNode[]>([]);
  itemsClickable = input<boolean>(false);
  rectIdToShowState = input<Map<string, RectShowState>>();
  handleArrowPress = input<boolean>(false);
  dataView = input<TemplateRef<unknown>>();

  // Conditionally use stored states. Some traces (e.g. transactions) do not provide
  // items with the "stable id" field needed to search values in the storage.
  useStoredExpandedState = input<boolean>(false);

  readonly highlightedChange = output<T>();
  readonly pinnedItemChange = output<T>();
  readonly rectShowStateChange = output<RectShowStateChangeDetail>();

  readonly virtualScrollViewport =
    viewChild.required<VirtualScrollViewportComponent>('treeContainer');

  readonly levelOffset = 24;

  ngAfterViewInit() {
    this.viewInitialized = true;
  }

  constructor(
    @Inject(ElementRef) public elementRef: ElementRef<HTMLElement>,
    @Inject(ChangeDetectorRef) private changeDetectorRef: ChangeDetectorRef,
  ) {
    effect(() => {
      this.heightPredictor().setViewportWidthCallback(() => {
        if (!this.viewInitialized) {
          return undefined;
        }
        return this.virtualScrollViewport().elementRef.nativeElement
          .clientWidth;
      });
    });

    effect(() => {
      const rows = this.nodeRows();
      let i = 0;
      while (i < rows.length) {
        const row = rows[i];
        const isExpanded = !this.isCollapsedInStore(row.storeKey);
        if (!isExpanded) {
          i = this.setExpandedValue(row, isExpanded, false);
        } else {
          i++;
        }
      }
    });

    effect(() => {
      this.highlightedItem();
      this.handlingArrowPress = false;
    });

    effect(() => {
      const rows = this.nodeRows();
      const highlightedItem = this.highlightedItem();

      const highlightedRow = rows.find((r) => r.node.id === highlightedItem);
      if (highlightedRow) {
        this.expandParentIfCollapsed(highlightedRow, false);
      }

      this.updateRenderedNodes();

      const index = this.filteredRows.findIndex(
        (n) => n.node.id === highlightedItem,
      );
      if (index === -1) {
        return;
      }
      if (!this.isRowVisible(index)) {
        this.scrollToIndex(index - 1);
      }
    });
  }

  onNodeClick(event: MouseEvent, row: FlattenedTreeRow<T>) {
    event.preventDefault();
    if (window.getSelection()?.type === 'range') {
      return;
    }

    const isDoubleClick = event.detail === 2;
    if (!this.isFlattened() && !row.node.isLeaf() && isDoubleClick) {
      event.preventDefault();
      this.toggleTree(row);
    } else {
      this.highlightedChange.emit(row.node);
    }
  }

  isPinned(node: T): boolean {
    const pinnedItems = this.pinnedItems();
    if (pinnedItems && node.canBePinned()) {
      return pinnedItems.map((item) => item.id).includes(node.id);
    }
    return false;
  }

  isClickable(node: T): boolean {
    return !node.isLeaf() || this.itemsClickable();
  }

  toggleTree(row: FlattenedTreeRow<T>) {
    this.setExpandedValue(row, !this.isExpanded(row));
  }

  expandTree(row: FlattenedTreeRow<T>) {
    const j = this.setExpandedValue(row, true, false);
    let i = row.originalIndex;
    while (i < j) {
      const innerRow = this.nodeRows()[i];
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
      const prevRow = this.nodeRows()[i];
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
      .some((child) => this.highlightedItem() === child.id);
  }

  getShowStateIcon(node: T): string | undefined {
    if (!node.hasShowState()) {
      return undefined;
    }
    const showState = this.rectIdToShowState()?.get(node.id);
    if (showState === undefined) {
      return undefined;
    }
    return showState === RectShowState.SHOW ? 'visibility' : 'visibility_off';
  }

  showFullOpacity(node: T): boolean {
    if (!node.hasShowState()) return true;
    const rectIdToShowState = this.rectIdToShowState();
    if (rectIdToShowState === undefined) return true;
    const showState = rectIdToShowState.get(node.id);
    return showState === RectShowState.SHOW;
  }

  toggleRectShowState(node: T) {
    const currentShowState = assertDefined(
      this.rectIdToShowState()?.get(node.id),
    );
    const newShowState =
      currentShowState === RectShowState.HIDE
        ? RectShowState.SHOW
        : RectShowState.HIDE;
    this.rectShowStateChange.emit(
      new RectShowStateChangeDetail(node.id, newShowState),
    );
  }

  scrollToIndex(index: number) {
    if (index >= this.filteredRows.length) {
      return;
    }
    this.virtualScrollViewport().scrollToIndex(index);
    this.changeDetectorRef.markForCheck();
  }

  onVisibleRangeChanged() {
    this.updateRenderedNodes();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (!this.handleArrowPress() || this.handlingArrowPress) {
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
    const nodeRows = this.nodeRows();
    if (nodeRows.length === 0) {
      this.handlingArrowPress = false;
      return;
    }
    const highlightedItem = this.highlightedItem();
    const currentHighlightedIndex =
      highlightedItem.length > 0
        ? nodeRows.findIndex((n) => n.node.id === highlightedItem)
        : -1;
    let newIndex: number | undefined;
    if (currentHighlightedIndex === -1) {
      newIndex = getPrevious ? nodeRows.length - 1 : 0;
    } else {
      if (getPrevious) {
        for (let i = currentHighlightedIndex - 1; i >= 0; i--) {
          if (!nodeRows[i].isHiddenByCollapsedParent) {
            newIndex = i;
            break;
          }
        }
      } else {
        for (let i = currentHighlightedIndex + 1; i < nodeRows.length; i++) {
          if (!nodeRows[i].isHiddenByCollapsedParent) {
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
    const newRow = nodeRows[newIndex];
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
    if (this.useStoredExpandedState()) {
      const store = this.store();
      if (isExpanded) {
        store.clear(row.storeKey);
      } else {
        store.add(row.storeKey, 'true');
      }
    }
    row.localExpandedState = isExpanded;
    let j = row.originalIndex + 1;
    let lastCollapsedDepth: number | undefined;
    const nodeRows = this.nodeRows();
    while (j < nodeRows.length) {
      const nextRow = nodeRows[j];
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
    this.filteredRows = this.nodeRows().filter(
      (n) => !n.isHiddenByCollapsedParent,
    );
    this.changeDetectorRef.markForCheck();
  }

  private isCollapsedInStore(storeKey: string): boolean {
    return this.store().get(storeKey) !== undefined;
  }
}

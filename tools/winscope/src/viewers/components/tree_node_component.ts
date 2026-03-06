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
import {ClipboardModule} from '@angular/cdk/clipboard';
import {CommonModule} from '@angular/common';
import {
  Component,
  computed,
  effect,
  ElementRef,
  Inject,
  input,
  output,
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {assertDefined} from '@common/assert';
import {DiffType} from '@viewers/common/diff_type';
import {UiHierarchyTreeNode} from '@viewers/common/ui_hierarchy_tree_node';
import {UiPropertyTreeNode} from '@viewers/common/ui_property_tree_node';
import {UiTreeNode} from '@viewers/common/ui_tree_node';
import {HierarchyTreeNodeDataViewComponent} from './hierarchy_tree_node_data_view_component';
import {PropertyTreeNodeDataViewComponent} from './property_tree_node_data_view_component';
import {TreeNode} from '@tree_node/tree_node';

@Component({
  selector: 'tree-node',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    ClipboardModule,
    HierarchyTreeNodeDataViewComponent,
    PropertyTreeNodeDataViewComponent,
  ],
  templateUrl: './tree_node_component.ng.html',
  styleUrls: ['tree_node_component.css'],
})
export class TreeNodeComponent {
  node = input<UiTreeNode>();
  isLeaf = input<boolean | undefined>(undefined);
  flattened = input<boolean | undefined>(undefined);
  isExpanded = input<boolean | undefined>(undefined);
  isPinned = input(false);
  isInPinnedSection = input(false);
  isSelected = input(false);
  showStateIcon = input<string | undefined>(undefined);
  depth = input(0);
  childHighlightDepth = input<number | undefined>(undefined);
  parentHighlightDepth = input<number | undefined>(undefined);

  readonly toggleTreeChange = output<void>();
  readonly rectShowStateChange = output<void>();
  readonly expandTreeChange = output<void>();
  readonly pinNodeChange = output<UiTreeNode>();
  readonly scrollChange = output<void>();

  readonly collapseDiffClass = computed(() => {
    const node = this.node();
    if (this.isExpanded() || !node) {
      return '';
    }

    const childrenDiffClasses = this.getAllDiffTypesOfChildren(node);

    childrenDiffClasses.delete(DiffType.NONE);

    if (childrenDiffClasses.size === 0) {
      return '';
    }
    if (childrenDiffClasses.size === 1) {
      const diffType = assertDefined(childrenDiffClasses.values().next().value);
      return diffType;
    }
    return DiffType.MODIFIED;
  });

  readonly showPinNodeIcon = computed<boolean>(() => {
    const node = this.node();
    return node !== undefined && node.canBePinned() && !node.isRoot();
  });

  readonly isHierarchyTreeNode = computed<boolean>(() => {
    return this.node() instanceof UiHierarchyTreeNode;
  });

  readonly isPropertyTreeNode = computed<boolean>(() => {
    return this.node() instanceof UiPropertyTreeNode;
  });

  readonly showChevron = computed<boolean>(() => {
    return !this.isLeaf() && !this.flattened() && !this.isInPinnedSection();
  });

  readonly showCopyButton = computed<boolean>(() => {
    const node = this.node();
    return (
      node?.getCopyText() !== undefined &&
      (node?.isRoot() || !this.showChevron())
    );
  });

  private readonly el: HTMLElement;

  constructor(@Inject(ElementRef) elementRef: ElementRef<HTMLElement>) {
    this.el = elementRef.nativeElement;
    this.el?.addEventListener('mousedown', this.nodeMouseDownEventListener);

    effect(() => {
      if (!this.isInPinnedSection() && this.isSelected()) {
        this.scrollChange.emit();
      }
    });
  }

  ngOnDestroy() {
    this.el?.removeEventListener('mousedown', this.nodeMouseDownEventListener);
  }

  getIndentMarkers(depth: number): number[] {
    return Array.from({length: depth}, (_, index) => index);
  }

  toPropertyTreeNode(input: TreeNode): UiPropertyTreeNode {
    return input as UiPropertyTreeNode;
  }

  toHierarchyTreeNode(input: TreeNode): UiHierarchyTreeNode {
    return input as UiHierarchyTreeNode;
  }

  toggleTree(event: MouseEvent) {
    event.stopPropagation();
    this.toggleTreeChange.emit();
  }

  toggleRectShowState(event: MouseEvent) {
    event.stopPropagation();
    this.rectShowStateChange.emit();
  }

  expandTree(event: MouseEvent) {
    event.stopPropagation();
    this.expandTreeChange.emit();
  }

  pinNode(event: MouseEvent) {
    event.stopPropagation();
    this.pinNodeChange.emit(assertDefined(this.node()));
  }

  private getAllDiffTypesOfChildren(node: UiTreeNode): Set<DiffType> {
    const classes = new Set<DiffType>();
    for (const child of node.getAllChildren()) {
      classes.add(child.getDiff());
      for (const diffClass of this.getAllDiffTypesOfChildren(child)) {
        classes.add(diffClass);
      }
    }

    return classes;
  }

  private nodeMouseDownEventListener = (event: MouseEvent) => {
    if (event.detail > 1) {
      event.preventDefault();
      return false;
    }
    return true;
  };
}

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
import {Component, computed, ElementRef, Inject, input, output, TemplateRef,} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {assertDefined} from '@common/assert';
import {DiffType} from '@ui/shared/tree/diff_type';
import {UiTreeNode} from '@ui/shared/tree/ui_tree_node';

@Component({
  selector: 'tree-node',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, ClipboardModule],
  templateUrl: './tree_node_component.ng.html',
  styleUrls: ['tree_node_component.scss'],
})
export class TreeNodeComponent<T extends UiTreeNode> {
  node = input.required<T>();

  isLeaf = input<boolean>(false);
  flattened = input<boolean>(false);
  isExpanded = input<boolean>(false);
  isPinned = input(false);
  isInPinnedSection = input(false);
  isSelected = input(false);
  depth = input<number>(0);
  showStateIcon = input<string>();
  childHighlightDepth = input<number>();
  parentHighlightDepth = input<number>();
  dataView = input<TemplateRef<unknown>>();

  readonly toggleTreeChange = output<void>();
  readonly rectShowStateChange = output<void>();
  readonly expandTreeChange = output<void>();
  readonly pinNodeChange = output<T>();

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

  readonly showChevron = computed<boolean>(() => {
    return !this.isLeaf() && !this.flattened() && !this.isInPinnedSection();
  });

  readonly showCopyButton = computed<boolean>(() => {
    const node = this.node();
    return (
      node.getCopyText() !== undefined && (node.isRoot() || !this.showChevron())
    );
  });

  readonly indentMarkers = computed<number[]>(() => {
    return Array.from({length: this.depth()}, (_, index) => index);
  });

  private readonly el: HTMLElement;

  constructor(@Inject(ElementRef) elementRef: ElementRef<HTMLElement>) {
    this.el = elementRef.nativeElement;
    this.el?.addEventListener('mousedown', this.nodeMouseDownEventListener);
  }

  ngOnDestroy() {
    this.el?.removeEventListener('mousedown', this.nodeMouseDownEventListener);
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
    this.pinNodeChange.emit(this.node());
  }

  private getAllDiffTypesOfChildren(node: T): Set<DiffType> {
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

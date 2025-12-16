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
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  Output,
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
  @Input({required: true}) node: UiTreeNode | undefined;
  @Input() isLeaf?: boolean;
  @Input() flattened?: boolean;
  @Input() isExpanded?: boolean;
  @Input() isPinned = false;
  @Input() isInPinnedSection = false;
  @Input() isSelected = false;
  @Input() showStateIcon?: string;
  @Input() depth = 0;
  @Input() childHighlightDepth: number | undefined;
  @Input() parentHighlightDepth: number | undefined;

  @Output() readonly toggleTreeChange = new EventEmitter<void>();
  @Output() readonly rectShowStateChange = new EventEmitter<void>();
  @Output() readonly expandTreeChange = new EventEmitter<void>();
  @Output() readonly pinNodeChange = new EventEmitter<UiHierarchyTreeNode>();
  @Output() readonly scrollChange = new EventEmitter<void>();

  collapseDiffClass = '';
  private readonly el: HTMLElement;

  constructor(@Inject(ElementRef) elementRef: ElementRef<HTMLElement>) {
    this.el = elementRef.nativeElement;
    this.el?.addEventListener('mousedown', this.nodeMouseDownEventListener);
  }

  ngOnChanges() {
    this.collapseDiffClass = this.updateCollapseDiffClass();
    if (!this.isInPinnedSection && this.isSelected) {
      this.scrollChange.emit();
    }
  }

  ngOnDestroy() {
    this.el?.removeEventListener('mousedown', this.nodeMouseDownEventListener);
  }

  getIndentMarkers(depth: number): number[] {
    return Array.from({length: depth}, (_, index) => index);
  }

  isPropertyTreeNode(): boolean {
    return this.node instanceof UiPropertyTreeNode;
  }

  showPinNodeIcon(): boolean {
    return this.node instanceof UiHierarchyTreeNode && !this.node.isRoot();
  }

  toggleTree(event: MouseEvent) {
    event.stopPropagation();
    this.toggleTreeChange.emit();
  }

  toggleRectShowState(event: MouseEvent) {
    event.stopPropagation();
    this.rectShowStateChange.emit();
  }

  showChevron(): boolean {
    return !this.isLeaf && !this.flattened && !this.isInPinnedSection;
  }

  expandTree(event: MouseEvent) {
    event.stopPropagation();
    this.expandTreeChange.emit();
  }

  pinNode(event: MouseEvent) {
    event.stopPropagation();
    this.pinNodeChange.emit(assertDefined(this.node) as UiHierarchyTreeNode);
  }

  updateCollapseDiffClass(): string {
    if (this.isExpanded || !this.node) {
      return '';
    }

    const childrenDiffClasses = this.getAllDiffTypesOfChildren(this.node);

    childrenDiffClasses.delete(DiffType.NONE);

    if (childrenDiffClasses.size === 0) {
      return '';
    }
    if (childrenDiffClasses.size === 1) {
      const diffType = assertDefined(childrenDiffClasses.values().next().value);
      return diffType;
    }
    return DiffType.MODIFIED;
  }

  showCopyButton(): boolean {
    return (
      this.node instanceof UiPropertyTreeNode &&
      (this.node.isRoot() || !this.showChevron())
    );
  }

  getCopyText(): string {
    const node = assertDefined(this.node) as UiPropertyTreeNode;
    if (this.showChevron()) {
      return node.name;
    }
    return `${node.name}: ${node.formattedValue()}`;
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

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

import {Analytics} from '@logging/analytics';
import {TRACE_INFO} from '@trace_api/trace_info';
import {TraceType} from '@trace_api/trace_type';
import {makeDenyListFilterByName, makeIdMatchFilter, makeNodeFilter,} from '@tree_node/helpers';
import {DataHierarchyTreeNode} from '@tree_node/hierarchy_tree_node';
import {Operation} from '@tree_node/operation';
import {PropertyTreeNode} from '@tree_node/property_tree_node';
import {TreeNode} from '@tree_node/tree_node';
import {IsModifiedCallbackType} from '@ui/shared/tree/add_diffs';
import {Filter} from '@ui/shared/tree/filter';
import {UiTreeFormatter} from '@ui/shared/tree/ui_tree_formatter';
import {TreeNodeFilter} from '@ui/shared/tree/ui_tree_node_helpers';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';

import {AddDiffsPropertiesTree} from './add_diffs_properties_tree';
import {UiPropertyTreeNode} from './ui_property_tree_node';
import {isNotCalculated, isNotFromTP, makeIsNotDefaultFilter,} from './ui_property_tree_node_helpers';

export class PropertiesPresenter {
  private propertiesFilter: TreeNodeFilter;
  private highlightedProperty = '';
  private propertiesTree: PropertyTreeNode | undefined;
  private formattedTree: UiPropertyTreeNode | undefined;

  constructor(
    private userOptions: UserOptions,
    private textFilter: TextFilter,
    private propertiesDenylist: string[],
    private customOperations?: Array<Operation<UiPropertyTreeNode>>,
    private defaultAllowlist: string[] = [],
  ) {
    this.propertiesFilter = makeNodeFilter(
      this.textFilter.getFilterPredicate(),
    );
  }

  getUserOptions(): UserOptions {
    return this.userOptions;
  }

  setPropertiesTree(tree: PropertyTreeNode | undefined) {
    this.propertiesTree = tree;
  }

  getPropertiesTree(): PropertyTreeNode | undefined {
    return this.propertiesTree;
  }

  getFormattedTree(): UiPropertyTreeNode | undefined {
    return this.formattedTree;
  }

  getHighlightedProperty(): string {
    return this.highlightedProperty;
  }

  applyHighlightedPropertyChange(id: string) {
    if (this.highlightedProperty === id) {
      this.highlightedProperty = '';
    } else {
      this.highlightedProperty = id;
    }
  }

  getTextFilter(): TextFilter | undefined {
    return this.textFilter;
  }

  applyPropertiesFilterChange(textFilter: TextFilter) {
    this.textFilter = textFilter;
    this.propertiesFilter = makeNodeFilter(textFilter.getFilterPredicate());
  }

  applyPropertiesUserOptionsChange(userOptions: UserOptions) {
    this.userOptions = userOptions;
  }

  updateDefaultAllowList(value: string[]) {
    this.defaultAllowlist = value;
  }

  async formatPropertiesTree(
    previousHierarchyTree: DataHierarchyTreeNode | undefined,
    displayName: string | undefined,
    keepCalculated: boolean,
    traceType?: TraceType,
  ): Promise<void> {
    if (!this.propertiesTree) {
      this.formattedTree = undefined;
      return;
    }
    const uiTree = UiPropertyTreeNode.from(this.propertiesTree);

    if (
      this.userOptions['showDiff']?.enabled &&
      !this.userOptions['showDiff']?.isUnavailable
    ) {
      const prevEntryNode = previousHierarchyTree?.findDfs(
        makeIdMatchFilter(this.propertiesTree.id),
      );
      const prevEntryUiTree = prevEntryNode
        ? UiPropertyTreeNode.from(await prevEntryNode.getAllProperties())
        : undefined;

      const startTimeMs = Date.now();
      await new AddDiffsPropertiesTree(
        PropertiesPresenter.isPropertyNodeModified,
        this.propertiesDenylist,
      ).executeInPlace(uiTree, prevEntryUiTree);
      Analytics.Navigation.logDiffComputationTime(
        'properties',
        traceType ? TRACE_INFO[traceType].name : 'Unknown',
        Date.now() - startTimeMs,
      );
    }

    if (displayName) {
      uiTree.setDisplayName(displayName);
    }

    const predicatesKeepingChildren = [this.propertiesFilter];
    const predicatesDiscardingChildren = [isNotFromTP];

    if (this.propertiesDenylist) {
      predicatesDiscardingChildren.push(
        makeDenyListFilterByName(this.propertiesDenylist),
      );
    }

    if (!this.userOptions['showDefaults']?.enabled) {
      predicatesDiscardingChildren.push(
        makeIsNotDefaultFilter(this.defaultAllowlist),
      );
    }

    if (!keepCalculated) {
      predicatesDiscardingChildren.push(isNotCalculated);
    }
    const formatter = new UiTreeFormatter<UiPropertyTreeNode>().setUiTree(
      uiTree,
    );

    this.customOperations?.forEach((op) => formatter.addOperation(op));

    if (predicatesDiscardingChildren.length > 0) {
      formatter.addOperation(new Filter(predicatesDiscardingChildren, false));
    }
    formatter.addOperation(new Filter(predicatesKeepingChildren, true));

    this.formattedTree = formatter.format();
  }

  clear() {
    this.propertiesTree = undefined;
    this.formattedTree = undefined;
  }

  static isPropertyNodeModified: IsModifiedCallbackType = async (
    newTree: TreeNode,
    oldTree: TreeNode,
  ) => {
    const newValue = (newTree as UiPropertyTreeNode).formattedValue();
    const oldValue = (oldTree as UiPropertyTreeNode).formattedValue();

    return oldValue !== newValue;
  };
}

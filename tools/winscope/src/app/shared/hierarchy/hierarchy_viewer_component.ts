/*
 * Copyright (C) 2026 The Android Open Source Project
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

import {computed, Directive, output} from '@angular/core';
import {ViewerComponent} from '@app/shared/viewers/viewer_component';
import {UiDataHierarchy} from '@ui/shared/hierarchy/ui_data_hierarchy';
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';

@Directive()
export class HierarchyViewerComponent<
  T extends UiDataHierarchy,
> extends ViewerComponent<T> {
  readonly onHierarchyFilterChange = output<TextFilter>();
  readonly onHighlightedNodeChange = output<UiHierarchyTreeNode>();
  readonly onHierarchyPinnedChange = output<UiHierarchyTreeNode>();
  readonly onHierarchyUserOptionsChange = output<UserOptions>();

  readonly pinnedIds = computed(() => {
    return this.inputData()?.pinnedItems.map((node) => node.id) ?? [];
  });
}

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

import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {DisplayIdentifier} from '@ui/shared/rects/display_identifier';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {RectSpec} from '@ui/shared/rects/rect_spec';
import {UiRect} from '@ui/shared/rects/ui_rect';
import {FlattenedTreeRow} from '@ui/shared/tree/flattened_tree_row';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';

import {UiHierarchyTreeNode} from './ui_hierarchy_tree_node';

export interface UiDataHierarchy {
  highlightedItem: string;
  pinnedItems: UiHierarchyTreeNode[];
  hierarchyUserOptions: UserOptions;
  hierarchyNodes: Array<FlattenedTreeRow<UiHierarchyTreeNode>> | undefined;
  propertiesUserOptions: UserOptions;
  propertyNodes: Array<FlattenedTreeRow<UiPropertyTreeNode>> | undefined;
  highlightedProperty: string;
  hierarchyFilter: TextFilter;
  propertiesFilter: TextFilter;
  isPlaybackPlaying?: boolean;
  isPlaybackInitializing?: boolean;
  isDarkMode?: boolean;
  rectsToDraw?: UiRect[];
  rectIdToShowState?: Map<string, RectShowState> | undefined;
  displays?: DisplayIdentifier[];
  rectsUserOptions?: UserOptions;
  rectSpec?: RectSpec;
}

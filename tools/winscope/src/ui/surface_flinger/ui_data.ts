/*
 * Copyright (C) 2022 The Android Open Source Project
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

import {TraceType} from '@trace_api/trace_type';
import {DisplayIdentifier} from '@ui/shared/display_identifier';
import {FlattenedTreeRow} from '@ui/shared/hierarchy/flattened_tree_row';
import {UiDataHierarchy} from '@ui/shared/hierarchy/ui_data_hierarchy';
import {UiHierarchyTreeNode} from '@ui/shared/hierarchy/ui_hierarchy_tree_node';
import {SfCuratedProperties} from '@ui/shared/properties/curated_properties';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {RectShowState} from '@ui/shared/rects/rect_show_state';
import {RectSpec} from '@ui/shared/rects/rect_spec';
import {UiRect} from '@ui/shared/rects/ui_rect';
import {TextFilter} from '@ui/shared/text_filter';
import {UserOptions} from '@ui/shared/user_options';

export class UiData implements UiDataHierarchy {
  readonly dependencies: TraceType[] = [TraceType.SURFACE_FLINGER];
  rectsToDraw: UiRect[] = [];
  rectIdToShowState: Map<string, RectShowState> | undefined;
  displays: DisplayIdentifier[] = [];
  highlightedItem = '';
  highlightedProperty = '';
  hierarchyFilter = new TextFilter();
  propertiesFilter = new TextFilter();
  pinnedItems: UiHierarchyTreeNode[] = [];
  rectsUserOptions: UserOptions = {};
  hierarchyUserOptions: UserOptions = {};
  propertiesUserOptions: UserOptions = {};
  hierarchyNodes: Array<FlattenedTreeRow<UiHierarchyTreeNode>> | undefined;
  propertyNodes: Array<FlattenedTreeRow<UiPropertyTreeNode>> | undefined;
  isDarkMode = false;
  isPlaybackPlaying?: boolean;
  isPlaybackInitializing?: boolean;
  rectSpec: RectSpec | undefined;
  allRectSpecs: RectSpec[] | undefined;

  constructor(
    public curatedProperties: SfCuratedProperties | undefined = undefined,
  ) {}
}

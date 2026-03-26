/*
 * Copyright (C) 2025 The Android Open Source Project
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

import {UiTreeNode} from './ui_tree_node';

/**
 * Used to represent a flattened UiTreeNode. We flatten a tree to an array of
 * FlattenedTreeRows to take advantage of virtual rendering in the UI.
 */

export interface FlattenedTreeRow<T extends UiTreeNode> {
  node: T;
  storeKey: string;
  localExpandedState: boolean;
  depth: number;
  originalIndex: number;
  isHiddenByCollapsedParent: boolean;
  offsetStyle: object | undefined;
  parentHighlightDepth: number | undefined;
  childHighlightDepth: number | undefined;
}

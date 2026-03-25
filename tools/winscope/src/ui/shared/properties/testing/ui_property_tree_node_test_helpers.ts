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

import {PropertyValue} from '@tree_node/property_tree_node';
import {makePropertyNode} from '@tree_node/testing/tree_node_test_helpers';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';

/**
 * Creates a UI property tree node for tests.
 *
 * @param rootId The node's identifier.
 * @param name The node's name.
 * @param value The node's value.
 * @return The constructed UI property tree node.
 */
export function makeUiPropertyNode(
  rootId: string,
  name: string,
  value: PropertyValue | undefined,
): UiPropertyTreeNode {
  return UiPropertyTreeNode.from(makePropertyNode(rootId, name, value));
}

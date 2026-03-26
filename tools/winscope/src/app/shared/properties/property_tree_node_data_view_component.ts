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
import {Component, computed, input, output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {assertDefined} from '@common/assert';
import {Timestamp} from '@common/time/time';
import {FLAG_SEPARATOR} from '@trace/formatters';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {DiffType} from '@ui/shared/tree/diff_type';
import {TimestampClickDetail} from '@ui/shared/viewers/viewer_event_details';

@Component({
  selector: 'property-tree-node-data-view',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './property_tree_node_data_view_component.ng.html',
  styleUrls: ['property_tree_node_data_view_component.scss'],
})
export class PropertyTreeNodeDataViewComponent {
  FLAG_SEPARATOR = FLAG_SEPARATOR;

  readonly node = input.required<UiPropertyTreeNode>();

  readonly timestampClick = output<TimestampClickDetail>();
  readonly propagatePropertyClick = output<UiPropertyTreeNode>();

  readonly isTimestamp = computed<boolean>(() => {
    return this.node().getValue() instanceof Timestamp;
  });

  readonly valueClass = computed<string | undefined>(() => {
    const property = this.node().formattedValue();
    if (property === 'null') {
      return property;
    }
    if (property === 'true') {
      return property;
    }
    if (property === 'false') {
      return property;
    }
    if (!isNaN(Number(property))) {
      return 'number';
    }
    return undefined;
  });

  readonly timeClass = computed<string | null>(() => {
    if (this.isTimestamp()) {
      return 'time';
    }
    return null;
  });

  readonly isModified = computed<boolean>(() => {
    return this.node().getDiff() === DiffType.MODIFIED;
  });

  readonly key = computed<string>(() => {
    const node = this.node();
    if (!node.formattedValue()) {
      return node.getDisplayName();
    }
    return node.getDisplayName() + ': ';
  });

  onTimestampClicked(timestampNode: UiPropertyTreeNode) {
    const timestamp: Timestamp = assertDefined(
      timestampNode.getValue<Timestamp>(),
    );
    this.timestampClick.emit(new TimestampClickDetail(undefined, timestamp));
  }

  onPropagateButtonClicked(node: UiPropertyTreeNode) {
    this.propagatePropertyClick.emit(node);
  }
}

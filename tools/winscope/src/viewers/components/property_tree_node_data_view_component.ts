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
import {Component, computed, ElementRef, Inject, input} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {assertDefined} from '@common/assert';
import {Timestamp} from '@common/time/time';
import {DiffType} from '@viewers/common/diff_type';
import {UiPropertyTreeNode} from '@viewers/common/ui_property_tree_node';
import {
  TimestampClickDetail,
  ViewerEvents,
} from '@viewers/common/viewer_events';

@Component({
  selector: 'property-tree-node-data-view',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './property_tree_node_data_view_component.ng.html',
  styleUrls: ['property_tree_node_data_view_component.css'],
})
export class PropertyTreeNodeDataViewComponent {
  node = input<UiPropertyTreeNode>();

  constructor(@Inject(ElementRef) private elementRef: ElementRef) {}

  readonly isTimestamp = computed<boolean>(() => {
    return this.node()?.getValue() instanceof Timestamp;
  });

  readonly valueClass = computed<string | undefined>(() => {
    const property = this.node()?.formattedValue();
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
    return this.node()?.getDiff() === DiffType.MODIFIED;
  });

  getKey(node: UiPropertyTreeNode) {
    if (!node?.formattedValue()) {
      return node.getDisplayName();
    }
    return node.getDisplayName() + ': ';
  }

  onTimestampClicked(timestampNode: UiPropertyTreeNode) {
    const timestamp: Timestamp = assertDefined(
      timestampNode.getValue<Timestamp>(),
    );
    const customEvent = new CustomEvent(ViewerEvents.TimestampClick, {
      bubbles: true,
      detail: new TimestampClickDetail(undefined, timestamp),
    });
    this.elementRef.nativeElement.dispatchEvent(customEvent);
  }

  onPropagateButtonClicked(node: UiPropertyTreeNode) {
    const event = new CustomEvent(ViewerEvents.PropagatePropertyClick, {
      bubbles: true,
      detail: node,
    });
    this.elementRef.nativeElement.dispatchEvent(event);
  }
}

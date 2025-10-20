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
import {Component, ElementRef, Inject, Input} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {assertDefined} from 'common/assert';
import {Timestamp} from 'common/time/time';
import {DiffType} from 'viewers/common/diff_type';
import {UiPropertyTreeNode} from 'viewers/common/ui_property_tree_node';
import {TimestampClickDetail, ViewerEvents} from 'viewers/common/viewer_events';
import {propertyTreeNodeDataViewStyles} from 'viewers/components/styles/tree_node_data_view.styles';
import {
  inlineButtonStyle,
  timeButtonStyle,
} from './styles/clickable_property.styles';

@Component({
  selector: 'property-tree-node-data-view',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    @if (node) {
      <div class="node-property">
        <span class=" mat-body-1 property-key"> {{ getKey(node) }} </span>
        @if (node.formattedValue()) {
          <div class="property-value" [class]="[timeClass()]">
            @if (isTimestamp()) {
              <button
                class="time-button"
                mat-button
                color="primary"
                (click)="onTimestampClicked(node)">
                {{ node.formattedValue() }}
              </button>
            } @else if (!isTimestamp() && !node.hasDiffValueParts()) {
              @if (node.canPropagate()) {
                <div class="inline">
                  <button
                    mat-button
                    color="primary"
                    (click)="onPropagateButtonClicked(node)">
                    {{ node.formattedValue() }}
                  </button>
                </div>
              } @else {
                <span
                  [class]="valueClass()"
                  class="mat-body-2 value new-value">{{ node.formattedValue() }}</span>
              }
              @if (isModified()) {
                <s class="mat-body-2 old-value">{{ node.getOldValue() }}</s>
              }
            } @else if (node.hasDiffValueParts()) {
              <span
                class="value diff-value-parts">
                @for (part of node.getDiffValueParts(); track $index; let i = $index) {
                  @if (i > 0) {
                    <span>&ngsp; | &ngsp;</span>
                  }
                  @if (part.isNew) {
                    <span
                      class="mat-body-2 new-value">{{ part.value }}</span>
                  } @else if (part.isOld) {
                    <s
                      class="mat-body-2 old-value">{{ part.value }}</s>
                  } @else if (!part.isNew && !part.isOld) {
                    <span
                      class="mat-body-1 unchanged-value">{{ part.value }}</span>
                  }
                }
              </span>
            }
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .property-value button {
        white-space: normal;
      }
    `,
    propertyTreeNodeDataViewStyles,
    timeButtonStyle,
    inlineButtonStyle,
  ],
})
export class PropertyTreeNodeDataViewComponent {
  @Input() node?: UiPropertyTreeNode;

  constructor(@Inject(ElementRef) private elementRef: ElementRef) {}

  getKey(node: UiPropertyTreeNode) {
    if (!this.node?.formattedValue()) {
      return node.getDisplayName();
    }
    return node.getDisplayName() + ': ';
  }

  isTimestamp() {
    return this.node?.getValue() instanceof Timestamp;
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

  valueClass(): string | undefined {
    const property = assertDefined(this.node).formattedValue();
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
  }

  timeClass() {
    if (this.isTimestamp()) {
      return 'time';
    }
    return null;
  }

  isModified() {
    return assertDefined(this.node).getDiff() === DiffType.MODIFIED;
  }
}

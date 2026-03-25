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

import {Directive, ElementRef, Inject, input, output} from '@angular/core';
import {PersistentStore} from '@common/store/persistent_store';
import {TraceType} from '@trace_api/trace_type';
import {CollapsibleSectionType} from '@ui/shared/collapsible_sections/collapsible_section_type';
import {UiPropertyTreeNode} from '@ui/shared/properties/ui_property_tree_node';
import {TextFilter} from '@ui/shared/user_input/text_filter';
import {UserOptions} from '@ui/shared/user_input/user_options';
import {RectShowStateChangeDetail, TimestampClickDetail,} from '@ui/shared/viewers/viewer_event_details';

@Directive()
export class ViewerComponent<T> {
  TraceType = TraceType;
  CollapsibleSectionType = CollapsibleSectionType;

  constructor(@Inject(ElementRef) readonly elementRef: ElementRef) {}

  readonly inputData = input<T>();
  readonly store = input<PersistentStore>();

  readonly onTimestampClick = output<TimestampClickDetail>();
  readonly onPropagatePropertyClick = output<UiPropertyTreeNode>();

  readonly onHighlightedIdChange = output<string>();
  readonly onRectsUserOptionsChange = output<UserOptions>();
  readonly onRectShowStateChange = output<RectShowStateChangeDetail>();

  readonly onPropertiesFilterChange = output<TextFilter>();
  readonly onPropertiesUserOptionsChange = output<UserOptions>();
  readonly onHighlightedPropertyChange = output<string>();
}

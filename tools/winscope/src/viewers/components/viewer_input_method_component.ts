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

import {CommonModule} from '@angular/common';
import {Component, computed, output} from '@angular/core';
import {TraceType} from '@trace_api/trace_type';
import {CollapsibleSectionType} from '@viewers/common/collapsible_section_type';
import {CollapsibleSections} from '@viewers/common/collapsible_sections';
import {ImeUiData} from '@viewers/common/ime_ui_data';
import {AdditionalPropertySelectedDetail} from '@viewers/common/viewer_event_details';
import {CollapsedSectionsComponent} from '@viewers/components/collapsed_sections_component';
import {HierarchyComponent} from '@viewers/components/hierarchy_component';
import {ImeAdditionalPropertiesComponent} from '@viewers/components/ime_additional_properties_component';
import {PropertiesComponent} from '@viewers/components/properties_component';

import {HierarchyViewerComponent} from './hierarchy_viewer_component';

@Component({
  selector: 'viewer-input-method',
  standalone: true,
  imports: [
    CommonModule,
    CollapsedSectionsComponent,
    HierarchyComponent,
    PropertiesComponent,
    ImeAdditionalPropertiesComponent,
  ],
  templateUrl: './viewer_input_method_component.ng.html',
  styleUrls: ['./viewer_input_method_component.css'],
})
export class ViewerInputMethodComponent extends HierarchyViewerComponent<ImeUiData> {
  sections = new CollapsibleSections([
    {
      type: CollapsibleSectionType.HIERARCHY,
      label: CollapsibleSectionType.HIERARCHY,
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.IME_ADDITIONAL_PROPERTIES,
      label: CollapsibleSectionType.IME_ADDITIONAL_PROPERTIES,
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.PROPERTIES,
      label: CollapsibleSectionType.PROPERTIES,
      isCollapsed: false,
    },
  ]);

  readonly onAdditionalPropertySelected =
    output<AdditionalPropertySelectedDetail>();

  readonly isImeManagerService = computed(() => {
    return (
      this.inputData()?.traceType === TraceType.INPUT_METHOD_MANAGER_SERVICE
    );
  });

  areLeftViewsCollapsed(): boolean {
    return (
      this.sections.isSectionCollapsed(CollapsibleSectionType.HIERARCHY) &&
      this.sections.isSectionCollapsed(
        CollapsibleSectionType.IME_ADDITIONAL_PROPERTIES,
      )
    );
  }
}

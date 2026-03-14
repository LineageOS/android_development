/*
 * Copyright (C) 2023 The Android Open Source Project
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
import {Component, viewChild} from '@angular/core';
import {TraceType} from '@trace_api/trace_type';
import {CollapsibleSectionType} from '@viewers/common/collapsible_section_type';
import {CollapsibleSections} from '@viewers/common/collapsible_sections';
import {CollapsedSectionsComponent} from '@viewers/components/collapsed_sections_component';
import {LogComponent} from '@viewers/components/log_component';
import {PropertiesComponent} from '@viewers/components/properties_component';
import {ViewerComponent} from '@viewers/components/viewer_component';

import {UiData} from './ui_data';

@Component({
  selector: 'viewer-transitions',
  standalone: true,
  imports: [
    CommonModule,
    CollapsedSectionsComponent,
    LogComponent,
    PropertiesComponent,
  ],
  templateUrl: './viewer_transitions_component.ng.html',
  styleUrls: ['./viewer_transitions_component.css'],
})
export class ViewerTransitionsComponent extends ViewerComponent<UiData> {
  logComponent = viewChild(LogComponent);

  propertiesTitle = 'SELECTED TRANSITION';
  CollapsibleSectionType = CollapsibleSectionType;
  TraceType = TraceType;
  sections = new CollapsibleSections([
    {
      type: CollapsibleSectionType.PROPERTIES,
      label: this.propertiesTitle,
      isCollapsed: false,
    },
  ]);
}

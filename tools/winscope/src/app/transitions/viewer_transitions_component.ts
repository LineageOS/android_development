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
import {Component} from '@angular/core';
import {CollapsedSectionsComponent} from '@app/shared/collapsible_sections/collapsed_sections_component';
import {LogComponent} from '@app/shared/log_view/log_component';
import {LogViewerComponent} from '@app/shared/log_view/log_viewer_component';
import {PropertiesComponent} from '@app/shared/properties/properties_component';
import {CollapsibleSectionType} from '@ui/shared/collapsible_sections/collapsible_section_type';
import {CollapsibleSections} from '@ui/shared/collapsible_sections/collapsible_sections';
import {UiData} from '@ui/transitions/ui_data';

import {TransitionsHeightPredictor} from './transitions_height_predictor';

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
  styleUrls: ['./viewer_transitions_component.scss'],
})
export class ViewerTransitionsComponent extends LogViewerComponent<UiData> {
  propertiesTitle = 'SELECTED TRANSITION';
  sections = new CollapsibleSections([
    {
      type: CollapsibleSectionType.PROPERTIES,
      label: this.propertiesTitle,
      isCollapsed: false,
    },
  ]);

  heightPredictor = new TransitionsHeightPredictor(
    this.elementRef,
    (index: number) => this.inputData()?.entries[index],
  );
}

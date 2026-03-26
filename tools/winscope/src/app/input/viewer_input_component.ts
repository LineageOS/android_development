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
import {Component, output} from '@angular/core';
import {CollapsedSectionsComponent} from '@app/shared/collapsible_sections/collapsed_sections_component';
import {LogComponent} from '@app/shared/log_view/log_component';
import {LogViewerComponent} from '@app/shared/log_view/log_viewer_component';
import {PropertiesComponent} from '@app/shared/properties/properties_component';
import {RectsComponent} from '@app/shared/rects/rects_component';
import {UiData} from '@ui/input/ui_data';
import {CollapsibleSectionType} from '@ui/shared/collapsible_sections/collapsible_section_type';
import {CollapsibleSections} from '@ui/shared/collapsible_sections/collapsible_sections';
import {ShadingMode} from '@ui/shared/rects/shading_mode';
import {TextFilter} from '@ui/shared/user_input/text_filter';

import {InputHeightPredictor} from './input_height_predictor';

@Component({
  selector: 'viewer-input',
  standalone: true,
  imports: [
    CommonModule,
    CollapsedSectionsComponent,
    RectsComponent,
    LogComponent,
    PropertiesComponent,
  ],
  templateUrl: './viewer_input_component.ng.html',
  styleUrls: ['./viewer_input_component.scss'],
})
export class ViewerInputComponent extends LogViewerComponent<UiData> {
  rectsTitle = 'INPUT WINDOWS';
  eventLogTitle = 'EVENT LOG';
  eventPropertiesTitle = 'EVENT DETAILS';
  dispatchPropertiesTitle = 'DISPATCH DETAILS';

  shadingModes = [ShadingMode.OPACITY];

  sections = new CollapsibleSections([
    {
      type: CollapsibleSectionType.RECTS,
      label: this.rectsTitle,
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.LOG,
      label: this.eventLogTitle,
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.PROPERTIES,
      label: this.eventPropertiesTitle,
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.INPUT_DISPATCH_PROPERTIES,
      label: this.dispatchPropertiesTitle,
      isCollapsed: false,
    },
  ]);

  readonly onDispatchPropertiesFilterChange = output<TextFilter>();
  readonly onRectsDblClick = output<void>();

  heightPredictor = new InputHeightPredictor(
    this.elementRef,
    (index: number) => this.inputData()?.entries[index],
  );

  arePropertiesCollapsed(): boolean {
    return (
      this.sections.isSectionCollapsed(CollapsibleSectionType.PROPERTIES) &&
      this.sections.isSectionCollapsed(
        CollapsibleSectionType.INPUT_DISPATCH_PROPERTIES,
      )
    );
  }
}

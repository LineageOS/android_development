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
import {Component} from '@angular/core';
import {CollapsedSectionsComponent} from '@app/shared/collapsible_sections/collapsed_sections_component';
import {HierarchyComponent} from '@app/shared/hierarchy/hierarchy_component';
import {HierarchyViewerComponent} from '@app/shared/hierarchy/hierarchy_viewer_component';
import {PropertiesComponent} from '@app/shared/properties/properties_component';
import {RectsComponent} from '@app/shared/rects/rects_component';
import {assertDefined} from '@common/assert';
import {CollapsibleSectionType} from '@ui/shared/collapsible_sections/collapsible_section_type';
import {CollapsibleSections} from '@ui/shared/collapsible_sections/collapsible_sections';
import {ShadingMode} from '@ui/shared/rects/shading_mode';
import {UiData} from '@ui/window_manager/ui_data';

@Component({
  selector: 'viewer-window-manager',
  standalone: true,
  imports: [
    CommonModule,
    CollapsedSectionsComponent,
    RectsComponent,
    HierarchyComponent,
    PropertiesComponent,
  ],
  templateUrl: './viewer_window_manager_component.ng.html',
  styleUrls: ['./viewer_window_manager_component.scss'],
})
export class ViewerWindowManagerComponent extends HierarchyViewerComponent<UiData> {
  sections = new CollapsibleSections([
    {
      type: CollapsibleSectionType.RECTS,
      label: 'WINDOWS',
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.HIERARCHY,
      label: CollapsibleSectionType.HIERARCHY,
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.PROPERTIES,
      label: CollapsibleSectionType.PROPERTIES,
      isCollapsed: false,
    },
  ]);
  shadingModes = [
    ShadingMode.GRADIENT,
    ShadingMode.OPACITY,
    ShadingMode.WIRE_FRAME,
  ];

  getRectsTitle(): string {
    return assertDefined(this.sections.getSection(CollapsibleSectionType.RECTS))
      .label;
  }
}

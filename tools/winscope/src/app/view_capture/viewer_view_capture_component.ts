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
import {ChangeDetectionStrategy, Component, output} from '@angular/core';
import {CollapsedSectionsComponent} from '@app/shared/collapsible_sections/collapsed_sections_component';
import {HierarchyComponent} from '@app/shared/hierarchy/hierarchy_component';
import {HierarchyViewerComponent} from '@app/shared/hierarchy/hierarchy_viewer_component';
import {PropertiesComponent} from '@app/shared/properties/properties_component';
import {RectsComponent} from '@app/shared/rects/rects_component';
import {CollapsibleSectionType} from '@ui/shared/collapsible_sections/collapsible_section_type';
import {CollapsibleSections} from '@ui/shared/collapsible_sections/collapsible_sections';
import {ShadingMode} from '@ui/shared/rects/shading_mode';
import {UiData} from '@ui/view_capture/ui_data';

import {ViewCapturePropertyGroupsComponent} from './view_capture_property_groups_component';

/**
 * TODO: Upgrade the View Capture's Properties View after getting UX's opinion.
 */
@Component({
  selector: 'viewer-view-capture',
  standalone: true,
  imports: [
    CommonModule,
    CollapsedSectionsComponent,
    RectsComponent,
    HierarchyComponent,
    PropertiesComponent,
    ViewCapturePropertyGroupsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './viewer_view_capture_component.ng.html',
  styleUrls: ['./viewer_view_capture_component.scss'],
})
export class ViewerViewCaptureComponent extends HierarchyViewerComponent<UiData> {
  rectsTitle = 'SKETCH';
  sections = new CollapsibleSections([
    {
      type: CollapsibleSectionType.RECTS,
      label: this.rectsTitle,
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

  readonly onMiniRectsDblClick = output();
}

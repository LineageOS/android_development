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
import {ChangeDetectionStrategy, Component} from '@angular/core';
import {TraceType} from '@trace_api/trace_type';
import {CollapsibleSectionType} from '@viewers/common/collapsible_section_type';
import {CollapsibleSections} from '@viewers/common/collapsible_sections';
import {CollapsedSectionsComponent} from '@viewers/components/collapsed_sections_component';
import {HierarchyComponent} from '@viewers/components/hierarchy_component';
import {PropertiesComponent} from '@viewers/components/properties_component';
import {RectsComponent} from '@viewers/components/rects/rects_component';
import {ShadingMode} from '@viewers/components/rects/shading_mode';

import {viewerCardStyle} from '@viewers/components/styles/viewer_card.styles';
import {ViewerComponent} from '@viewers/components/viewer_component';
import {UiData} from './ui_data';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './viewer_view_capture_component.ng.html',
  styles: [viewerCardStyle],
})
export class ViewerViewCaptureComponent extends ViewerComponent<UiData> {
  CollapsibleSectionType = CollapsibleSectionType;
  TraceType = TraceType;

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
}

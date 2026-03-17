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
import {Component, effect, ElementRef, Inject} from '@angular/core';
import {assertDefined} from '@common/assert';
import {TraceType} from '@trace_api/trace_type';
import {CollapsibleSectionType} from '@viewers/common/collapsible_section_type';
import {CollapsibleSections} from '@viewers/common/collapsible_sections';
import {CollapsedSectionsComponent} from '@viewers/components/collapsed_sections_component';
import {HierarchyComponent} from '@viewers/components/hierarchy_component';
import {PropertiesComponent} from '@viewers/components/properties_component';
import {RectsComponent} from '@viewers/components/rects/rects_component';
import {ShadingMode} from '@viewers/components/rects/shading_mode';
import {SurfaceFlingerPropertyGroupsComponent} from '@viewers/components/surface_flinger_property_groups_component';
import {ViewerComponent} from '@viewers/components/viewer_component';

import {UiData} from './ui_data';

@Component({
  selector: 'viewer-surface-flinger',
  standalone: true,
  imports: [
    CommonModule,
    CollapsedSectionsComponent,
    RectsComponent,
    HierarchyComponent,
    PropertiesComponent,
    SurfaceFlingerPropertyGroupsComponent,
  ],
  templateUrl: './viewer_surface_flinger_component.ng.html',
  styleUrls: ['./viewer_surface_flinger_component.css'],
})
export class ViewerSurfaceFlingerComponent extends ViewerComponent<UiData> {
  TraceType = TraceType;
  CollapsibleSectionType = CollapsibleSectionType;

  propertiesTitle = 'PROTO DUMP';
  sections = new CollapsibleSections([
    {
      type: CollapsibleSectionType.RECTS,
      label: 'LAYERS',
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.HIERARCHY,
      label: CollapsibleSectionType.HIERARCHY,
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.CURATED_PROPERTIES,
      label: 'PROPERTIES',
      isCollapsed: false,
    },
    {
      type: CollapsibleSectionType.PROPERTIES,
      label: this.propertiesTitle,
      isCollapsed: false,
    },
  ]);
  shadingModes = [
    ShadingMode.GRADIENT,
    ShadingMode.OPACITY,
    ShadingMode.WIRE_FRAME,
  ];

  constructor(@Inject(ElementRef) elementRef: ElementRef) {
    super(elementRef);

    effect(() => {
      const data = this.inputData();
      const rectSpecType = data?.rectSpec?.type.toUpperCase();
      if (rectSpecType === undefined) {
        return;
      }
      const rectsSection = assertDefined(
        this.sections.getSection(CollapsibleSectionType.RECTS),
      );
      if (rectsSection.label === rectSpecType) {
        return;
      }
      rectsSection.label = rectSpecType;
    });
  }

  arePropertiesCollapsed(): boolean {
    return (
      this.sections.isSectionCollapsed(CollapsibleSectionType.PROPERTIES) &&
      this.sections.isSectionCollapsed(
        CollapsibleSectionType.CURATED_PROPERTIES,
      )
    );
  }

  getRectsTitle(): string {
    return assertDefined(this.sections.getSection(CollapsibleSectionType.RECTS))
      .label;
  }
}

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
import {Component, effect, ElementRef, Inject, output} from '@angular/core';
import {CollapsedSectionsComponent} from '@app/shared/collapsible_sections/collapsed_sections_component';
import {HierarchyComponent} from '@app/shared/hierarchy/hierarchy_component';
import {HierarchyViewerComponent} from '@app/shared/hierarchy/hierarchy_viewer_component';
import {PropertiesComponent} from '@app/shared/properties/properties_component';
import {RectsComponent} from '@app/shared/rects/rects_component';
import {ResizerComponent} from '@app/shared/resizer/resizer_component';
import {assertDefined} from '@common/assert';
import {CollapsibleSectionType} from '@ui/shared/collapsible_sections/collapsible_section_type';
import {CollapsibleSections} from '@ui/shared/collapsible_sections/collapsible_sections';
import {TraceRectType} from '@ui/shared/rects/rect_spec';
import {ShadingMode} from '@ui/shared/rects/shading_mode';
import {UiData} from '@ui/surface_flinger/ui_data';

import {SurfaceFlingerPropertyGroupsComponent} from './surface_flinger_property_groups_component';

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
    ResizerComponent,
  ],
  templateUrl: './viewer_surface_flinger_component.ng.html',
  styleUrls: ['./viewer_surface_flinger_component.scss'],
})
export class ViewerSurfaceFlingerComponent extends HierarchyViewerComponent<UiData> {
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

  readonly onRectsDblClick = output<string>();
  readonly onRectTypeButtonClick = output<TraceRectType>();

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

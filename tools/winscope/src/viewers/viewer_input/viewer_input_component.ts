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
import {Component, Input, ViewChild} from '@angular/core';
import {TraceType} from '@trace_api/trace_type';
import {CollapsibleSectionType} from '@viewers/common/collapsible_section_type';
import {CollapsibleSections} from '@viewers/common/collapsible_sections';
import {ViewerEvents} from '@viewers/common/viewer_events';
import {CollapsedSectionsComponent} from '@viewers/components/collapsed_sections_component';
import {LogComponent} from '@viewers/components/log_component';
import {PropertiesComponent} from '@viewers/components/properties_component';
import {RectsComponent} from '@viewers/components/rects/rects_component';
import {ShadingMode} from '@viewers/components/rects/shading_mode';
import {
  viewerCardInnerStyle,
  viewerCardStyle,
} from '@viewers/components/styles/viewer_card.styles';
import {ViewerComponent} from '@viewers/components/viewer_component';
import {UiData} from './ui_data';

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
  styles: [
    viewerCardStyle,
    viewerCardInnerStyle,
    `
      .properties {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: auto;
      }

      .log-view:not(.collapsed) {
        flex: 1;
      }
    `,
  ],
})
export class ViewerInputComponent extends ViewerComponent<UiData> {
  @ViewChild(LogComponent) logComponent?: LogComponent;
  @Input() active = false;
  TraceType = TraceType;
  CollapsibleSectionType = CollapsibleSectionType;
  ViewerEvents = ViewerEvents;

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

  arePropertiesCollapsed(): boolean {
    return (
      this.sections.isSectionCollapsed(CollapsibleSectionType.PROPERTIES) &&
      this.sections.isSectionCollapsed(
        CollapsibleSectionType.INPUT_DISPATCH_PROPERTIES,
      )
    );
  }
}

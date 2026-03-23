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
import {Component, input} from '@angular/core';
import {MatDividerModule} from '@angular/material/divider';
import {VcCuratedProperties} from '@ui/shared/properties/curated_properties';

@Component({
  selector: 'view-capture-property-groups',
  standalone: true,
  imports: [CommonModule, MatDividerModule],
  templateUrl: './view_capture_property_groups_component.ng.html',
  styleUrls: ['view_capture_property_groups_component.scss'],
})
export class ViewCapturePropertyGroupsComponent {
  properties = input.required<VcCuratedProperties>();
}

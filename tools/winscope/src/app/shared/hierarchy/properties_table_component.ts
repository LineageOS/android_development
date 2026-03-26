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
import {Component, input} from '@angular/core';
import {TableProperties} from '@ui/shared/hierarchy/table_properties';

@Component({
  selector: 'properties-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './properties_table_component.ng.html',
  styleUrls: ['properties_table_component.scss'],
})
export class PropertiesTableComponent {
  objectEntries = Object.entries;

  properties = input.required<TableProperties>();
}

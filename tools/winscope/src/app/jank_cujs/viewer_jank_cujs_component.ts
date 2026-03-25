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
import {Component} from '@angular/core';
import {LogComponent} from '@app/shared/log_view/log_component';
import {LogViewerComponent} from '@app/shared/log_view/log_viewer_component';
import {UiData} from '@ui/jank_cujs/ui_data';

@Component({
  selector: 'viewer-jank-cujs',
  standalone: true,
  imports: [CommonModule, LogComponent],
  templateUrl: './viewer_jank_cujs_component.ng.html',
  styleUrls: ['./viewer_jank_cujs_component.scss'],
})
export class ViewerJankCujsComponent extends LogViewerComponent<UiData> {}

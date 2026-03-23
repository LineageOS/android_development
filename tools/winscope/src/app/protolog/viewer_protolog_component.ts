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
import {LogComponent} from '@app/shared/log_view/log_component';
import {LogViewerComponent} from '@app/shared/log_view/log_viewer_component';
import {UiData} from '@ui/protolog/ui_data';

import {ProtologHeightPredictor} from './protolog_height_predictor';

@Component({
  selector: 'viewer-protolog',
  standalone: true,
  imports: [CommonModule, LogComponent],
  templateUrl: './viewer_protolog_component.ng.html',
  styleUrls: ['./viewer_protolog_component.scss'],
})
export class ViewerProtologComponent extends LogViewerComponent<UiData> {
  readonly heightPredictor = new ProtologHeightPredictor(
    this.elementRef,
    (index: number) => this.inputData()?.entries[index],
  );
}

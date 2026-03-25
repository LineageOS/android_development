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
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';

/**
 * A component for displaying a progress bar with a message.
 */
@Component({
  selector: 'load-progress',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './load_progress_component.ng.html',
  styleUrls: ['load_progress_component.scss'],
})
export class LoadProgressComponent {
  progressPercentage = input<number>();
  message = input<string>('Loading...');
  icon = input<string>('sync');

  private static readonly MIN_UI_UPDATE_PERIOD_MS = 100;

  static canUpdateComponent(lastUpdateTimeMs: number | undefined): boolean {
    if (lastUpdateTimeMs === undefined) {
      return true;
    }
    // Limit the amount of UI updates, because the progress bar component
    // renders weird stuff when updated too frequently.
    // Also, this way we save some resources.
    return (
      Date.now() - lastUpdateTimeMs >=
      LoadProgressComponent.MIN_UI_UPDATE_PERIOD_MS
    );
  }
}

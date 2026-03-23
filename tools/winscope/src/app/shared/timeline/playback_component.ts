/*
 * Copyright (C) 2025 The Android Open Source Project
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
import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectChange, MatSelectModule} from '@angular/material/select';
import {MatTooltipModule} from '@angular/material/tooltip';
import {Analytics} from '@logging/analytics';
import {PlaybackState} from '@ui/shared/playback/playback_state';

@Component({
  selector: 'playback-controls',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
  ],
  templateUrl: './playback_component.ng.html',
  styleUrls: ['playback_component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaybackControlsComponent {
  readonly PlaybackState = PlaybackState;

  currentState = input.required<PlaybackState>();

  readonly playbackStateChange = output<PlaybackState>();
  readonly speedChange = output<number>();

  readonly playbackSpeedSelection = [0.25, 0.5, 1, 2, 4];
  selectedScale = 1;

  changePlaybackState(newState: PlaybackState): void {
    if (this.currentState() !== newState) {
      this.playbackStateChange.emit(newState);
      if (newState !== PlaybackState.PAUSED) {
        Analytics.Playback.logStartRequest(
          newState === PlaybackState.FORWARDS ? 'forwards' : 'backwards',
        );
      }
    }
  }

  changeSpeed(event: MatSelectChange): void {
    this.selectedScale = event.value;
    event.source.close();
    this.speedChange.emit(this.selectedScale);
  }
}

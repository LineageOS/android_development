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

import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatSelectModule, MatSelectChange} from '@angular/material/select';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatTooltipModule} from '@angular/material/tooltip';
import {CommonModule} from '@angular/common';
import {PlaybackState} from 'viewers/common/playback/playback_state';

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
  template: `
    <div class="playback-controls-container">
      <div class="controls">
        <button
          mat-icon-button
          id="play_reverse_playback_button"
          matTooltip="Play backwards"
          (click)="changePlaybackState(PlaybackState.BACKWARDS)">
          <mat-icon class="force-icon-flip"
            [class.material-symbols-outlined]="currentState !== PlaybackState.BACKWARDS"
            [color]="currentState === PlaybackState.BACKWARDS ? 'primary' : null">
            play_arrow
          </mat-icon>
        </button>
        <button
          mat-icon-button
          id="pause_playback_button"
          matTooltip="Pause"
          (click)="changePlaybackState(PlaybackState.PAUSED)"
          [disabled]="currentState === PlaybackState.PAUSED">
          <mat-icon>pause</mat-icon>
        </button>
        <button
          mat-icon-button
          id="play_playback_button"
          matTooltip="Play forwards"
          (click)="changePlaybackState(PlaybackState.FORWARDS)">
          <mat-icon [class.material-symbols-outlined]="currentState !== PlaybackState.FORWARDS"
          [color]="currentState === PlaybackState.FORWARDS ? 'primary' : null">
          play_arrow
          </mat-icon>
        </button>
      </div>
      <div class="playback-select">
        <span class="mat-body-1 speed-label"> Speed: </span>
        <mat-form-field
          subscriptSizing="dynamic"
          class="mat-form-field-appearance-none playback-speed-selector no-ripple-field">
          <mat-select
            (selectionChange)="changeSpeed($event)"
            [(value)]="selectedScale"
            panelWidth='80px'>
            @for (speed of playbackSpeedSelection; track speed) {
              <mat-option [value]="speed">
                {{speed}}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
    </div>
  `,
  styles: [
    `
      .playback-controls-container {
        display: flex;
        flex-direction: row;
        align-items: center;
      }
      .controls {
        display: flex;
        flex-direction: row;
        align-items: center;
      }
      .playback-select {
        display: flex;
        flex-direction: row;
        align-items: center;
        margin-left: 8px;
      }
      .speed-label {
        margin-right: 4px;
      }
      .playback-speed-selector {
        width: 45px;
      }
      .force-icon-flip {
        transform: scaleX(-1);
      }
      mat-option {
        padding-left: 10px;
        height: 25px;
        justify-content: left;
      }
  `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaybackControlsComponent {
  readonly PlaybackState = PlaybackState;

  @Input() currentState: PlaybackState = PlaybackState.PAUSED;

  @Output() readonly playbackStateChange = new EventEmitter<PlaybackState>();
  @Output() readonly speedChange = new EventEmitter<number>();

  playbackSpeedSelection = [0.25, 0.5, 1, 2, 4];
  selectedScale = 1;

  changePlaybackState(newState: PlaybackState): void {
    if (this.currentState !== newState) {
      this.playbackStateChange.emit(newState);
    }
  }

  changeSpeed(event: MatSelectChange): void {
    this.selectedScale = event.value;
    this.speedChange.emit(this.selectedScale);
  }
}

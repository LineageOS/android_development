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
import {Component, Inject} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatDialogModule} from '@angular/material/dialog';
import {MatIconModule, MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';
import {getRootUrl} from 'common/window';

/**
 * A component for displaying a list of essential keyboard shortcuts.
 */
@Component({
  selector: 'shortcuts-panel',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  template: `
    <h2 class="dialog-title" mat-dialog-title>
      <span class="shortcuts-title"> ESSENTIAL SHORTCUTS </span>
      <button mat-dialog-close class="close" mat-icon-button>
        <mat-icon> close </mat-icon>
      </button>
    </h2>
    <mat-dialog-content>
      <div class="mat-headline-6"> Timeline </div>
      <div class="grouped-shortcuts">
        <div class="key-shortcut even-width mat-body-1">
          <div class="key"> W </div>
          <span class="action"> Zoom in </span>
        </div>
        <div class="key-shortcut even-width mat-body-1">
          <div class="key"> S </div>
          <span class="action"> Zoom out </span>
        </div>
        <div class="key-shortcut even-width mat-body-1">
          <div class="key"> A </div>
          <span class="action"> Move slider left </span>
        </div>
        <div class="key-shortcut even-width mat-body-1">
          <div class="key"> D </div>
          <span class="action"> Move slider right </span>
        </div>
        <div class="pointer-shortcut mat-body-1">
          <mat-icon class="trackpad-icon" svgIcon="trackpad_right_click"></mat-icon>
          <span class="action">
            <span class="italic-text"> Right click </span>
            <span> Open context menu for bookmarks </span>
          </span>
        </div>
        <div class="pointer-shortcut mat-body-1">
          <mat-icon class="trackpad-icon enlarge" svgIcon="trackpad_vertical_scroll"></mat-icon>
          <span class="action">
            <span class="italic-text"> Vertical Scroll </span>
            <span> Zoom in/out </span>
          </span>
        </div>
        <div class="pointer-shortcut mat-body-1">
          <mat-icon class="trackpad-icon tall" svgIcon="trackpad_horizontal_scroll"></mat-icon>
          <span class="action">
            <span class="italic-text"> Horizontal Scroll </span>
            <span> Move slider left/right </span>
          </span>
        </div>
      </div>

      <div class="shortcuts-row">
        <div class="shortcuts-row-section">
          <div class="mat-headline-6"> 3D View </div>
          <div class="grouped-shortcuts">
            <div class="pointer-shortcut mat-body-1">
              <mat-icon class="trackpad-icon enlarge" svgIcon="trackpad_vertical_scroll"></mat-icon>
              <span class="action">
                <span class="italic-text"> Vertical Scroll </span>
                <span> Zoom in/out </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="shortcuts-row">
        <div class="shortcuts-row-section">
          <div class="mat-headline-6"> Global </div>
          <div class="grouped-shortcuts">
            <div class="key-shortcut mat-body-1">
              <div class="key">
                <mat-icon class="material-symbols-outlined">arrow_left_alt</mat-icon>
              </div>
              <span class="action">Previous state</span>
            </div>
            <div class="key-shortcut mat-body-1">
              <div class="key">
                <mat-icon class="material-symbols-outlined">arrow_right_alt</mat-icon>
              </div>
              <span class="action">Next state</span>
            </div>
            <div class="key-shortcut mat-body-1">
              <div class="key">
                <mat-icon class="material-symbols-outlined">space_bar</mat-icon>
              </div>
              <span class="action">Play/pause</span>
            </div>
            <div class="key-shortcut mat-body-1">
              <div class="key">
                <mat-icon class="material-symbols-outlined">fast_forward</mat-icon>
              </div>
              <span class="action">Play forwards</span>
            </div>
            <div class="key-shortcut mat-body-1">
              <div class="key">
                <mat-icon class="material-symbols-outlined">fast_rewind</mat-icon>
              </div>
              <span class="action">Play backwards</span>
            </div>
          </div>
        </div>
      </div>
    </mat-dialog-content>
  `,
  styleUrls: ['shortcuts_component.css'],
})
export class ShortcutsComponent {
  constructor(
    @Inject(MatIconRegistry) private matIconRegistry: MatIconRegistry,
    @Inject(DomSanitizer) private domSanitizer: DomSanitizer,
  ) {
    this.matIconRegistry.addSvgIcon(
      'trackpad_right_click',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        getRootUrl() + 'trackpad_right_click.svg',
      ),
    );
    this.matIconRegistry.addSvgIcon(
      'trackpad_vertical_scroll',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        getRootUrl() + 'trackpad_vertical_scroll.svg',
      ),
    );
    this.matIconRegistry.addSvgIcon(
      'trackpad_horizontal_scroll',
      this.domSanitizer.bypassSecurityTrustResourceUrl(
        getRootUrl() + 'trackpad_horizontal_scroll.svg',
      ),
    );
  }
}

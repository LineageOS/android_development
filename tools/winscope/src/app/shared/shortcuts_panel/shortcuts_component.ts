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
import {getRootUrl} from '@common/window';

/**
 * A component for displaying a list of essential keyboard shortcuts.
 */
@Component({
  selector: 'shortcuts-panel',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  templateUrl: './shortcuts_component.ng.html',
  styleUrls: ['shortcuts_component.scss'],
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

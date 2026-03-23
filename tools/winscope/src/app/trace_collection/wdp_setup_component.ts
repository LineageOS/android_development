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
import {Component, input, output} from '@angular/core';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {ConnectionState} from '@trace_collection/connection_state';

/**
 * A component for displaying the Web Device Proxy setup instructions.
 */
@Component({
  selector: 'wdp-setup',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './wdp_setup_component.ng.html',
  styleUrls: ['./proxy_setup.scss'],
})
export class WdpSetupComponent {
  state = input.required<ConnectionState>();
  retryConnection = output<void>();
  ConnectionState = ConnectionState;

  onInstallExternalButtonClick() {
    window.open(
      'https://tools.google.com/dlpage/android_web_device_proxy',
      '_blank',
    );
  }

  onInstallGoogleButtonClick() {
    window.open('http://go/web-device-proxy#setup', '_blank');
  }

  onRetryButtonClick() {
    this.retryConnection.emit();
  }
}

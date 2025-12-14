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
import {ClipboardModule} from '@angular/cdk/clipboard';
import {CommonModule} from '@angular/common';
import {Component, EventEmitter, Input, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {MatTooltipModule} from '@angular/material/tooltip';
import {DownloadRequest, downloadFromUrl} from '@common/download';
import {getRootUrl} from '@common/window';
import {ConnectionState} from '@trace_collection/connection_state';
import {VERSION} from '@trace_collection/winscope_proxy/utils';

/**
 * A component for displaying the Winscope proxy setup instructions.
 */
@Component({
  selector: 'winscope-proxy-setup',
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    ClipboardModule,
    MatTooltipModule,
    MatIconModule,
    FormsModule,
  ],
  templateUrl: './winscope_proxy_setup_component.ng.html',
  styleUrls: ['winscope_proxy_setup_component.css'],
})
export class WinscopeProxySetupComponent {
  @Input() state: ConnectionState | undefined;
  @Input() downloadRequest: DownloadRequest = (
    url: string,
    fileName: string,
  ) => {
    downloadFromUrl(url, fileName);
  };
  @Output() readonly retryConnection = new EventEmitter<string>();
  ConnectionState = ConnectionState;

  readonly downloadProxyUrl: string = getRootUrl() + 'winscope_proxy.py';
  readonly proxyCommand: string =
    'python3 $ANDROID_BUILD_TOP/development/tools/winscope/src/adb/winscope_proxy.py';
  readonly proxyVersion = VERSION;
  proxyToken = '';

  onRetryButtonClick() {
    if (this.state !== ConnectionState.UNAUTH || this.proxyToken.length > 0) {
      this.retryConnection.emit(this.proxyToken);
    }
  }

  onKeydownEnterProxyTokenInput(event: MouseEvent) {
    (event.target as HTMLInputElement).blur();
    this.onRetryButtonClick();
  }

  onDownloadProxyClick() {
    this.downloadRequest(this.downloadProxyUrl, 'winscope_proxy.py');
  }
}

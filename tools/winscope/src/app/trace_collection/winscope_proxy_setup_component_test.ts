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
import {TestBed} from '@angular/core/testing';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatIconModule} from '@angular/material/icon';
import {MatInputModule} from '@angular/material/input';
import {BrowserAnimationsModule, NoopAnimationsModule,} from '@angular/platform-browser/animations';
import {DownloadRequest} from '@common/download';
import {DOMTestHelper} from '@common/testing/dom_test_helpers';
import {ConnectionState} from '@trace_collection/connection_state';

import {WinscopeProxySetupComponent} from './winscope_proxy_setup_component';

describe('WinscopeProxySetupComponent', () => {
  let component: WinscopeProxySetupComponent;
  let dom: DOMTestHelper<WinscopeProxySetupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        CommonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        BrowserAnimationsModule,
        MatButtonModule,
        FormsModule,
        WinscopeProxySetupComponent,
      ],
      schemas: [],
    }).compileComponents();
    const fixture = TestBed.createComponent(WinscopeProxySetupComponent);
    component = fixture.componentInstance;
    dom = new DOMTestHelper(fixture, fixture.nativeElement);
    dom.setComponentInput('state', ConnectionState.CONNECTING);
  });

  it('can be created', () => {
    expect(component).toBeTruthy();
  });

  it('correct connecting message', () => {
    dom.detectChanges();
    dom.get('.connecting-message').checkText('Connecting...');
  });

  it('correct icon and message displays if no proxy', () => {
    dom.setComponentInput('state', ConnectionState.NOT_FOUND);
    dom.detectChanges();
    dom
      .get('.further-adb-info-text')
      .checkText('Launch the Winscope ADB Connect proxy');
  });

  it('correct icon and message displays if invalid proxy', () => {
    dom.setComponentInput('state', ConnectionState.INVALID_VERSION);
    dom.detectChanges();
    const infoText = dom.get('.further-adb-info-text');
    infoText.checkText(
      'Your local proxy version is incompatible with Winscope.',
    );
    infoText.checkText(
      `Please update the proxy to version ${component.proxyVersion}`,
    );
    dom.get('.adb-icon').checkTextExact('update');
  });

  it('correct icon and message displays if unauthorized proxy', () => {
    dom.setComponentInput('state', ConnectionState.UNAUTH);
    dom.detectChanges();
    dom.get('.adb-info').checkText('Proxy authorization required.');
    dom.get('.adb-icon').checkTextExact('lock');
  });

  it('download proxy button downloads proxy', () => {
    dom.setComponentInput('state', ConnectionState.NOT_FOUND);
    const spy: DownloadRequest = jasmine.createSpy('fromUrl');
    dom.setComponentInput(
      'downloadRequest',
      (url: string, fileName: string) => {
        spy(url, fileName);
      },
    );
    dom.detectChanges();
    dom.findAndClick('.download-proxy-btn');
    expect(spy).toHaveBeenCalledWith(
      component.downloadProxyUrl,
      'winscope_proxy.py',
    );
  });

  it('retry button emits event', () => {
    dom.setComponentInput('state', ConnectionState.NOT_FOUND);
    dom.detectChanges();

    const spy = spyOn(component.retryConnection, 'emit');
    dom.findAndClick('.retry');
    expect(spy).toHaveBeenCalledWith('');
  });

  it('input proxy token saved as expected', () => {
    const spy = spyOn(component.retryConnection, 'emit');
    dom.setComponentInput('state', ConnectionState.UNAUTH);
    dom.detectChanges();

    dom.findAndClick('.retry');
    expect(spy).not.toHaveBeenCalled();

    dom.findAndDispatchInput('.proxy-token-input-field', '12345');
    expect(spy).not.toHaveBeenCalled();

    dom.findAndClick('.retry');
    expect(spy).toHaveBeenCalledWith('12345');
  });

  it('emits event on enter key', () => {
    const spy = spyOn(component.retryConnection, 'emit');
    dom.setComponentInput('state', ConnectionState.UNAUTH);
    dom.detectChanges();

    dom.findAndDispatchInput('.proxy-token-input-field', '12345');
    expect(spy).not.toHaveBeenCalled();

    dom.get('.proxy-token-input-field').keydownEnter();
    expect(spy).toHaveBeenCalledWith('12345');
  });
});

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

import {GlobalConfig} from '@compat/global_config';

import {isAllowed, isAllowedIframeParentOrigin} from './origin_allow_list';

describe('OriginAllowList', () => {
  const prod = jasmine.createSpyObj<GlobalConfig>('GlobalConfig', [
    'isProdMode',
    'isTestMode',
    'isDevMode',
  ]);
  prod.isProdMode.and.returnValue(true);
  prod.isTestMode.and.returnValue(false);
  prod.isDevMode.and.returnValue(false);

  const dev = jasmine.createSpyObj<GlobalConfig>('GlobalConfig', [
    'isProdMode',
    'isTestMode',
    'isDevMode',
  ]);
  dev.isProdMode.and.returnValue(false);
  dev.isTestMode.and.returnValue(false);
  dev.isDevMode.and.returnValue(true);

  describe('dev mode', () => {
    it('allows localhost', () => {
      expect(isAllowed('http://localhost:8081', dev)).toBeTrue();
      expect(isAllowed('https://localhost:8081', dev)).toBeTrue();
    });
  });

  describe('prod mode', () => {
    it('allows google.com', () => {
      expect(isAllowed('https://google.com', prod)).toBeTrue();
      expect(isAllowed('https://subdomain.google.com', prod)).toBeTrue();
    });

    it('denies pseudo google.com', () => {
      expect(isAllowed('https://evilgoogle.com', prod)).toBeFalse();
      expect(isAllowed('https://evil.com/google.com', prod)).toBeFalse();
    });

    it('allows googleplex.com', () => {
      expect(isAllowed('https://googleplex.com', prod)).toBeTrue();
      expect(isAllowed('https://subdomain.googleplex.com', prod)).toBeTrue();
    });

    it('denies pseudo googleplex.com', () => {
      expect(isAllowed('https://evilgoogleplex.com', prod)).toBeFalse();
      expect(
        isAllowed('https://evil.com/subdomain.googleplex.com', prod),
      ).toBeFalse();
    });

    it('allows perfetto.dev', () => {
      expect(isAllowed('https://perfetto.dev', prod)).toBeTrue();
      expect(isAllowed('https://subdomain.perfetto.dev', prod)).toBeTrue();
    });

    it('denies pseudo perfetto.dev', () => {
      expect(isAllowed('https://evilperfetto.dev', prod)).toBeFalse();
      expect(
        isAllowed('https://evil.com/subdomain.perfetto.dev', prod),
      ).toBeFalse();
    });
  });

  describe('isAllowedIframeParentOrigin', () => {
    const DEV_AND_PROD_ORIGINS = [
      'https://random.proxy.googlers.com',
      'https://another123.proxy.googlers.com',
    ];

    const PROD_ONLY_ORIGINS = [
      'https://winscope.corp.google.com',
      'https://winscope-staging.corp.google.com',
      'https://winscope-autopush.corp.google.com',
    ];

    const DENIED_ORIGINS = [
      'https://google.com',
      'http://localhost:8082',
      'https://evil.com',
    ];

    it('allows prod origins in prod mode', () => {
      for (const origin of PROD_ONLY_ORIGINS) {
        expect(isAllowedIframeParentOrigin(origin, prod))
          .withContext(origin)
          .toBeTrue();
      }
      for (const origin of DEV_AND_PROD_ORIGINS) {
        expect(isAllowedIframeParentOrigin(origin, prod))
          .withContext(origin)
          .toBeTrue();
      }
    });

    it('allows dev origins in dev mode', () => {
      for (const origin of DEV_AND_PROD_ORIGINS) {
        expect(isAllowedIframeParentOrigin(origin, dev))
          .withContext(origin)
          .toBeTrue();
      }
    });

    it('do not allows prod origins in dev mode', () => {
      for (const origin of PROD_ONLY_ORIGINS) {
        expect(isAllowedIframeParentOrigin(origin, dev))
          .withContext(origin)
          .toBeFalse();
      }
    });

    it('denies random origins', () => {
      for (const origin of DENIED_ORIGINS) {
        expect(isAllowedIframeParentOrigin(origin, dev))
          .withContext(origin)
          .toBeFalse();
        expect(isAllowedIframeParentOrigin(origin, dev))
          .withContext(origin)
          .toBeFalse();
      }
    });
  });
});

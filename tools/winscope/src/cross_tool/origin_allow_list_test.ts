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

import {isAllowed, isAllowedIframeParentOrigin} from './origin_allow_list';

describe('OriginAllowList', () => {
  describe('dev mode', () => {
    const mode = 'DEV' as const;

    it('allows localhost', () => {
      expect(isAllowed('http://localhost:8081', mode)).toBeTrue();
      expect(isAllowed('https://localhost:8081', mode)).toBeTrue();
    });
  });

  describe('prod mode', () => {
    const mode = 'PROD' as const;

    it('allows google.com', () => {
      expect(isAllowed('https://google.com', mode)).toBeTrue();
      expect(isAllowed('https://subdomain.google.com', mode)).toBeTrue();
    });

    it('denies pseudo google.com', () => {
      expect(isAllowed('https://evilgoogle.com', mode)).toBeFalse();
      expect(isAllowed('https://evil.com/google.com', mode)).toBeFalse();
    });

    it('allows googleplex.com', () => {
      expect(isAllowed('https://googleplex.com', mode)).toBeTrue();
      expect(isAllowed('https://subdomain.googleplex.com', mode)).toBeTrue();
    });

    it('denies pseudo googleplex.com', () => {
      expect(isAllowed('https://evilgoogleplex.com', mode)).toBeFalse();
      expect(
        isAllowed('https://evil.com/subdomain.googleplex.com', mode),
      ).toBeFalse();
    });

    it('allows perfetto.dev', () => {
      expect(isAllowed('https://perfetto.dev', mode)).toBeTrue();
      expect(isAllowed('https://subdomain.perfetto.dev', mode)).toBeTrue();
    });

    it('denies pseudo perfetto.dev', () => {
      expect(isAllowed('https://evilperfetto.dev', mode)).toBeFalse();
      expect(
        isAllowed('https://evil.com/subdomain.perfetto.dev', mode),
      ).toBeFalse();
    });
  });

  describe('isAllowedIframeParentOrigin', () => {
    const PROD_MODE = 'PROD' as const;
    const DEV_MODE = 'DEV' as const;

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
      'http://localhost:8080',
      'https://evil.com',
    ];

    it('allows prod origins in prod mode', () => {
      for (const origin of PROD_ONLY_ORIGINS) {
        expect(isAllowedIframeParentOrigin(origin, PROD_MODE))
          .withContext(origin)
          .toBeTrue();
      }
      for (const origin of DEV_AND_PROD_ORIGINS) {
        expect(isAllowedIframeParentOrigin(origin, PROD_MODE))
          .withContext(origin)
          .toBeTrue();
      }
    });

    it('allows dev origins in dev mode', () => {
      for (const origin of DEV_AND_PROD_ORIGINS) {
        expect(isAllowedIframeParentOrigin(origin, DEV_MODE))
          .withContext(origin)
          .toBeTrue();
      }
    });

    it('do not allows prod origins in dev mode', () => {
      for (const origin of PROD_ONLY_ORIGINS) {
        expect(isAllowedIframeParentOrigin(origin, DEV_MODE))
          .withContext(origin)
          .toBeFalse();
      }
    });

    it('denies random origins', () => {
      for (const origin of DENIED_ORIGINS) {
        expect(isAllowedIframeParentOrigin(origin, PROD_MODE))
          .withContext(origin)
          .toBeFalse();
        expect(isAllowedIframeParentOrigin(origin, DEV_MODE))
          .withContext(origin)
          .toBeFalse();
      }
    });
  });
});

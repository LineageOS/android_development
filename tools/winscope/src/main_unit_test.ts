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

/* eslint-disable winscope/sort-imports */
// zone.js and zone.js/testing must be imported before any other Angular imports
import 'zone.js';
import 'zone.js/testing';
/* eslint-enable winscope/sort-imports */
import {TestBed} from '@angular/core/testing';
import {BrowserDynamicTestingModule, platformBrowserDynamicTesting,} from '@angular/platform-browser-dynamic/testing';
import {Registry} from '@trace/proto_utils/tampered_message_type';

TestBed.initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(),
);

beforeAll(async () => {
  await Registry.getInstance().loadDefaultDescriptors();
});

jasmine.DEFAULT_TIMEOUT_INTERVAL = 300000;

// filter matches all "*_test.ts" files that are not within the /test/e2e/ directory
// Using import.meta.webpackContext for Webpack 5 support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const context = (import.meta as any).webpackContext('./', {
  recursive: true,
  regExp: /^(?!.*\/e2e\/).*_test\.ts$/,
});

context
  .keys()
  .sort((a: string, b: string) => {
    if (a < b) {
      return -1;
    } else if (a === b) {
      return 0;
    } else {
      return 1;
    }
  })
  .forEach(context);

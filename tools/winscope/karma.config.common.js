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

module.exports = (config) => {
  config.set({
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      'karma-chrome-launcher',
      'karma-jasmine',
      'karma-sourcemap-loader',
      'karma-spec-reporter',
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    files: [
    ],
    reporters: ['progress', 'spec'],
    specReporter: {
      maxLogLines: 5,             // limit number of lines logged per test
      suppressSummary: false,      // do not print summary
      suppressErrorSummary: false, // do not print error summary
      suppressFailed: false,      // do not print information about failed tests
      suppressPassed: false,      // do not print information about passed tests
      suppressSkipped: true,      // do not print information about skipped tests
      showBrowser: false,         // print the browser for each spec
      showSpecTiming: true,       // print the time elapsed for each spec
      failFast: false,            // test would finish with error when a first fail occurs
      prefixes: {
        success: '    OK: ',      // override prefix for passed tests, default is '✓ '
        failure: 'FAILED: ',      // override prefix for failed tests, default is '✗ '
        skipped: 'SKIPPED: '      // override prefix for skipped tests, default is '- '
      }
    },
    proxies: {
      // Angular builder serves assets at root (or configured output).
      // Tests usually expect them at /base/...
      '/base/src/test/fixtures/': '/src/test/fixtures/',
      '/base/src/assets/': '/src/assets/',

      // Mappings for specific assets served at root by angular.json
      '/base/deps_build/trace_processor/to_be_served/': '/',
      '/base/src/adb/winscope_proxy.py': '/winscope_proxy.py',
      '/base/src/viewers/components/rects/': '/',
      '/base/src/app/components/': '/',
      '/base/src/': '/', // Fallback for things like logo_light_mode.svg served at root
    },
    verbose: true, // output config used by istanbul for debugging
  });
};

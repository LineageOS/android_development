/*
 * Copyright (C) 2023 The Android Open Source Project
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

const configCommon = require('./karma.config.common');

const configCi = (config) => {
  config.set({
    singleRun: true,
    browsers: ['ChromeHeadlessFixedSize'],
    customLaunchers: {
      ChromeHeadlessFixedSize: {
        base: 'ChromeHeadless',
        flags: ['--window-size=1280,1024', '--enable-unsafe-swiftshader'],
      }
    },
    plugins: [
      'karma-chrome-launcher',
      'karma-jasmine',
      'karma-spec-reporter',
      'karma-coverage',
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/winscope'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'spec', 'coverage'],
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

    verbose: true, // output config used by istanbul for debugging
  });
};

module.exports = (config) => {
  configCommon(config);
  configCi(config);
};

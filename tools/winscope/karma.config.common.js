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
const {merge} = require('webpack-merge');
const webpackConfig = require('./webpack.config.common');
const AngularWebpackPlugin = require('@ngtools/webpack').AngularWebpackPlugin;

module.exports = (config) => {
  config.set({
    frameworks: ['jasmine', 'webpack'],
    plugins: [
      'karma-webpack',
      'karma-chrome-launcher',
      'karma-jasmine',
      'karma-sourcemap-loader',
    ],
    files: [
      {pattern: 'src/main_unit_test.ts', watched: false},
      {pattern: 'src/logo_light_mode.svg', included: false, served: true},
      {
        pattern: 'src/app/components/trackpad_right_click.svg',
        included: false,
        served: true,
      },
      {
        pattern: 'src/app/components/trackpad_vertical_scroll.svg',
        included: false,
        served: true,
      },
      {
        pattern: 'src/app/components/trackpad_horizontal_scroll.svg',
        included: false,
        served: true,
      },
      {pattern: 'src/test/fixtures/**/*', included: false, served: true},
      {
        pattern: 'deps_build/trace_processor/to_be_served/engine_bundle.js',
        included: false,
        served: true,
      },
      {
        pattern: 'deps_build/trace_processor/to_be_served/trace_processor.wasm',
        included: false,
        served: true,
      },
      {
        pattern:
          'deps_build/trace_processor/to_be_served/trace_processor_memory64.wasm',
        included: false,
        served: true,
      },
    ],
    reporters: ['progress'],
    proxies: {
      '/logo_light_mode.svg': '/base/src/logo_light_mode.svg',
      '/trackpad_right_click.svg':
        '/base/src/app/components/trackpad_right_click.svg',
      '/trackpad_vertical_scroll.svg':
        '/base/src/app/components/trackpad_vertical_scroll.svg',
      '/trackpad_horizontal_scroll.svg':
        '/base/src/app/components/trackpad_horizontal_scroll.svg',
    },
    preprocessors: {
      'src/main_unit_test.ts': ['webpack', 'sourcemap'],
    },
    verbose: true, // output config used by istanbul for debugging
    webpack: merge(webpackConfig, {
      plugins: [
        new AngularWebpackPlugin({
          tsconfig: 'tsconfig.karma.json',
          jitMode: '@angular/compiler',
        }),
      ],
    }),
  });
};

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

import {LogLevel} from 'typescript-logging';
import {Log4TSProvider, Logger as Log} from 'typescript-logging-log4ts-style';
import {globalConfig} from '@common/global_config';

export type Logger = Log;

const isTest = globalConfig.MODE === 'KARMA_TEST';

let logLevel = LogLevel.Debug;
if (isTest) {
  logLevel = LogLevel.Fatal;
}

const provider = Log4TSProvider.createProvider('DefaultLogProvider', {
  /* Specify the various group expressions to match against */
  groups: [
    {
      expression: new RegExp('.*'),
      level: logLevel,
    },
  ],
});

export function getLogger(name: string): Logger {
  return provider.getLogger(name);
}

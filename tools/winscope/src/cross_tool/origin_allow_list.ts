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

import {globalConfig} from 'common/global_config';

const ALLOW_LIST_PROD = [
  new RegExp('^https://([^\\/]*\\.)*googleplex\\.com$'),
  new RegExp('^https://([^\\/]*\\.)*google\\.com$'),
  new RegExp('^https://([^\\/]*\\.)*perfetto\\.dev$'),
  new RegExp('^https://.*\\.proxy\\.googlers\\.com(:\\d+)?$'),
];

const ALLOW_LIST_DEV = [
  ...ALLOW_LIST_PROD,
  new RegExp('^(http|https)://localhost:8081$'), // remote tool mock
  new RegExp('^https://localhost([^\\/]*\\.)*google\\.com(:\\d+)?$'), // local apps
  new RegExp('^https://.*\\.proxy\\.googlers\\.com(:\\d+)?$'), // local apps
];

const EXPECTED_DENY_LIST_DEV = [
  new RegExp('^(http|https)://localhost:8080$'), // Winscope tool
];

const EXPECTED_DENY_LIST_KARMA_TEST = [
  new RegExp('^(http|https)://localhost:9878$'), // Karma test environment
];

const IFRAME_PARENT_ALLOW_LIST_PROD = [
  /https:\/\/winscope.corp.google.com/,
  /https:\/\/winscope-staging.corp.google.com/,
  /https:\/\/winscope-autopush.corp.google.com/,
  /https:\/\/[a-z0-9]+\.proxy\.googlers\.com/,
];

const IFRAME_PARENT_ALLOW_LIST_DEV = [
  /https:\/\/[a-z0-9]+\.proxy\.googlers\.com/,
];

const TIMESTAMP_SYNC_ALLOW_LIST_PROD = [
  new RegExp('^https://android-bug-tool.corp.google.com/$'),
];

const TIMESTAMP_SYNC_ALLOW_LIST_DEV = [
  ...TIMESTAMP_SYNC_ALLOW_LIST_PROD,
  new RegExp('^(http|https)://localhost:8081$'), // remote tool mock
];

/**
 * Checks if origin is allowed for cross-tool communication.
 *
 * @param originUrl The url to check.
 * @param mode What mode the app environment is in - included as a function parameter
 * for testing purposes.
 */
export function isAllowed(
  originUrl: string,
  mode = globalConfig.MODE,
): boolean {
  const list = getAllowList(mode);

  for (const regex of list) {
    if (regex.test(originUrl)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if origin is expected to be unauthorized. Used to determine whether to warn
 * about the received message in console.
 *
 * @param originUrl The url to check.
 * @param mode What mode the app environment is in - included as a function parameter
 * for testing purposes.
 */
export function isUnauthorizedOriginExpected(
  originUrl: string,
  mode = globalConfig.MODE,
): boolean {
  const list = getExpectedDenyList(mode);

  for (const regex of list) {
    if (regex.test(originUrl)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if origin is an allowed iframe parent.
 *
 * @param originUrl The url to check.
 * @param mode What mode the app environment is in - included as a function parameter
 * for testing purposes.
 */
export function isAllowedIframeParentOrigin(
  originUrl: string,
  mode = globalConfig.MODE,
): boolean {
  let allowList: RegExp[];

  switch (mode) {
    case 'DEV':
    case 'KARMA_TEST':
      allowList = IFRAME_PARENT_ALLOW_LIST_DEV;
      break;
    case 'PROD':
      allowList = IFRAME_PARENT_ALLOW_LIST_PROD;
      break;
    default:
      throw new Error(`Unhandled mode: ${globalConfig.MODE}`);
  }

  return allowList.some((regex) => regex.test(originUrl));
}

/**
 * Checks if origin is allowed timestamp sync.
 *
 * @param originUrl The url to check.
 * @param mode What mode the app environment is in - included as a function parameter
 * for testing purposes.
 */
export function isOriginAllowedTimestampSync(
  originUrl: string,
  mode = globalConfig.MODE,
): boolean {
  let allowList: RegExp[];

  switch (mode) {
    case 'DEV':
    case 'KARMA_TEST':
      allowList = TIMESTAMP_SYNC_ALLOW_LIST_DEV;
      break;
    case 'PROD':
      allowList = TIMESTAMP_SYNC_ALLOW_LIST_PROD;
      break;
    default:
      throw new Error(`Unhandled mode: ${globalConfig.MODE}`);
  }

  return allowList.some((regex) => regex.test(originUrl));
}

function getAllowList(mode: typeof globalConfig.MODE): RegExp[] {
  switch (mode) {
    case 'DEV':
    case 'KARMA_TEST':
      return ALLOW_LIST_DEV;
    case 'PROD':
      return ALLOW_LIST_PROD;
    default:
      throw new Error(`Unhandled mode: ${globalConfig.MODE}`);
  }
}

function getExpectedDenyList(mode: typeof globalConfig.MODE): RegExp[] {
  switch (mode) {
    case 'DEV':
      return EXPECTED_DENY_LIST_DEV;
    case 'KARMA_TEST':
      return EXPECTED_DENY_LIST_KARMA_TEST;
    case 'PROD':
      return [];
    default:
      throw new Error(`Unhandled mode: ${globalConfig.MODE}`);
  }
}

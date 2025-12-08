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

/**
 * A class for managing the allow list of origins for cross-tool communication.
 */
export class OriginAllowList {
  private static readonly ALLOW_LIST_PROD = [
    new RegExp('^https://([^\\/]*\\.)*googleplex\\.com$'),
    new RegExp('^https://([^\\/]*\\.)*google\\.com$'),
    new RegExp('^https://([^\\/]*\\.)*perfetto\\.dev$'),
  ];

  private static readonly ALLOW_LIST_DEV = [
    ...OriginAllowList.ALLOW_LIST_PROD,
    new RegExp('^(http|https)://localhost:8081$'), // remote tool mock
    new RegExp('^https://localhost([^\\/]*\\.)*google\\.com(:\\d+)?$'), // local apps
    new RegExp('^https://.*\\.proxy\\.googlers\\.com(:\\d+)?$'), // local apps
  ];

  private static readonly EXPECTED_DENY_LIST_DEV = [
    new RegExp('^(http|https)://localhost:8080$'), // Winscope tool
  ];

  private static readonly EXPECTED_DENY_LIST_KARMA_TEST = [
    new RegExp('^(http|https)://localhost:9876$'), // Karma test environment
  ];

  private static readonly IFRAME_PARENT_ALLOW_LIST_PROD = [
    /https:\/\/winscope.corp.google.com/,
    /https:\/\/winscope-staging.corp.google.com/,
    /https:\/\/winscope-autopush.corp.google.com/,
  ];

  private static readonly IFRAME_PARENT_ALLOW_LIST_DEV = [
    /https:\/\/[a-z0-9]+\.proxy\.googlers\.com/,
  ];

  static isAllowed(originUrl: string, mode = globalConfig.MODE): boolean {
    const list = OriginAllowList.getAllowList(mode);

    for (const regex of list) {
      if (regex.test(originUrl)) {
        return true;
      }
    }

    return false;
  }

  static isUnauthorizedOriginExpected(
    originUrl: string,
    mode = globalConfig.MODE,
  ): boolean {
    const list = OriginAllowList.getExpectedDenyList(mode);

    for (const regex of list) {
      if (regex.test(originUrl)) {
        return true;
      }
    }

    return false;
  }

  static isAllowedIframeParentOrigin(
    originUrl: string,
    mode = globalConfig.MODE,
  ): boolean {
    let allowList: RegExp[];

    switch (mode) {
      case 'DEV':
      case 'KARMA_TEST':
        allowList = OriginAllowList.IFRAME_PARENT_ALLOW_LIST_DEV;
        break;
      case 'PROD':
        allowList = OriginAllowList.IFRAME_PARENT_ALLOW_LIST_PROD;
        break;
      default:
        throw new Error(`Unhandled mode: ${globalConfig.MODE}`);
    }

    return allowList.some((regex) => regex.test(originUrl));
  }

  private static getAllowList(mode: typeof globalConfig.MODE): RegExp[] {
    switch (mode) {
      case 'DEV':
      case 'KARMA_TEST':
        return OriginAllowList.ALLOW_LIST_DEV;
      case 'PROD':
        return OriginAllowList.ALLOW_LIST_PROD;
      default:
        throw new Error(`Unhandled mode: ${globalConfig.MODE}`);
    }
  }

  private static getExpectedDenyList(mode: typeof globalConfig.MODE): RegExp[] {
    switch (mode) {
      case 'DEV':
        return OriginAllowList.EXPECTED_DENY_LIST_DEV;
      case 'KARMA_TEST':
        return OriginAllowList.EXPECTED_DENY_LIST_KARMA_TEST;
      case 'PROD':
        return [];
      default:
        throw new Error(`Unhandled mode: ${globalConfig.MODE}`);
    }
  }
}
